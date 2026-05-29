import React, { useMemo, useEffect, useState, useRef, useCallback } from 'react';
import {
  Card, Col, Row, Table, Tag, Spin, DatePicker, Collapse, Badge, Alert, Button,
  Checkbox, Drawer, Modal, Form, Input, Select, Slider, Radio, AutoComplete, Progress, message, Tooltip,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  UnorderedListOutlined,
  PlayCircleOutlined,
  LaptopOutlined,
  DashboardOutlined,
  WarningOutlined,
  CloseCircleOutlined,
  BellOutlined,
  PlusOutlined,
  SearchOutlined,
  DatabaseOutlined,
  LinkOutlined,
  SendOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import * as echarts from 'echarts';
import G6, { Graph } from '@antv/g6';
import dayjs from 'dayjs';
import chinaJson from '@/assets/maps/china.json';
import useTaskManagementData from './hooks';
import {
  DemandItem, NodeItem, MapNodeItem, PriorityGroup, NodeStatusGroup, ResourceAlert,
  DatasetItem, DatasetRelation, TaskFormData,
  MOCK_DATASETS, MOCK_RELATIONS, BUSINESS_SOURCES,
} from './types';

const TaskManagement: React.FC = () => {
  const {
    loading, demands, nodes, stats, usage, trend, mapData,
    priorityGroups, nodeStatusGroups, alerts, predictDates, predictTrend, predictLoading, fetchPredictTrend,
  } = useTaskManagementData();

  const [selectedMapNode, setSelectedMapNode] = useState<MapNodeItem | null>(null);
  const [alertPanelVisible, setAlertPanelVisible] = useState(false);
  const [showActiveOnly, setShowActiveOnly] = useState(false);
  const [taskModalVisible, setTaskModalVisible] = useState(false);
  const [datasetList, setDatasetList] = useState<DatasetItem[]>(MOCK_DATASETS);
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importing, setImporting] = useState(false);
  const [businessFilter, setBusinessFilter] = useState<string>('all');
  const relationGraphRef = useRef<HTMLDivElement>(null);
  const graphInstanceRef = useRef<Graph | null>(null);
  const [taskForm] = Form.useForm();

  useEffect(() => {
    echarts.registerMap('china', chinaJson as any);
  }, []);

  useEffect(() => {
    if (!relationGraphRef.current || graphInstanceRef.current) return;
    const container = relationGraphRef.current;
    const width = container.offsetWidth || 800;
    const height = 360;

    const graphNodes = MOCK_DATASETS.slice(0, 10).map((ds) => ({
      id: ds.id,
      label: ds.name,
      type: 'circle',
      size: 40 + ds.relationCount * 5,
      style: { fill: '#1677ff', stroke: '#0958d9', lineWidth: 2 },
      labelCfg: { style: { fill: '#fff', fontSize: 10 }, position: 'center' },
    }));

    const graphEdges = MOCK_RELATIONS
      .filter((r) => MOCK_DATASETS.slice(0, 10).some((d) => d.id === r.source) && MOCK_DATASETS.slice(0, 10).some((d) => d.id === r.target))
      .map((r, i) => ({
        source: r.source,
        target: r.target,
        label: `${r.weight}`,
        style: { stroke: '#91caff', lineWidth: Math.max(r.weight * 3, 1), opacity: 0.7 },
        labelCfg: { style: { fill: '#666', fontSize: 9 } },
      }));

    const graph = new G6.Graph({
      container,
      width,
      height,
      fitView: true,
      animate: true,
      defaultNode: {
        type: 'circle',
        size: 40,
        style: { fill: '#1677ff', stroke: '#0958d9', lineWidth: 2 },
        labelCfg: { style: { fill: '#fff', fontSize: 10 }, position: 'center' },
      },
      defaultEdge: {
        type: 'line',
        style: { stroke: '#91caff', opacity: 0.7 },
        labelCfg: { style: { fill: '#666', fontSize: 9 }, refY: 5 },
      },
      layout: {
        type: 'force',
        preventOverlap: true,
        nodeSize: 50,
        linkDistance: (d: any) => 200 - (d.label ? parseFloat(d.label) * 100 : 100),
        nodeStrength: -80,
        edgeStrength: 0.1,
        collideStrength: 0.8,
      },
      modes: { default: ['drag-canvas', 'zoom-canvas', 'drag-node'] },
    });

    graph.data({ nodes: graphNodes, edges: graphEdges });
    graph.render();
    graphInstanceRef.current = graph;

    return () => {
      graph.destroy();
      graphInstanceRef.current = null;
    };
  }, []);

  const handleImportDataset = () => {
    setImportModalVisible(true);
    setImportProgress(0);
    setImporting(true);
    let progress = 0;
    const timer = setInterval(() => {
      progress += Math.random() * 20;
      if (progress >= 100) {
        progress = 100;
        clearInterval(timer);
        setImporting(false);
        const newId = `ds-new-${Date.now()}`;
        setDatasetList((prev) => [
          ...prev,
          {
            id: newId,
            name: `新接入数据集-${prev.length + 1}`,
            modality: '结构化',
            businessTag: '待标注',
            size: `${Math.floor(Math.random() * 50 + 1)}GB`,
            privacyEpsilon: +(Math.random() * 4 + 0.5).toFixed(1),
            relationCount: 0,
          },
        ]);
        message.success('数据集接入成功！');
      }
      setImportProgress(Math.min(Math.floor(progress), 100));
    }, 300);
  };

  const handleTaskSubmit = () => {
    taskForm.validateFields().then((values) => {
      const taskId = values.task_id || `task-fedtrain-${Math.floor(Math.random() * 90000 + 10000)}`;
      const newTask: DemandItem = {
        id: taskId,
        task: values.task_name || taskId,
        cpu: 16,
        memory: 64,
        gpu: 4,
        storage: 128,
        priority: values.priority || '中',
        status: '待分配',
        business_source: values.business_source,
        dataset: values.dataset,
        privacy_epsilon: values.privacy_epsilon,
        noniid_alpha: values.noniid_alpha,
        aggregation: values.aggregation,
        model_type: values.model_type,
      };
      console.log('提交至调度中枢:', { ...newTask, task_id: taskId });
      message.success('任务已提交至调度中枢！');
      setTaskModalVisible(false);
      taskForm.resetFields();
    });
  };

  const privacyTag = (epsilon: number) => {
    if (epsilon < 2) return <Tag color="green">ε={epsilon} 安全</Tag>;
    if (epsilon < 3) return <Tag color="gold">ε={epsilon} 中等</Tag>;
    return <Tag color="red">ε={epsilon} 高风险</Tag>;
  };

  const filteredPriorityGroups = useMemo(() => {
    if (businessFilter === 'all') return priorityGroups;
    return priorityGroups.map((g) => ({
      ...g,
      items: g.items.filter((d) => !(d as any).business_source || (d as any).business_source === businessFilter),
    }));
  }, [priorityGroups, businessFilter]);

  const searchOptions = useMemo(() => {
    return datasetList
      .map((ds) => ({
        value: ds.name,
        label: (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>{ds.name}</span>
            <span style={{ color: '#999' }}>{ds.businessTag} | {ds.modality}</span>
          </div>
        ),
      }))
      .concat(
        datasetList.flatMap((ds) =>
          ds.businessTag.split('/').map((tag) => ({ value: tag.trim(), label: <span>标签: {tag.trim()}</span> }))
        )
      );
  }, [datasetList]);

  const datasetColumns: ColumnsType<DatasetItem> = [
    { title: '名称', dataIndex: 'name', key: 'name', width: 150, render: (t: string) => <span style={{ fontWeight: 500 }}>{t}</span> },
    { title: '模态', dataIndex: 'modality', key: 'modality', width: 80, render: (t: string) => <Tag>{t}</Tag> },
    { title: '业务标签', dataIndex: 'businessTag', key: 'businessTag', width: 90 },
    { title: '大小', dataIndex: 'size', key: 'size', width: 70 },
    {
      title: '隐私评分', dataIndex: 'privacyEpsilon', key: 'privacyEpsilon', width: 120,
      render: (v: number) => privacyTag(v),
    },
    { title: '关联数', dataIndex: 'relationCount', key: 'relationCount', width: 70, render: (v: number) => <Badge count={v} style={{ backgroundColor: '#1677ff' }} overflowCount={99} /> },
    {
      title: '操作', key: 'action', width: 100,
      render: (_: any, record: DatasetItem) => (
        <Button type="link" size="small" onClick={() => message.info(`调度训练: ${record.name}`)}>调度训练</Button>
      ),
    },
  ];

  const layeredColumns: ColumnsType<DemandItem> = [
    { title: '任务名称', dataIndex: 'task', key: 'task' },
    { title: 'CPU(核)', dataIndex: 'cpu', key: 'cpu', render: (v: number) => v.toFixed(2) },
    { title: '内存(GB)', dataIndex: 'memory', key: 'memory', render: (v: number) => v.toFixed(2) },
    { title: 'GPU(张)', dataIndex: 'gpu', key: 'gpu', render: (v: number) => v.toFixed(2) },
    { title: '存储(GB)', dataIndex: 'storage', key: 'storage', render: (v: number) => v.toFixed(2) },
    {
      title: '状态', dataIndex: 'status', key: 'status',
      render: (status: string) => {
        const colorMap: Record<string, string> = { 待分配: 'orange', 已分配: 'blue', 运行中: 'green', 已完成: 'default' };
        return <Tag color={colorMap[status] || 'default'}>{status}</Tag>;
      },
    },
    {
      title: '操作', key: 'action', width: 120,
      render: (_: any, record: DemandItem) => (
        <Tooltip title="跳转至调度中枢查看执行详情">
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => message.info(`查看 ${record.task} 分配详情`)}>
            查看分配详情
          </Button>
        </Tooltip>
      ),
    },
  ];

  const alertColumns: ColumnsType<ResourceAlert> = [
    {
      title: '级别', dataIndex: 'level', key: 'level', width: 80,
      render: (level: string) => level === 'critical'
        ? <Tag color="red" icon={<CloseCircleOutlined />}>严重</Tag>
        : <Tag color="orange" icon={<WarningOutlined />}>警告</Tag>,
    },
    { title: '节点', dataIndex: 'nodeName', key: 'nodeName' },
    { title: '指标', dataIndex: 'metric', key: 'metric' },
    { title: '当前值', dataIndex: 'value', key: 'value', render: (value: number) => <span style={{ fontWeight: 600 }}>{value}%</span> },
    { title: '阈值', dataIndex: 'threshold', key: 'threshold', render: (value: number) => <span>{value}%</span> },
    { title: '告警信息', dataIndex: 'message', key: 'message', ellipsis: true },
  ];

  const nodeLayeredColumns: ColumnsType<NodeItem> = [
    { title: '节点名称', dataIndex: 'node_name', key: 'node_name', width: 160 },
    { title: '节点ID', dataIndex: 'node_id', key: 'node_id', width: 180 },
    {
      title: '父超算', dataIndex: 'parent_supercomputing', key: 'parent_supercomputing', width: 200,
      render: (v: string) => v ? <Tag color="blue">{v}</Tag> : <Tag>-</Tag>,
    },
    {
      title: 'CPU', dataIndex: 'cpu_percent', key: 'cpu_percent', width: 80,
      render: (v: number) => <Tag color={v > 80 ? 'red' : v > 60 ? 'orange' : 'green'}>{v}%</Tag>,
    },
    {
      title: '内存', dataIndex: 'mem_percent', key: 'mem_percent', width: 80,
      render: (v: number) => <Tag color={v > 80 ? 'red' : v > 60 ? 'orange' : 'green'}>{v}%</Tag>,
    },
    {
      title: 'GPU', dataIndex: 'gpu_percent', key: 'gpu_percent', width: 80,
      render: (v: number) => <Tag color={v > 80 ? 'red' : v > 60 ? 'orange' : 'green'}>{v}%</Tag>,
    },
    {
      title: '磁盘', dataIndex: 'disk_percent', key: 'disk_percent', width: 80,
      render: (v: number) => <Tag color={v > 80 ? 'red' : v > 60 ? 'orange' : 'green'}>{v}%</Tag>,
    },
  ];

  const usageOption = useMemo(() => {
    const colors = ['#5470c6', '#91cc75', '#fac858', '#ee6666'];
    const total = usage.reduce((s, u) => s + u.value, 0) || 1;
    return {
      tooltip: {
        trigger: 'item',
        backgroundColor: 'rgba(10, 25, 50, 0.92)',
        borderColor: '#2f7bff',
        borderWidth: 1,
        textStyle: { color: '#fff' },
        formatter: (params: any) => `<strong>${params.name}</strong><br/>占比：${params.percent}%<br/>值：${params.value}`,
      },
      legend: { bottom: 0, textStyle: { color: '#000', fontSize: 12 }, itemWidth: 14, itemHeight: 8 },
      graphic: usage.length
        ? [
            { type: 'text', left: 'center', top: '38%', style: { text: total.toFixed(1), fontSize: 22, fontWeight: 'bold', fill: '#333', textAlign: 'center' } },
            { type: 'text', left: 'center', top: '50%', style: { text: '资源总量', fontSize: 12, fill: '#999', textAlign: 'center' } },
          ]
        : [],
      series: [{
        name: '资源占比', type: 'pie', radius: ['45%', '72%'], center: ['50%', '45%'], avoidLabelOverlap: true,
        itemStyle: { borderRadius: 6, borderColor: '#fff', borderWidth: 2 },
        label: { show: true, formatter: '{b}\n{d}%', fontSize: 12, color: '#333' },
        emphasis: { label: { show: true, fontSize: 14, fontWeight: 'bold' }, itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.2)' } },
        data: usage.map((u, i) => ({ name: u.name, value: u.value, itemStyle: { color: colors[i % colors.length] } })),
      }],
    };
  }, [usage]);

  const [predictSelectedDate, setPredictSelectedDate] = useState<string | null>(null);

  const predictActiveDate = useMemo(() => {
    if (predictSelectedDate) return predictSelectedDate;
    const today = new Date().toISOString().slice(0, 10);
    if (predictDates.includes(today)) return today;
    return predictDates.length > 0 ? predictDates[predictDates.length - 1] : null;
  }, [predictSelectedDate, predictDates]);

  const predictTrendOption = useMemo(() => {
    if (!predictTrend || !predictTrend.x?.length) {
      return {
        backgroundColor: 'transparent', tooltip: { trigger: 'axis' },
        legend: { top: 8, right: 10, textStyle: { color: '#000', fontSize: 12 } },
        grid: { top: 50, left: 55, right: 20, bottom: 40 },
        xAxis: { type: 'category', data: [], boundaryGap: false },
        yAxis: { type: 'value', name: '%', min: 0, max: 100 },
        series: [],
      };
    }
    const colors = ['#5470c6', '#91cc75', '#fac858'];
    const currentTimeIndex = predictTrend.currentTimeIndex ?? -1;
    const isToday = currentTimeIndex >= 0;
    const markLineData = isToday && currentTimeIndex < predictTrend.x.length
      ? [{ xAxis: predictTrend.x[currentTimeIndex], label: { formatter: '当前', color: '#ff4d4f', fontSize: 11, fontWeight: 'bold' }, lineStyle: { color: '#ff4d4f', width: 2, type: 'solid' } }]
      : [];
    const allSeries: any[] = [];
    const legendData: string[] = [];

    predictTrend.series.forEach((item: any, idx: number) => {
      const color = colors[idx] || '#5470c6';
      const fullData = item.data;
      if (isToday && currentTimeIndex < fullData.length - 1) {
        const solidName = item.name;
        const dashedName = `${item.name}（预测）`;
        const solidData = fullData.map((v: any, i: number) => i <= currentTimeIndex ? v : null);
        const dashedData = fullData.map((v: any, i: number) => i >= currentTimeIndex ? v : null);
        allSeries.push({
          name: solidName, type: 'line', smooth: true, symbol: 'circle', symbolSize: 5, showSymbol: true, connectNulls: false,
          lineStyle: { width: 2, color, type: 'solid' }, itemStyle: { color }, areaStyle: { opacity: 0.08 }, emphasis: { focus: 'series' },
          data: solidData, markLine: idx === 0 ? { silent: true, symbol: 'none', data: markLineData } : undefined,
        });
        allSeries.push({
          name: dashedName, type: 'line', smooth: true, symbol: 'circle', symbolSize: 4, showSymbol: true, connectNulls: false,
          lineStyle: { width: 2, color, type: 'dashed' }, itemStyle: { color }, emphasis: { focus: 'series' }, data: dashedData,
        });
        legendData.push(solidName, dashedName);
      } else {
        allSeries.push({
          name: item.name, type: 'line', smooth: true, symbol: 'circle', symbolSize: 5, showSymbol: true,
          lineStyle: { width: 2, color, type: 'solid' }, itemStyle: { color }, areaStyle: { opacity: 0.08 }, emphasis: { focus: 'series' },
          data: fullData,
        });
        legendData.push(item.name);
      }
    });

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis', backgroundColor: 'rgba(10, 25, 50, 0.92)', borderColor: '#2f7bff', borderWidth: 1, textStyle: { color: '#fff' },
        formatter: (params: any[]) => {
          if (!params || !params.length) return '';
          const time = params[0].axisValue;
          let html = `<div style="font-weight:600;margin-bottom:4px">${time}</div>`;
          const seen = new Map<string, any>();
          params.forEach((p: any) => {
            const baseName = p.seriesName.replace('（预测）', '');
            if (p.value != null && (!seen.has(baseName) || !p.seriesName.includes('预测'))) seen.set(baseName, p);
          });
          seen.forEach((p: any) => {
            html += `<div style="display:flex;align-items:center;gap:6px"><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${p.color}"></span><span>${p.seriesName}：${p.value}%</span></div>`;
          });
          return html;
        },
      },
      legend: { top: 8, right: 10, textStyle: { color: '#000', fontSize: 12 }, itemWidth: 14, itemHeight: 8, data: legendData },
      grid: { top: 50, left: 55, right: 20, bottom: 40 },
      xAxis: { type: 'category', boundaryGap: false, data: predictTrend.x, axisLine: { lineStyle: { color: 'rgba(120,180,255,0.35)' } }, axisLabel: { color: '#000', fontSize: 11, interval: 1 }, splitLine: { show: false } },
      yAxis: { type: 'value', name: '%', min: 0, max: 100, axisLine: { show: false }, axisLabel: { color: '#000', fontSize: 12 }, splitLine: { lineStyle: { color: 'rgba(120,180,255,0.12)', type: 'dashed' } } },
      series: allSeries,
    };
  }, [predictTrend]);

  const mapOption = useMemo(() => {
    const scatterData = mapData.map((item) => ({
      name: item.name, value: [item.longitude, item.latitude, item.capacity], raw: item,
    }));
    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item',
        formatter: (params: any) => {
          const raw = params?.data?.raw;
          if (!raw) return params.name || '';
          return `<div style="padding:6px 8px;"><div><strong>${raw.name}</strong></div><div>经度：${raw.longitude}</div><div>纬度：${raw.latitude}</div><div>算力值：${raw.capacity}</div><div>等级：${raw.level}</div></div>`;
        },
      },
      geo: {
        map: 'china', roam: true, zoom: 1.1,
        label: { show: false, color: '#b7dfff' },
        itemStyle: { areaColor: '#0b4f7a', borderColor: '#3ba0ff', borderWidth: 1, shadowColor: 'rgba(0, 174, 255, 0.35)', shadowBlur: 10 },
        emphasis: { label: { show: false }, itemStyle: { areaColor: '#166d9c' } },
      },
      series: [{
        name: '算力节点', type: 'scatter', coordinateSystem: 'geo', data: scatterData,
        symbolSize: (val: number[]) => Math.max((val[2] || 0) / 18, 8),
        label: { show: true, formatter: '{b}', position: 'right', color: '#ffffff', fontSize: 12 },
        itemStyle: { color: '#ffd84d', shadowBlur: 18, shadowColor: 'rgba(255, 216, 77, 0.8)' },
        emphasis: { label: { show: true, color: '#fff', fontWeight: 'bold' }, itemStyle: { color: '#ffe680' } },
      }],
    };
  }, [mapData]);

  const mapEvents = {
    click: (params: any) => {
      const raw = params?.data?.raw;
      if (raw) setSelectedMapNode(raw);
    },
  };

  const datasetStatsCards = useMemo(() => {
    const total = datasetList.length;
    const multimodal = datasetList.filter((d) => d.modality === '多模态').length;
    const structured = datasetList.filter((d) => d.modality === '结构化').length;
    const totalSize = datasetList.reduce((s, d) => s + parseFloat(d.size), 0);
    return { total, multimodal, structured, totalSize: (totalSize / 1024).toFixed(1) };
  }, [datasetList]);

  return (
    <div style={{ padding: 24, direction: 'ltr' }}>
      <Spin spinning={loading}>
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>算力任务运营调度平台</h2>
              <span style={{ fontSize: 12, color: '#999' }}>@中移动算网运营管理 · 任务运营调度员</span>
            </div>
            <Button type="primary" icon={<PlusOutlined />} size="large" onClick={() => setTaskModalVisible(true)}>
              + 录入算力任务需求
            </Button>
          </div>
        </div>

        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col span={6}>
            <Card variant="borderless" style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', borderRadius: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 14, marginBottom: 8 }}>全网任务总数</div>
                  <div style={{ color: '#fff', fontSize: 32, fontWeight: 700 }}>{stats.find(s => s.title === '全网任务总数')?.value ?? 0}</div>
                </div>
                <UnorderedListOutlined style={{ fontSize: 40, color: 'rgba(255,255,255,0.35)' }} />
              </div>
            </Card>
          </Col>
          <Col span={6}>
            <Card variant="borderless" style={{ background: 'linear-gradient(135deg, #1677ff 0%, #0958d9 100%)', borderRadius: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 14, marginBottom: 8 }}>运行中</div>
                  <div style={{ color: '#fff', fontSize: 32, fontWeight: 700 }}>{stats.find(s => s.title === '运行中')?.value ?? 0}</div>
                </div>
                <PlayCircleOutlined style={{ fontSize: 40, color: 'rgba(255,255,255,0.35)' }} />
              </div>
            </Card>
          </Col>
          <Col span={6}>
            <Card variant="borderless" style={{ background: 'linear-gradient(135deg, #52c41a 0%, #389e0d 100%)', borderRadius: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 14, marginBottom: 8 }}>全网空闲算力</div>
                  <div style={{ color: '#fff', fontSize: 28, fontWeight: 700 }}>{stats.find(s => s.title === '全网空闲算力')?.value ?? '0 节点'}</div>
                </div>
                <LaptopOutlined style={{ fontSize: 40, color: 'rgba(255,255,255,0.35)' }} />
              </div>
            </Card>
          </Col>
          <Col span={6}>
            <Card variant="borderless" style={{ background: 'linear-gradient(135deg, #fa8c16 0%, #d46b08 100%)', borderRadius: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 14, marginBottom: 8 }}>全网资源利用率</div>
                  <div style={{ color: '#fff', fontSize: 32, fontWeight: 700 }}>{stats.find(s => s.title === '全网资源利用率')?.value ?? '0%'}</div>
                </div>
                <DashboardOutlined style={{ fontSize: 40, color: 'rgba(255,255,255,0.35)' }} />
              </div>
            </Card>
          </Col>
        </Row>

        {alerts.length > 0 && (
          <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
            <Col span={24}>
              {alerts.some(a => a.level === 'critical') ? (
                <Alert
                  message={
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span>检测到 <strong>{alerts.filter(a => a.level === 'critical').length}</strong> 个严重告警，请立即处理！（警告 {alerts.filter(a => a.level === 'warning').length} 条）</span>
                      <Button type="primary" danger size="small" onClick={() => setAlertPanelVisible(true)}>点击查看</Button>
                    </div>
                  }
                  type="error" showIcon icon={<CloseCircleOutlined />}
                />
              ) : (
                <Alert
                  message={
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span>检测到 {alerts.filter(a => a.level === 'warning').length} 个资源警告</span>
                      <Button type="default" size="small" onClick={() => setAlertPanelVisible(true)}>点击查看</Button>
                    </div>
                  }
                  type="warning" showIcon icon={<WarningOutlined />}
                />
              )}
            </Col>
          </Row>
        )}

        <Drawer
          title={
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <BellOutlined style={{ color: alerts.some(a => a.level === 'critical') ? '#cf1322' : '#d46b08' }} />
              <span>资源告警详情</span>
              <Badge count={alerts.filter(a => a.level === 'critical').length} style={{ backgroundColor: '#cf1322' }} overflowCount={9999} />
              <Badge count={alerts.filter(a => a.level === 'warning').length} style={{ backgroundColor: '#d46b08' }} overflowCount={9999} />
            </div>
          }
          placement="right" width={720} open={alertPanelVisible} onClose={() => setAlertPanelVisible(false)}
        >
          <Table rowKey="id" columns={alertColumns} dataSource={alerts} pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (total) => `共 ${total} 条告警` }} size="small" />
        </Drawer>

        {/* 算力网络数据资产管理 */}
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col span={24}>
            <Card
              title={
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <DatabaseOutlined style={{ color: '#1677ff' }} />
                  <span style={{ fontWeight: 600, fontSize: 16 }}>算力网络数据资产管理</span>
                </span>
              }
              variant="borderless"
            >
              <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
                <Col span={6}>
                  <Card size="small" variant="borderless" style={{ background: '#f0f5ff', borderRadius: 8, textAlign: 'center' }}>
                    <div style={{ color: '#666', fontSize: 12 }}>接入数据集</div>
                    <div style={{ color: '#1677ff', fontSize: 28, fontWeight: 700 }}>{datasetStatsCards.total}</div>
                  </Card>
                </Col>
                <Col span={6}>
                  <Card size="small" variant="borderless" style={{ background: '#fff7e6', borderRadius: 8, textAlign: 'center' }}>
                    <div style={{ color: '#666', fontSize: 12 }}>多模态</div>
                    <div style={{ color: '#fa8c16', fontSize: 28, fontWeight: 700 }}>{datasetStatsCards.multimodal}</div>
                  </Card>
                </Col>
                <Col span={6}>
                  <Card size="small" variant="borderless" style={{ background: '#f6ffed', borderRadius: 8, textAlign: 'center' }}>
                    <div style={{ color: '#666', fontSize: 12 }}>结构化</div>
                    <div style={{ color: '#52c41a', fontSize: 28, fontWeight: 700 }}>{datasetStatsCards.structured}</div>
                  </Card>
                </Col>
                <Col span={6}>
                  <Card size="small" variant="borderless" style={{ background: '#fff1f0', borderRadius: 8, textAlign: 'center' }}>
                    <div style={{ color: '#666', fontSize: 12 }}>总容量</div>
                    <div style={{ color: '#f5222d', fontSize: 28, fontWeight: 700 }}>{datasetStatsCards.totalSize} TB</div>
                  </Card>
                </Col>
              </Row>

              <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                <Button icon={<PlusOutlined />} onClick={handleImportDataset}>接入新数据集</Button>
                <AutoComplete
                  style={{ flex: 1 }}
                  options={searchOptions}
                  placeholder="全息索引检索 - 搜索数据集名称或标签..."
                  filterOption={(input, option) => (option?.value as string)?.toLowerCase().includes(input.toLowerCase())}
                  suffixIcon={<SearchOutlined />}
                />
              </div>

              <div style={{ marginBottom: 16 }}>
                <div style={{ fontWeight: 600, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <LinkOutlined /> 数据集关联分析图（力导向图，边权 = 相关度）
                </div>
                <div
                  ref={relationGraphRef}
                  style={{ width: '100%', height: 360, border: '1px solid #f0f0f0', borderRadius: 8, background: '#fafafa' }}
                />
              </div>

              <div>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>数据集列表</div>
                <Table
                  rowKey="id"
                  columns={datasetColumns}
                  dataSource={datasetList}
                  pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (total) => `共 ${total} 个数据集` }}
                  size="small"
                  scroll={{ y: 400 }}
                />
              </div>
            </Card>
          </Col>
        </Row>

        {/* 图表区域 */}
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col span={12}>
            <Card title="算力中心能力视图" variant="borderless">
              <ReactECharts option={usageOption} style={{ height: 320 }} />
            </Card>
          </Col>
          <Col span={12}>
            <Card title="全国算力节点分布" variant="borderless">
              <ReactECharts option={mapOption} style={{ height: 320 }} />
            </Card>
          </Col>
        </Row>

        {/* 算力任务需求分层视图 */}
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col span={24}>
            <Card
              title="算力任务需求分层视图"
              variant="borderless"
              extra={
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ color: '#999', fontSize: 12 }}>按业务方筛选：</span>
                  <Select
                    value={businessFilter}
                    onChange={setBusinessFilter}
                    style={{ width: 160 }}
                    size="small"
                    options={[
                      { value: 'all', label: '全部' },
                      ...BUSINESS_SOURCES.map((s) => ({ value: s, label: s })),
                    ]}
                  />
                </div>
              }
            >
              <Collapse
                defaultActiveKey={filteredPriorityGroups.map((g) => g.level)}
                expandIconPosition="start"
                items={filteredPriorityGroups.map((group: PriorityGroup) => ({
                  key: group.level,
                  label: (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ fontSize: 16 }}>{group.icon}</span>
                      <span style={{ fontWeight: 600, color: group.color, fontSize: 15 }}>{group.label}</span>
                      <Badge count={group.items.length} style={{ backgroundColor: group.color }} overflowCount={9999} />
                      <span style={{ color: '#999', fontSize: 12, marginLeft: 8 }}>
                        CPU {group.totalCpu.toFixed(2)} 核 | 内存 {group.totalMemory.toFixed(2)} GB | GPU {group.totalGpu.toFixed(2)} 张 | 存储 {group.totalStorage.toFixed(2)} GB
                      </span>
                    </div>
                  ),
                  children: (
                    <Table
                      rowKey="id"
                      columns={layeredColumns}
                      dataSource={group.items}
                      pagination={{ pageSize: 5, size: 'small', showSizeChanger: false, showTotal: (total) => `共 ${total} 条` }}
                      size="small"
                      style={{ borderLeft: `3px solid ${group.color}`, borderRadius: 4 }}
                    />
                  ),
                  style: { marginBottom: 8, borderColor: group.borderColor, backgroundColor: group.bgColor, borderRadius: 8 },
                }))}
              />
            </Card>
          </Col>
        </Row>

        {/* 全网算力节点资源详情 */}
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col span={24}>
            <Card
              title="全网算力节点资源详情"
              variant="borderless"
              extra={
                <Checkbox checked={showActiveOnly} onChange={(e) => setShowActiveOnly(e.target.checked)}>
                  只看活跃节点（CPU或GPU &gt; 0%）
                </Checkbox>
              }
            >
              <Collapse
                defaultActiveKey={nodeStatusGroups.map((g) => g.status)}
                expandIconPosition="start"
                items={nodeStatusGroups.map((group: NodeStatusGroup) => {
                  const filteredItems = showActiveOnly
                    ? group.items.filter((n) => n.cpu_percent > 0 || n.gpu_percent > 0)
                    : group.items;
                  return {
                    key: group.status,
                    label: (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span style={{ fontSize: 16 }}>{group.icon}</span>
                        <span style={{ fontWeight: 600, color: group.color, fontSize: 15 }}>{group.label}</span>
                        <Badge count={filteredItems.length} style={{ backgroundColor: group.color }} overflowCount={9999} />
                        <span style={{ color: '#999', fontSize: 12, marginLeft: 8 }}>
                          平均 CPU {group.avgCpu}% | 平均内存 {group.avgMem}% | 平均 GPU {group.avgGpu}% | 平均磁盘 {group.avgDisk}%
                        </span>
                      </div>
                    ),
                    children: (
                      <Table
                        rowKey="node_id"
                        columns={nodeLayeredColumns}
                        dataSource={filteredItems}
                        pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (total) => `共 ${total} 条` }}
                        size="small"
                        scroll={{ y: 400, x: 900 }}
                        virtual
                        style={{ borderLeft: `3px solid ${group.color}`, borderRadius: 4 }}
                      />
                    ),
                    style: { marginBottom: 8, borderColor: group.borderColor, backgroundColor: group.bgColor, borderRadius: 8 },
                  };
                })}
              />
            </Card>
          </Col>
        </Row>

        {/* 全网多维资源使用趋势 */}
        <Row gutter={[16, 16]}>
          <Col span={24}>
            <Card
              title={
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span>全网多维资源使用趋势</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {predictActiveDate && <Tag color="blue" style={{ fontSize: 12 }}>当前查看：{predictActiveDate}</Tag>}
                    <DatePicker
                      value={predictActiveDate ? dayjs(predictActiveDate, 'YYYY-MM-DD') : null}
                      onChange={(_date, dateString) => {
                        const d = typeof dateString === 'string' ? dateString : dateString[0];
                        if (d) { setPredictSelectedDate(d); fetchPredictTrend(d); }
                      }}
                      disabledDate={(current) => !current || !predictDates.includes(current.format('YYYY-MM-DD'))}
                      allowClear={false} size="small" style={{ width: 160 }} placeholder="选择日期查询"
                    />
                  </div>
                </span>
              }
              variant="borderless"
            >
              <Spin spinning={predictLoading} tip="加载预测数据中...">
                <ReactECharts option={predictTrendOption} style={{ height: 420 }} notMerge={true} />
              </Spin>
              <div style={{ marginTop: 8, display: 'flex', justifyContent: 'center', gap: 24, fontSize: 12, color: '#999' }}>
                <span><span style={{ display: 'inline-block', width: 24, height: 2, backgroundColor: '#5470c6', verticalAlign: 'middle', marginRight: 4 }} />CPU 利用率</span>
                <span><span style={{ display: 'inline-block', width: 24, height: 2, backgroundColor: '#91cc75', verticalAlign: 'middle', marginRight: 4 }} />内存利用率</span>
                <span><span style={{ display: 'inline-block', width: 24, height: 2, backgroundColor: '#fac858', verticalAlign: 'middle', marginRight: 4 }} />GPU 利用率</span>
                <span><span style={{ display: 'inline-block', width: 24, height: 2, backgroundColor: '#999', verticalAlign: 'middle', marginRight: 4 }} />实线 = 已发生</span>
                <span><span style={{ display: 'inline-block', width: 24, height: 2, borderTop: '2px dashed #999', verticalAlign: 'middle', marginRight: 4 }} />虚线 = 预测</span>
                <span><span style={{ display: 'inline-block', width: 2, height: 12, backgroundColor: '#ff4d4f', verticalAlign: 'middle', marginRight: 4 }} />当前时间</span>
                <span>每10秒刷新</span>
              </div>
            </Card>
          </Col>
        </Row>
      </Spin>

      {/* 录入算力任务需求弹窗 */}
      <Modal
        title="录入算力任务需求"
        open={taskModalVisible}
        onCancel={() => { setTaskModalVisible(false); taskForm.resetFields(); }}
        width={640}
        footer={[
          <Button key="cancel" onClick={() => { setTaskModalVisible(false); taskForm.resetFields(); }}>取消</Button>,
          <Button key="submit" type="primary" icon={<SendOutlined />} onClick={handleTaskSubmit}>提交至调度中枢</Button>,
        ]}
      >
        <Form form={taskForm} layout="vertical" initialValues={{ priority: '中', noniid_alpha: 0.5, privacy_epsilon: 2.0, aggregation: 'auto' }}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="任务编号" name="task_id">
                <Input placeholder={`task-fedtrain-${Math.floor(Math.random() * 90000 + 10000)}`} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="业务标签" name="task_name">
                <Select placeholder="联邦训练-图神经网络" options={[
                  { value: '联邦训练-图神经网络', label: '联邦训练-图神经网络' },
                  { value: '联邦训练-LSTM', label: '联邦训练-LSTM' },
                  { value: '联邦训练-Transformer', label: '联邦训练-Transformer' },
                  { value: '联合推理-风控模型', label: '联合推理-风控模型' },
                  { value: '数据融合-反欺诈', label: '数据融合-反欺诈' },
                ]} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="发起业务方" name="business_source" rules={[{ required: true, message: '请选择业务方' }]}>
                <Select placeholder="反欺诈中心" options={BUSINESS_SOURCES.map((s) => ({ value: s, label: s }))} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="模型类型" name="model_type">
                <Select placeholder="GNN" options={[
                  { value: 'GNN', label: 'GNN' },
                  { value: 'LSTM', label: 'LSTM' },
                  { value: 'Transformer', label: 'Transformer' },
                  { value: 'CNN', label: 'CNN' },
                ]} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item label="数据集选择" name="dataset">
            <Checkbox.Group>
              <Row>
                {MOCK_DATASETS.slice(0, 8).map((ds) => {
                  const rel = MOCK_RELATIONS.find((r) => r.source === ds.id || r.target === ds.id);
                  return (
                    <Col span={12} key={ds.id} style={{ marginBottom: 4 }}>
                      <Checkbox value={ds.id}>
                        {ds.name} {rel ? `(关联度 ${rel.weight})` : ''}
                      </Checkbox>
                    </Col>
                  );
                })}
              </Row>
            </Checkbox.Group>
          </Form.Item>

          <Form.Item label="优先级" name="priority">
            <Radio.Group>
              <Radio value="高">高</Radio>
              <Radio value="中">中</Radio>
              <Radio value="低">低</Radio>
            </Radio.Group>
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label={`非 IID 程度 (α): ${taskForm.getFieldValue('noniid_alpha') || 0.5}`} name="noniid_alpha">
                <Slider min={0.1} max={1.0} step={0.1} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label={`隐私预算 ε: ${taskForm.getFieldValue('privacy_epsilon') || 2.0}`} name="privacy_epsilon">
                <Slider min={0.5} max={10} step={0.5} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item label="期望聚合算法" name="aggregation">
            <Radio.Group>
              <Radio value="auto">系统智能选择</Radio>
              <Radio value="FedAvg">FedAvg</Radio>
              <Radio value="Bulyan">Bulyan</Radio>
            </Radio.Group>
          </Form.Item>

          <div style={{ background: '#f0f5ff', padding: 12, borderRadius: 8, marginBottom: 8 }}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>预估算力消耗</div>
            <div>CPU 16 核 · GPU 4 张 · 内存 64 GB</div>
            <div style={{ fontWeight: 600, marginTop: 8, marginBottom: 4 }}>预估训练时长</div>
            <div>8 小时</div>
          </div>
        </Form>
      </Modal>

      {/* 接入新数据集弹窗 */}
      <Modal
        title="接入新数据集"
        open={importModalVisible}
        onCancel={() => { if (!importing) setImportModalVisible(false); }}
        footer={null}
        width={400}
      >
        <div style={{ textAlign: 'center', padding: '24px 0' }}>
          <Progress type="circle" percent={importProgress} status={importing ? 'active' : importProgress >= 100 ? 'success' : 'normal'} />
          <div style={{ marginTop: 16, color: '#666' }}>
            {importing ? '正在接入数据集...' : '数据集接入完成！'}
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default TaskManagement;

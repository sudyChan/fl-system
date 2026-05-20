import React, { useMemo, useEffect, useState } from 'react';
import { Card, Col, Row, Table, Tag, Spin, DatePicker, Collapse, Badge, Alert, Button, Checkbox, Drawer } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  UnorderedListOutlined,
  PlayCircleOutlined,
  LaptopOutlined,
  DashboardOutlined,
  WarningOutlined,
  CloseCircleOutlined,
  BellOutlined,
} from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import * as echarts from 'echarts';
import dayjs from 'dayjs';
import chinaJson from '@/assets/maps/china.json';
import useTaskManagementData from './hooks';
import { DemandItem, NodeItem ,MapNodeItem, PriorityGroup, NodeStatusGroup, ResourceAlert } from './types';

/**
 * 算力任务需求管理页面
 * 功能模块：
 * 1. 顶部统计概览
 * 2. 算力需求管理视图
 * 3. 算力中心能力视图（资源占比）
 * 4. 节点资源详情
 * 5. 多维资源动态管理
 * 6. 节点分布（当前使用安全版散点图替代地图）
 */
const TaskManagement: React.FC = () => {
  const { loading, demands, nodes, stats, usage, trend, mapData, priorityGroups, nodeStatusGroups, alerts } =
    useTaskManagementData();
  /**
   * 当前选中的地图节点
   * 用于点击地图节点后展示详情
   */
  const [selectedMapNode,setSelectedMapNode] = useState<MapNodeItem | null>(null);
  const [alertPanelVisible, setAlertPanelVisible] = useState(false);
  const [showActiveOnly, setShowActiveOnly] = useState(false);

  /**
   * 注册中国地图GeoJSON，页面初始化时执行一次
   */
  useEffect(()=>{
    echarts.registerMap('china',chinaJson as any);
  },[]);

  /**
   * 任务需求表格列定义
   */
  const demandColumns: ColumnsType<DemandItem> = [
    {
      title: '任务名称',
      dataIndex: 'task',
      key: 'task',
    },
    {
      title: 'CPU(核)',
      dataIndex: 'cpu',
      key: 'cpu',
      render: (v: number) => v.toFixed(2),
    },
    {
      title: '内存(GB)',
      dataIndex: 'memory',
      key: 'memory',
      render: (v: number) => v.toFixed(2),
    },
    {
      title: 'GPU(张)',
      dataIndex: 'gpu',
      key: 'gpu',
      render: (v: number) => v.toFixed(2),
    },
    {
      title: '存储(GB)',
      dataIndex: 'storage',
      key: 'storage',
      render: (v: number) => v.toFixed(2),
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      key: 'priority',
      render: (priority: string) => {
        const colorMap: Record<string, string> = {
          高: 'red',
          中: 'orange',
          低: 'green',
        };
        return <Tag color={colorMap[priority] || 'default'}>{priority}</Tag>;
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const colorMap: Record<string, string> = {
          待分配: 'orange',
          已分配: 'blue',
          运行中: 'green',
          已完成: 'default',
        };
        return <Tag color={colorMap[status] || 'default'}>{status}</Tag>;
      },
    },
  ];

  const layeredColumns: ColumnsType<DemandItem> = [
    {
      title: '任务名称',
      dataIndex: 'task',
      key: 'task',
    },
    {
      title: 'CPU(核)',
      dataIndex: 'cpu',
      key: 'cpu',
      render: (v: number) => v.toFixed(2),
    },
    {
      title: '内存(GB)',
      dataIndex: 'memory',
      key: 'memory',
      render: (v: number) => v.toFixed(2),
    },
    {
      title: 'GPU(张)',
      dataIndex: 'gpu',
      key: 'gpu',
      render: (v: number) => v.toFixed(2),
    },
    {
      title: '存储(GB)',
      dataIndex: 'storage',
      key: 'storage',
      render: (v: number) => v.toFixed(2),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const colorMap: Record<string, string> = {
          待分配: 'orange',
          已分配: 'blue',
          运行中: 'green',
          已完成: 'default',
        };
        return <Tag color={colorMap[status] || 'default'}>{status}</Tag>;
      },
    },
  ];

  const alertColumns: ColumnsType<ResourceAlert> = [
    {
      title: '级别',
      dataIndex: 'level',
      key: 'level',
      width: 80,
      render: (level: string) =>
        level === 'critical' ? (
          <Tag color="red" icon={<CloseCircleOutlined />}>严重</Tag>
        ) : (
          <Tag color="orange" icon={<WarningOutlined />}>警告</Tag>
        ),
    },
    {
      title: '节点',
      dataIndex: 'nodeName',
      key: 'nodeName',
    },
    {
      title: '指标',
      dataIndex: 'metric',
      key: 'metric',
    },
    {
      title: '当前值',
      dataIndex: 'value',
      key: 'value',
      render: (value: number) => <span style={{ fontWeight: 600 }}>{value}%</span>,
    },
    {
      title: '阈值',
      dataIndex: 'threshold',
      key: 'threshold',
      render: (value: number) => <span>{value}%</span>,
    },
    {
      title: '告警信息',
      dataIndex: 'message',
      key: 'message',
      ellipsis: true,
    },
  ];

  /**
   * 节点资源详情表格列定义
   * 注意：字段名称必须与后端接口 /api/resources/nodes 返回一致
   */
  const nodeColumns: ColumnsType<NodeItem> = [
    {
      title: '节点名称',
      dataIndex: 'node_name',
      key: 'node_name',
    },
    {
      title: '节点ID',
      dataIndex: 'node_id',
      key: 'node_id',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const colorMap: Record<string, string> = {
          online: 'green',
          warning: 'orange',
          offline: 'red',
        };
        return <Tag color={colorMap[status] || 'default'}>{status}</Tag>;
      },
    },
    {
      title: 'CPU',
      dataIndex: 'cpu_percent',
      key: 'cpu_percent',
      render: (value: number) => (
        <Tag color={value > 80 ? 'red' : value > 60 ? 'orange' : 'green'}>
          {value}%
        </Tag>
      ),
    },
    {
      title: '内存',
      dataIndex: 'mem_percent',
      key: 'mem_percent',
      render: (value: number) => (
        <Tag color={value > 80 ? 'red' : value > 60 ? 'orange' : 'green'}>
          {value}%
        </Tag>
      ),
    },
    {
      title: 'GPU',
      dataIndex: 'gpu_percent',
      key: 'gpu_percent',
      render: (value: number) => (
        <Tag color={value > 80 ? 'red' : value > 60 ? 'orange' : 'green'}>
          {value}%
        </Tag>
      ),
    },
    {
      title: '磁盘',
      dataIndex: 'disk_percent',
      key: 'disk_percent',
      render: (value: number) => (
        <Tag color={value > 80 ? 'red' : value > 60 ? 'orange' : 'green'}>
          {value}%
        </Tag>
      ),
    },
  ];

  const nodeLayeredColumns: ColumnsType<NodeItem> = [
    {
      title: '节点名称',
      dataIndex: 'node_name',
      key: 'node_name',
    },
    {
      title: '节点ID',
      dataIndex: 'node_id',
      key: 'node_id',
    },
    {
      title: 'CPU',
      dataIndex: 'cpu_percent',
      key: 'cpu_percent',
      render: (value: number) => (
        <Tag color={value > 80 ? 'red' : value > 60 ? 'orange' : 'green'}>
          {value}%
        </Tag>
      ),
    },
    {
      title: '内存',
      dataIndex: 'mem_percent',
      key: 'mem_percent',
      render: (value: number) => (
        <Tag color={value > 80 ? 'red' : value > 60 ? 'orange' : 'green'}>
          {value}%
        </Tag>
      ),
    },
    {
      title: 'GPU',
      dataIndex: 'gpu_percent',
      key: 'gpu_percent',
      render: (value: number) => (
        <Tag color={value > 80 ? 'red' : value > 60 ? 'orange' : 'green'}>
          {value}%
        </Tag>
      ),
    },
    {
      title: '磁盘',
      dataIndex: 'disk_percent',
      key: 'disk_percent',
      render: (value: number) => (
        <Tag color={value > 80 ? 'red' : value > 60 ? 'orange' : 'green'}>
          {value}%
        </Tag>
      ),
    },
  ];

  /**
   * 资源占比图配置
   */
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
        formatter: (params: any) =>
          `<strong>${params.name}</strong><br/>占比：${params.percent}%<br/>值：${params.value}`,
      },
      legend: {
        bottom: 0,
        textStyle: { color: '#000', fontSize: 12 },
        itemWidth: 14,
        itemHeight: 8,
      },
      graphic: usage.length
        ? [
            {
              type: 'text',
              left: 'center',
              top: '38%',
              style: {
                text: total.toFixed(1),
                fontSize: 22,
                fontWeight: 'bold',
                fill: '#333',
                textAlign: 'center',
              },
            },
            {
              type: 'text',
              left: 'center',
              top: '50%',
              style: {
                text: '资源总量',
                fontSize: 12,
                fill: '#999',
                textAlign: 'center',
              },
            },
          ]
        : [],
      series: [
        {
          name: '资源占比',
          type: 'pie',
          radius: ['45%', '72%'],
          center: ['50%', '45%'],
          avoidLabelOverlap: true,
          itemStyle: {
            borderRadius: 6,
            borderColor: '#fff',
            borderWidth: 2,
          },
          label: {
            show: true,
            formatter: '{b}\n{d}%',
            fontSize: 12,
            color: '#333',
          },
          emphasis: {
            label: { show: true, fontSize: 14, fontWeight: 'bold' },
            itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.2)' },
          },
          data: usage.map((u, i) => ({
            name: u.name,
            value: u.value,
            itemStyle: { color: colors[i % colors.length] },
          })),
        },
      ],
    };
  }, [usage]);

  const availableDates = useMemo(() => {
    return Array.from(trend.dailyDetailMap.keys()).sort();
  }, [trend]);

  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const activeDate = useMemo(() => {
    if (selectedDate && trend.dailyDetailMap.has(selectedDate)) return selectedDate;
    return availableDates.length > 0 ? availableDates[availableDates.length - 1] : null;
  }, [selectedDate, trend, availableDates]);

  const currentTrend = useMemo(() => {
    if (activeDate && trend.dailyDetailMap.has(activeDate)) {
      return trend.dailyDetailMap.get(activeDate)!;
    }
    return { x: [], series: [] };
  }, [activeDate, trend]);

  const trendOption = useMemo(() => {
    const data = currentTrend;
    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(10, 25, 50, 0.92)',
        borderColor: '#2f7bff',
        borderWidth: 1,
        textStyle: { color: '#fff' },
      },
      legend: {
        top: 8,
        right: 10,
        textStyle: { color: '#000', fontSize: 12 },
        itemWidth: 14,
        itemHeight: 8,
        data: data?.series?.map((item: any) => item.name) || [],
      },
      grid: { top: 50, left: 55, right: 20, bottom: 40 },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: data?.x || [],
        axisLine: { lineStyle: { color: 'rgba(120,180,255,0.35)' } },
        axisLabel: {
          color: '#000',
          fontSize: 11,
          interval: 1,
        },
        splitLine: { show: false },
      },
      yAxis: {
        type: 'value',
        name: '%',
        min: 0,
        max: 100,
        axisLine: { show: false },
        axisLabel: { color: '#000', fontSize: 12 },
        splitLine: {
          lineStyle: { color: 'rgba(120,180,255,0.12)', type: 'dashed' },
        },
      },
      series:
        data?.series?.map((item: any, idx: number) => {
          const colors = ['#5470c6', '#91cc75', '#fac858'];
          return {
            name: item.name,
            type: 'line',
            smooth: true,
            symbol: 'circle',
            symbolSize: 4,
            showSymbol: true,
            lineStyle: { width: 2, color: colors[idx] || undefined },
            itemStyle: { color: colors[idx] || undefined },
            areaStyle: { opacity: 0.08 },
            emphasis: { focus: 'series' },
            data: item.data || [],
          };
        }) || [],
    };
  }, [currentTrend]);

  /**
   * 全国算力节点分布地图配置
   *
   * 功能：
   * 1. 绘制中国地图底图
   * 2. 展示全国算力节点散点
   * 3. 节点名称标签显示
   * 4. 鼠标悬浮显示节点信息
   * 5. 点击节点后在右侧展示经纬度详情
   */
  const mapOption = useMemo(() => {
    const scatterData = mapData.map((item) => ({
      name: item.name,
      value: [item.longitude, item.latitude, item.capacity],
      raw: item,
    }));

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item',
        formatter: (params: any) => {
          const raw = params?.data?.raw;
          if (!raw) return params.name || '';

          return `
            <div style="padding: 6px 8px;">
              <div><strong>${raw.name}</strong></div>
              <div>经度：${raw.longitude}</div>
              <div>纬度：${raw.latitude}</div>
              <div>算力值：${raw.capacity}</div>
              <div>等级：${raw.level}</div>
            </div>
          `;
        },
      },
      geo: {
        map: 'china',
        roam: true,
        zoom: 1.1,
        label: {
          show: false,
          color: '#b7dfff',
        },
        itemStyle: {
          areaColor: '#0b4f7a',
          borderColor: '#3ba0ff',
          borderWidth: 1,
          shadowColor: 'rgba(0, 174, 255, 0.35)',
          shadowBlur: 10,
        },
        emphasis: {
          label: {
            show: false,
          },
          itemStyle: {
            areaColor: '#166d9c',
          },
        },
      },
      series: [
        {
          name: '算力节点',
          type: 'scatter',
          coordinateSystem: 'geo',
          data: scatterData,
          symbolSize: (val: number[]) => {
            const capacity = val[2] || 0;
            return Math.max(capacity / 18, 8);
          },
          label: {
            show: true,
            formatter: '{b}',
            position: 'right',
            color: '#ffffff',
            fontSize: 12,
          },
          itemStyle: {
            color: '#ffd84d',
            shadowBlur: 18,
            shadowColor: 'rgba(255, 216, 77, 0.8)',
          },
          emphasis: {
            label: {
              show: true,
              color: '#fff',
              fontWeight: 'bold',
            },
            itemStyle: {
              color: '#ffe680',
            },
          },
        },
      ],
    };
  }, [mapData]);
  /**
   * 地图点击事件
   * 点击节点后，记录当前节点详情
   */
  const mapEvents = {
    click: (params: any) => {
      const raw = params?.data?.raw;
      if (raw) {
        setSelectedMapNode(raw);
      }
    },
  };

  return (
    <div
      style={{
        padding: 24,
        direction: 'ltr', // 强制页面使用正常左到右布局，避免全局样式污染
      }}
    >
      <Spin spinning={loading}>
        {/* 顶部统计概览 */}
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col span={6}>
            <Card
              variant="borderless"
              className="stat-card"
              style={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                borderRadius: 12,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 14, marginBottom: 8 }}>任务总数</div>
                  <div style={{ color: '#fff', fontSize: 32, fontWeight: 700 }}>
                    {stats.find(s => s.title === '任务总数')?.value ?? 0}
                  </div>
                </div>
                <UnorderedListOutlined style={{ fontSize: 40, color: 'rgba(255,255,255,0.35)' }} />
              </div>
            </Card>
          </Col>
          <Col span={6}>
            <Card
              variant="borderless"
              className="stat-card"
              style={{
                background: 'linear-gradient(135deg, #1677ff 0%, #0958d9 100%)',
                borderRadius: 12,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 14, marginBottom: 8 }}>运行中任务</div>
                  <div style={{ color: '#fff', fontSize: 32, fontWeight: 700 }}>
                    {stats.find(s => s.title === '运行中任务')?.value ?? 0}
                  </div>
                </div>
                <PlayCircleOutlined style={{ fontSize: 40, color: 'rgba(255,255,255,0.35)' }} />
              </div>
            </Card>
          </Col>
          <Col span={6}>
            <Card
              variant="borderless"
              className="stat-card"
              style={{
                background: 'linear-gradient(135deg, #52c41a 0%, #389e0d 100%)',
                borderRadius: 12,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 14, marginBottom: 8 }}>空闲节点</div>
                  <div style={{ color: '#fff', fontSize: 32, fontWeight: 700 }}>
                    {stats.find(s => s.title === '空闲节点')?.value ?? 0}
                  </div>
                </div>
                <LaptopOutlined style={{ fontSize: 40, color: 'rgba(255,255,255,0.35)' }} />
              </div>
            </Card>
          </Col>
          <Col span={6}>
            <Card
              variant="borderless"
              className="stat-card"
              style={{
                background: 'linear-gradient(135deg, #fa8c16 0%, #d46b08 100%)',
                borderRadius: 12,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 14, marginBottom: 8 }}>资源利用率</div>
                  <div style={{ color: '#fff', fontSize: 32, fontWeight: 700 }}>
                    {stats.find(s => s.title === '资源利用率')?.value ?? '0%'}
                  </div>
                </div>
                <DashboardOutlined style={{ fontSize: 40, color: 'rgba(255,255,255,0.35)' }} />
              </div>
            </Card>
          </Col>
        </Row>

        {/* 资源告警面板 */}
        {alerts.length > 0 && (
          <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
            <Col span={24}>
              {alerts.some(a => a.level === 'critical') ? (
                <Alert
                  message={
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span>
                        检测到 <strong>{alerts.filter(a => a.level === 'critical').length}</strong> 个严重告警，请立即处理！
                        （警告 {alerts.filter(a => a.level === 'warning').length} 条）
                      </span>
                      <Button type="primary" danger size="small" onClick={() => setAlertPanelVisible(true)}>
                        点击查看
                      </Button>
                    </div>
                  }
                  type="error"
                  showIcon
                  icon={<CloseCircleOutlined />}
                />
              ) : (
                <Alert
                  message={
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span>检测到 {alerts.filter(a => a.level === 'warning').length} 个资源警告</span>
                      <Button type="default" size="small" onClick={() => setAlertPanelVisible(true)}>
                        点击查看
                      </Button>
                    </div>
                  }
                  type="warning"
                  showIcon
                  icon={<WarningOutlined />}
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
              <Badge
                count={alerts.filter(a => a.level === 'critical').length}
                style={{ backgroundColor: '#cf1322' }}
                overflowCount={9999}
              />
              <Badge
                count={alerts.filter(a => a.level === 'warning').length}
                style={{ backgroundColor: '#d46b08' }}
                overflowCount={9999}
              />
            </div>
          }
          placement="right"
          width={720}
          open={alertPanelVisible}
          onClose={() => setAlertPanelVisible(false)}
        >
          <Table
            rowKey="id"
            columns={alertColumns}
            dataSource={alerts}
            pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (total) => `共 ${total} 条告警` }}
            size="small"
          />
        </Drawer>

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

        {/* 算力需求分层管理视图 */}
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col span={24}>
            <Card title="算力需求分层管理视图" variant="borderless">
              <Collapse
                defaultActiveKey={priorityGroups.map((g) => g.level)}
                expandIconPosition="start"
                items={priorityGroups.map((group: PriorityGroup) => ({
                  key: group.level,
                  label: (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ fontSize: 16 }}>{group.icon}</span>
                      <span style={{ fontWeight: 600, color: group.color, fontSize: 15 }}>
                        {group.label}
                      </span>
                      <Badge
                        count={group.items.length}
                        style={{ backgroundColor: group.color }}
                        overflowCount={9999}
                      />
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
                      rowClassName={() => ''}
                      style={{
                        borderLeft: `3px solid ${group.color}`,
                        borderRadius: 4,
                      }}
                    />
                  ),
                  style: {
                    marginBottom: 8,
                    borderColor: group.borderColor,
                    backgroundColor: group.bgColor,
                    borderRadius: 8,
                  },
                }))}
              />
            </Card>
          </Col>
        </Row>

        {/* 节点资源详情 - 按状态分层展示 */}
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col span={24}>
            <Card
              title="节点资源详情（按状态分层）"
              variant="borderless"
              extra={
                <Checkbox
                  checked={showActiveOnly}
                  onChange={(e) => setShowActiveOnly(e.target.checked)}
                >
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
                        <span style={{ fontWeight: 600, color: group.color, fontSize: 15 }}>
                          {group.label}
                        </span>
                        <Badge
                          count={filteredItems.length}
                          style={{ backgroundColor: group.color }}
                          overflowCount={9999}
                        />
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
                        pagination={{ pageSize: 5, showSizeChanger: true, showTotal: (total) => `共 ${total} 条` }}
                        size="small"
                        style={{
                          borderLeft: `3px solid ${group.color}`,
                          borderRadius: 4,
                        }}
                      />
                    ),
                    style: {
                      marginBottom: 8,
                      borderColor: group.borderColor,
                      backgroundColor: group.bgColor,
                      borderRadius: 8,
                    },
                  };
                })}
              />
            </Card>
          </Col>
        </Row>

        {/* 多维资源动态管理 */}
        <Row gutter={[16, 16]}>
          <Col span={24}>
            <Card
              title={
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span>多维资源动态管理</span>
                  <DatePicker
                    value={activeDate ? dayjs(activeDate, 'YYYY-MM-DD') : null}
                    onChange={(_date, dateString) => {
                      const d = typeof dateString === 'string' ? dateString : dateString[0];
                      setSelectedDate(d || null);
                    }}
                    disabledDate={(current) => {
                      if (!current) return true;
                      return !availableDates.includes(current.format('YYYY-MM-DD'));
                    }}
                    allowClear={false}
                    size="small"
                    style={{ width: 160 }}
                    placeholder="选择日期"
                  />
                </span>
              }
              variant="borderless"
            >
              <ReactECharts
                option={trendOption}
                style={{ height: 400 }}
              />
            </Card>
          </Col>
        </Row>
      </Spin>
    </div>
  );
};

export default TaskManagement;
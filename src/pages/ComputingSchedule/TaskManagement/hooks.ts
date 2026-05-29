import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import {
  getTaskDemands,
  getMapData,
  getNodes,
  getResourceUsage,
  getResourceTrend,
  getPredictDates,
  getPredictTrend,
} from '@/services/api';
import {
  DemandItem,
  NodeItem,
  StatItem,
  ResourceUsageItem,
  TrendData,
  MapNodeItem,
  PriorityGroup,
  PriorityLevel,
  PRIORITY_ORDER,
  PRIORITY_META,
  NodeStatusGroup,
  NodeStatus,
  NODE_STATUS_ORDER,
  NODE_STATUS_META,
  ResourceAlert,
  ALERT_THRESHOLDS,
  SUPERCOMPUTING_MAP,
} from './types';

export interface DailyTrendData {
  dailyOverview: TrendData;
  dailyDetailMap: Map<string, TrendData>;
}

export default function useTaskManagementData() {
  const [loading, setLoading] = useState(false);

  const [demands, setDemands] = useState<DemandItem[]>([]);
  const [nodes, setNodes] = useState<NodeItem[]>([]);
  const [usage, setUsage] = useState<ResourceUsageItem[]>([]);
  const [trend, setTrend] = useState<DailyTrendData>({
    dailyOverview: { x: [], series: [] },
    dailyDetailMap: new Map(),
  });
  const [mapData, setMapData] = useState<MapNodeItem[]>([]);

  const fetchData = async (signal?: AbortSignal) => {
    setLoading(true);

    try {
      console.log('===== 开始请求 TaskManagement 页面数据 =====');

      const [demandRes, mapRes, nodesRes, usageRes, trendRes] = await Promise.all([
        getTaskDemands({ signal }).catch(() => []),
        getMapData().catch(() => []),
        getNodes().catch(() => ({ nodes: [], total: 0, online: 0 })),
        getResourceUsage().catch(() => []),
        getResourceTrend().catch(() => null),
      ]);

      if (signal?.aborted) return;

      const demandsData: any[] = Array.isArray(demandRes) ? demandRes : [];

      const mapItems: MapNodeItem[] = Array.isArray(mapRes)
        ? (mapRes as any[]).map((item) => ({
            name: item.name,
            longitude: item.longitude,
            latitude: item.latitude,
            capacity: item.capacity,
            level: item.level,
          }))
        : [];

      const nodesAny = nodesRes as any;
      const nodesData: NodeItem[] = Array.isArray(nodesAny?.nodes)
        ? nodesAny.nodes.map((n: any) => {
            const nodeName: string = n.node_name || n.hostname || '';
            let parentSuper = '';
            const nameLower = nodeName.toLowerCase();
            for (const [city, sc] of Object.entries(SUPERCOMPUTING_MAP)) {
              if (nameLower.includes(city)) {
                parentSuper = sc;
                break;
              }
            }
            if (!parentSuper) {
              const nodeIdLower = (n.node_id || '').toLowerCase();
              for (const [city, sc] of Object.entries(SUPERCOMPUTING_MAP)) {
                if (nodeIdLower.includes(city)) {
                  parentSuper = sc;
                  break;
                }
              }
            }
            return {
              node_name: nodeName,
              node_id: n.node_id || '',
              status: n.status || 'offline',
              cpu_percent: n.cpu_percent ?? n.cpu_usage ?? 0,
              mem_percent: n.mem_percent ?? n.memory_usage ?? 0,
              gpu_percent: n.gpu_percent ?? n.gpu_usage ?? 0,
              disk_percent: n.disk_percent ?? n.disk_usage ?? 0,
              parent_supercomputing: parentSuper,
            };
          })
        : [];

      const usageData: ResourceUsageItem[] = Array.isArray(usageRes)
        ? (usageRes as any[]).map((item) => ({
            name: item.name,
            value: item.value,
          }))
        : [];

      let trendData: DailyTrendData = {
        dailyOverview: { x: [], series: [] },
        dailyDetailMap: new Map(),
      };
      const trendAny = trendRes as any;
      if (trendAny && typeof trendAny === 'object') {
        const overview: TrendData = trendAny.dailyOverview || { x: [], series: [] };
        const detailMap = new Map<string, TrendData>();
        if (trendAny.dailyDetail && typeof trendAny.dailyDetail === 'object') {
          Object.entries(trendAny.dailyDetail).forEach(([day, data]: [string, any]) => {
            detailMap.set(day, data as TrendData);
          });
        }
        trendData = { dailyOverview: overview, dailyDetailMap: detailMap };
      }

      setDemands(demandsData);
      setNodes(nodesData);
      setUsage(usageData);
      setTrend(trendData);
      setMapData(mapItems);

      console.log('===== 页面数据写入完成 =====');
    } catch (error: any) {
      if (error?.name === 'AbortError' || error?.name === 'CanceledError' || error?.code === 'ERR_CANCELED') return;
      console.error('❌ TaskManagement 页面接口请求失败：', error);

      setDemands([]);
      setNodes([]);
      setUsage([]);
      setTrend({ dailyOverview: { x: [], series: [] }, dailyDetailMap: new Map() });
      setMapData([]);
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  };

  const priorityGroups = useMemo<PriorityGroup[]>(() => {
    return PRIORITY_ORDER.map((level) => {
      const meta = PRIORITY_META[level];
      const items = demands.filter((d) => d.priority === level);
      return {
        ...meta,
        level,
        items,
        totalCpu: +items.reduce((s, d) => s + d.cpu, 0).toFixed(2),
        totalMemory: +items.reduce((s, d) => s + d.memory, 0).toFixed(2),
        totalGpu: +items.reduce((s, d) => s + d.gpu, 0).toFixed(2),
        totalStorage: +items.reduce((s, d) => s + d.storage, 0).toFixed(2),
      };
    });
  }, [demands]);

  const stats = useMemo<StatItem[]>(() => {
    const total = demands.length;
    const running = demands.filter((d) => d.status === '运行中').length;
    const onlineNodes = nodes.filter((n) => n.status === 'online');
    const healthyNodes = onlineNodes.length;
    const alertNodes = nodes.filter((n) => n.status === 'warning' || n.status === 'offline').length;
    const avgUsage = onlineNodes.length
      ? +(onlineNodes.reduce((s, n) => s + n.cpu_percent, 0) / onlineNodes.length).toFixed(1)
      : 0;
    return [
      { title: '全网任务总数', value: total },
      { title: '运行中', value: running },
      { title: '全网空闲算力', value: `${healthyNodes} 节点` },
      { title: '全网资源利用率', value: `${avgUsage}%` },
    ];
  }, [demands, nodes]);

  const nodeStatusGroups = useMemo<NodeStatusGroup[]>(() => {
    return NODE_STATUS_ORDER.map((status) => {
      const meta = NODE_STATUS_META[status];
      const items = nodes
        .filter((n) => n.status === status)
        .sort((a, b) => (b.cpu_percent + b.gpu_percent) - (a.cpu_percent + a.gpu_percent));
      const len = items.length || 1;
      return {
        ...meta,
        status,
        items,
        avgCpu: +(items.reduce((s, n) => s + n.cpu_percent, 0) / len).toFixed(1),
        avgMem: +(items.reduce((s, n) => s + n.mem_percent, 0) / len).toFixed(1),
        avgGpu: +(items.reduce((s, n) => s + n.gpu_percent, 0) / len).toFixed(1),
        avgDisk: +(items.reduce((s, n) => s + n.disk_percent, 0) / len).toFixed(1),
      };
    });
  }, [nodes]);

  const alerts = useMemo<ResourceAlert[]>(() => {
    const result: ResourceAlert[] = [];
    const now = Date.now();
    nodes.forEach((node) => {
      ALERT_THRESHOLDS.forEach((th) => {
        const value = node[th.field];
        if (value >= th.critical) {
          result.push({
            id: `${node.node_id}-${th.metric}-critical-${now}`,
            nodeId: node.node_id,
            nodeName: node.node_name,
            metric: th.label,
            value,
            threshold: th.critical,
            level: 'critical',
            message: `${node.node_name} ${th.label}达 ${value}${th.unit}，超过严重阈值 ${th.critical}${th.unit}`,
            timestamp: now,
          });
        } else if (value >= th.warning) {
          result.push({
            id: `${node.node_id}-${th.metric}-warning-${now}`,
            nodeId: node.node_id,
            nodeName: node.node_name,
            metric: th.label,
            value,
            threshold: th.warning,
            level: 'warning',
            message: `${node.node_name} ${th.label}达 ${value}${th.unit}，超过警告阈值 ${th.warning}${th.unit}`,
            timestamp: now,
          });
        }
      });
    });
    result.sort((a, b) => {
      if (a.level === 'critical' && b.level !== 'critical') return -1;
      if (a.level !== 'critical' && b.level === 'critical') return 1;
      return b.value - a.value;
    });
    return result;
  }, [nodes]);

  const [predictDates, setPredictDates] = useState<string[]>([]);
  const [predictTrend, setPredictTrend] = useState<{
    date: string;
    x: string[];
    currentTimeIndex: number;
    series: { name: string; data: number[] }[];
  } | null>(null);
  const [predictLoading, setPredictLoading] = useState(false);
  const predictTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const predictDateRef = useRef<string | null>(null);

  const fetchPredictDates = useCallback(async () => {
    try {
      const res = await getPredictDates();
      const dates = (res as any)?.dates || [];
      setPredictDates(dates);
      return dates;
    } catch {
      return [];
    }
  }, []);

  const fetchPredictTrend = useCallback(async (date: string) => {
    setPredictLoading(true);
    predictDateRef.current = date;
    try {
      const res = await getPredictTrend(date);
      setPredictTrend(res as any);
    } catch {
      setPredictTrend(null);
    } finally {
      setPredictLoading(false);
    }
  }, []);

  useEffect(() => {
    const ctrl = new AbortController();
    fetchData(ctrl.signal);

    // 初始加载：获取日期列表，默认查看今天
    fetchPredictDates().then((dates) => {
      const today = new Date().toISOString().slice(0, 10);
      // 优先用今天，如果今天不在列表中则用最近的日期
      const targetDate = dates.includes(today) ? today : (dates.length > 0 ? dates[dates.length - 1] : today);
      fetchPredictTrend(targetDate);
    });

    // 每10秒轮询一次，实现实时预测效果
    predictTimerRef.current = setInterval(() => {
      const currentDate = predictDateRef.current;
      if (currentDate) {
        getPredictTrend(currentDate).then((res) => {
          setPredictTrend(res as any);
        }).catch(() => {});
      }
    }, 10000);

    return () => {
      ctrl.abort();
      if (predictTimerRef.current) {
        clearInterval(predictTimerRef.current);
      }
    };
  }, []);

  return {
    loading,
    demands,
    nodes,
    stats,
    usage,
    trend,
    mapData,
    priorityGroups,
    nodeStatusGroups,
    alerts,
    refresh: fetchData,
    predictDates,
    predictTrend,
    predictLoading,
    fetchPredictTrend,
  };
}

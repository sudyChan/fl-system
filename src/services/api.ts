import axios from 'axios';
// import request from '@/utils/request';
// import requests from '@/utils/request';
const api = axios.create({
  baseURL: '/api',
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

// Request interceptor
api.interceptors.request.use(
  (config) => {
    // TODO: Add auth token
    return config;
  },
  (error) => Promise.reject(error),
);

// Response interceptor
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (axios.isCancel(error) || error?.code === 'ERR_CANCELED' || error?.name === 'CanceledError') {
      return Promise.reject(error);
    }
    console.error('API Error:', error);
    return Promise.reject(error);
  },
);

export default api;

// === API Endpoints ===

// Resource monitoring
export const getNodeResources = () => api.get('/resources/nodes');
export const getNodeHistory = (nodeId: string) => api.get(`/resources/nodes/${nodeId}/history`);


// Task management
// export const getTasks = () => api.get('/tasks');
/**
 * 算力任务需求管理
 */
/**
 * 获取算力任务需求列表
 * 接口：GET /api/tasks/demands
 * 用途：页面中的“算力需求管理视图”表格
 */
export const getTaskDemands = (config?: any) => api.get('/tasks/demands', config);

/**
 * 获取顶部统计卡片数据
 * 接口：GET /api/tasks/stats
 * 用途：任务总数 / 运行中任务 / 空闲节点 / 资源利用率
 */
export const getTaskStats = () => api.get('/tasks/stats');

/** 资源   */
/**
 * 获取节点资源详情列表（含最新 CPU/GPU/内存/磁盘使用率）
 * 接口：GET /api/resources/nodes
 * 数据源：PostgreSQL dim_compute_node + ts_node_metric → Redis 缓存
 */
export const getNodes = () => api.get('/resources/nodes');

/**
 * 获取资源占比数据（饼图）
 * 接口：GET /api/resources/usage
 * 数据源：PostgreSQL ts_node_metric 聚合 → Redis 缓存
 */
export const getResourceUsage = () => api.get('/resources/usage');

/**
 * 获取资源动态趋势数据（折线图，含 dailyOverview + dailyDetail）
 * 接口：GET /api/resources/trend
 * 数据源：PostgreSQL ts_resource_trend_5m → Redis 缓存
 */
export const getResourceTrend = () => api.get('/resources/trend');

/**
 * 获取全国算力节点地图分布数据
 * 接口：GET /api/resources/map
 * 数据源：PostgreSQL dim_supercomputing_center → Redis 缓存
 */
export const getMapData = () => api.get('/resources/map');

export const getPredictDates = () => api.get('/resources/predict/dates');

export const getPredictTrend = (date: string) => api.get('/resources/predict/trend', { params: { date } });

export const getPredictOverview = () => api.get('/resources/predict/overview');
// export const createTask = (data: any) => api.post('/tasks', data);
//

// /**
//  * 获取节点资源详情视图（集群与任务监控仪表盘）数据
//  */
// export const getClusterDashboard = async () =>{
//     return request.get('/api/cluster/dashboard');
// };

// Fraud detection
export const getFraudOverview = () => api.get('/fraud/overview');
export const getFraudUsers = (params?: any) => api.get('/fraud/users', { params });

// Chat
export const sendChatMessage = (message: string) => api.post('/chat', { message });

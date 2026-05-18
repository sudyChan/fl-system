from fastapi import APIRouter
from typing import Optional
import random
import time

router = APIRouter()


def _mock_node(node_id: str):
    """Generate mock resource data for a single node."""
    return {
        "node_id": node_id,
        "hostname": f"node-{node_id}",
        "status": random.choice(["online", "online", "online", "offline", "warning"]),
        "cpu_usage": round(random.uniform(10, 95), 1),
        "memory_usage": round(random.uniform(20, 90), 1),
        "disk_usage": round(random.uniform(30, 85), 1),
        "network_in": round(random.uniform(50, 500), 2),
        "network_out": round(random.uniform(30, 300), 2),
        "gpu_usage": round(random.uniform(0, 100), 1),
        "gpu_memory": round(random.uniform(0, 100), 1),
        "updated_at": int(time.time()),
    }


@router.get("/resources/nodes")
async def get_nodes():
    """Get all computing nodes and their resource usage."""
    nodes = [_mock_node(str(i)) for i in range(1, 13)]
    return {
        "total": len(nodes),
        "online": sum(1 for n in nodes if n["status"] == "online"),
        "nodes": nodes,
    }


@router.get("/resources/nodes/{node_id}")
async def get_node_detail(node_id: str):
    """Get detailed information for a specific node."""
    return _mock_node(node_id)


@router.get("/resources/nodes/{node_id}/history")
async def get_node_history(
    node_id: str,
    metric: str = "cpu_usage",
    period: str = "1h",
):
    """Get historical metrics for a node."""
    points = 60 if period == "1h" else 120
    timestamps = [int(time.time()) - (points - i) * 60 for i in range(points)]
    values = [round(random.uniform(20, 90), 1) for _ in range(points)]
    return {
        "node_id": node_id,
        "metric": metric,
        "period": period,
        "data": [{"timestamp": t, "value": v} for t, v in zip(timestamps, values)],
    }


@router.get("/resources/topology")
async def get_topology():
    """Get network topology data for visualization."""
    nodes = [
        {"id": "cloud", "label": "Cloud Center", "type": "cloud"},
        *[{"id": f"edge-{i}", "label": f"Edge Node {i}", "type": "edge"} for i in range(1, 5)],
        *[{"id": f"client-{i}", "label": f"Client {i}", "type": "client"} for i in range(1, 9)],
    ]
    edges = [
        *[{"source": "cloud", "target": f"edge-{i}"} for i in range(1, 5)],
        *[{"source": f"edge-{(i-1)//2+1}", "target": f"client-{i}"} for i in range(1, 9)],
    ]
    return {"nodes": nodes, "edges": edges}


@router.get("/resources/load")
async def get_system_load():
    """Get system load overview for monitoring dashboard."""
    return {
        "timestamp": int(time.time()),
        "total_cpu": round(random.uniform(40, 75), 1),
        "total_memory": round(random.uniform(50, 80), 1),
        "total_gpu": round(random.uniform(30, 90), 1),
        "total_disk": round(random.uniform(40, 70), 1),
        "node_loads": [
            {"node_id": str(i), "load": round(random.uniform(20, 95), 1)}
            for i in range(1, 13)
        ],
    }


# =========================
# TaskManagement 页面专用接口
# =========================

@router.get("/resources/usage")
async def get_resource_usage():
    """
    获取资源占比数据
    对应用途：
    - 前端页面：算力中心能力视图中的资源占比饼图
    - 文件位置：src/pages/ComputingSchedule/TaskManagement/index.tsx

    返回格式说明：
    [
      { "name": "CPU", "value": 256 },
      { "name": "GPU", "value": 64 }
    ]
    """
    return [
        {"name": "CPU", "value": 256},
        {"name": "GPU", "value": 64},
        {"name": "存储", "value": 1024},
        {"name": "网络", "value": 128},
    ]


@router.get("/resources/trend")
async def get_resource_trend():
    """
    获取多维资源动态趋势数据
    对应用途：
    - 前端页面：多维资源动态管理折线图
    - 文件位置：src/pages/ComputingSchedule/TaskManagement/index.tsx

    返回字段说明：
    - x: 时间轴
    - series: 多条资源利用率曲线
    """
    # return {
    #     "x": ["10:00", "11:00", "12:00", "13:00", "14:00"],
    #     "series": [
    #         {"name": "CPU利用率", "data": [60, 72, 68, 75, 70], "areaStyle": True},
    #         {"name": "内存利用率", "data": [50, 65, 60, 68, 66], "areaStyle": True},
    #         {"name": "GPU利用率", "data": [35, 45, 40, 50, 48], "areaStyle": True},
    #     ],
    # }
    time_points = ["2020-8-1", "2020-8-2", "2020-8-3", "2020-8-4", "2020-8-5"]

    return {
        "x": time_points,
        "series": [
            {
                "name": "CPU使用率",
                "data": [round(random.uniform(45, 85), 1) for _ in time_points],
            },
            {
                "name": "内存使用率",
                "data": [round(random.uniform(35, 75), 1) for _ in time_points],
            },
            {
                "name": "GPU使用率",
                "data": [round(random.uniform(20, 65), 1) for _ in time_points],
            },
        ],
    }


# @router.get("/resources/map")
# async def get_map_data():
#     """
#     获取全国算力节点地图散点数据
#     对应用途：
#     - 前端页面：算力中心能力视图中的全国节点分布图
#     - 文件位置：src/pages/ComputingSchedule/TaskManagement/index.tsx
#
#     数据格式说明：
#     [经度, 纬度, 算力值]
#     """
#     return [
#         [116.4, 39.9, 200],   # 北京
#         [121.5, 31.2, 300],   # 上海
#         [113.2, 23.1, 180],   # 广州
#         [104.0, 30.6, 150],   # 成都
#         [114.3, 30.6, 220],   # 武汉
#         [108.9, 34.3, 170],   # 西安
#     ]

# =========================================================
# TaskManagement 页面专用：全国算力节点分布
# =========================================================
@router.get("/resources/map")
async def get_map_nodes():
    """
    获取全国算力节点分布数据

    返回字段说明：
    - name: 节点名称（地图上展示）
    - longitude: 经度
    - latitude: 纬度
    - capacity: 算力值（用于散点大小）
    - level: 节点等级
    """
    return [
        {"name": "拉萨算力中心", "longitude": 91.1322, "latitude": 29.6604, "capacity": 120, "level": "边缘节点"},
        {"name": "长沙算力中心", "longitude": 112.9398, "latitude": 28.2282, "capacity": 150, "level": "边缘节点"},
        {"name": "西宁算力中心", "longitude": 101.7783, "latitude": 36.6167, "capacity": 100, "level": "边缘节点"},
        {"name": "昆明算力中心", "longitude": 102.7123, "latitude": 25.0406, "capacity": 180, "level": "边缘节点"},
        {"name": "南宁算力中心", "longitude": 108.3667, "latitude": 22.8167, "capacity": 200, "level": "边缘节点"},
        {"name": "海口算力中心", "longitude": 110.3500, "latitude": 20.0167, "capacity": 90, "level": "区域级"},
        {"name": "银川算力中心", "longitude": 106.2667, "latitude": 38.4667, "capacity": 130, "level": "区域级"},
        {"name": "兰州算力中心", "longitude": 103.8333, "latitude": 36.0667, "capacity": 160, "level": "区域级"},
        {"name": "乌鲁木齐算力中心", "longitude": 87.6167, "latitude": 43.8167, "capacity": 80, "level": "区域级"},
        {"name": "呼和浩特边缘算力中心", "longitude": 111.7519, "latitude": 40.8515, "capacity": 110, "level": "区域级"},
        {"name": "哈尔滨边缘算力中心", "longitude": 126.6333, "latitude": 45.7500, "capacity": 140, "level": "区域级"},
        {"name": "天津西青算力中心", "longitude": 117.0833, "latitude": 39.1333, "capacity": 220, "level": "区域级"},
        {"name": "石家庄算力中心", "longitude": 114.5167, "latitude": 38.0333, "capacity": 170, "level": "区域级"},
        {"name": "太原算力中心", "longitude": 112.5500, "latitude": 37.8667, "capacity": 130, "level": "区域级"},
        {"name": "沈阳算力中心", "longitude": 123.4315, "latitude": 41.8057, "capacity": 190, "level": "区域级"},
        {"name": "长春算力中心", "longitude": 125.3167, "latitude": 43.8833, "capacity": 160, "level": "区域级"},
        {"name": "上海算力中心", "longitude": 121.4737, "latitude": 31.2304, "capacity": 300, "level": "区域级"},
        {"name": "杭州算力中心", "longitude": 120.1551, "latitude": 30.2741, "capacity": 250, "level": "区域级"},
        {"name": "合肥算力中心", "longitude": 117.2833, "latitude": 31.8667, "capacity": 210, "level": "边缘节点"},
        {"name": "南昌算力中心", "longitude": 115.8917, "latitude": 28.6767, "capacity": 180, "level": "边缘节点"},
        {"name": "济南算力中心", "longitude": 117.0000, "latitude": 36.6667, "capacity": 230, "level": "边缘节点"},
        {"name": "郑州算力中心", "longitude": 113.6653, "latitude": 34.7578, "capacity": 240, "level": "边缘节点"},
        {"name": "广州算力中心", "longitude": 113.2644, "latitude": 23.1291, "capacity": 350, "level": "边缘节点"},
        {"name": "深圳算力中心", "longitude": 114.0579, "latitude": 22.5431, "capacity": 400, "level": "边缘节点"},
        {"name": "贵阳算力中心", "longitude": 106.7167, "latitude": 26.5833, "capacity": 200, "level": "边缘节点"},
        {"name": "西安算力中心", "longitude": 108.9453, "latitude": 34.3417, "capacity": 280, "level": "边缘节点"}
    ]

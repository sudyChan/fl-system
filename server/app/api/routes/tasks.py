from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional
import random
import time
import uuid

router = APIRouter()


class TaskCreate(BaseModel):
    """Schema for creating a new task."""
    name: str
    type: str = "training"
    priority: str = "normal"
    resource_requirements: Optional[dict] = None
    description: Optional[str] = None


# In-memory mock task store
_mock_tasks = [
    {
        "task_id": str(uuid.uuid4()),
        "name": f"FL Training Task {i}",
        "type": random.choice(["training", "inference", "aggregation"]),
        "status": random.choice(["running", "completed", "pending", "failed"]),
        "priority": random.choice(["high", "normal", "low"]),
        "progress": random.randint(0, 100),
        "assigned_node": f"node-{random.randint(1, 12)}",
        "created_at": int(time.time()) - random.randint(0, 86400),
        "duration": random.randint(60, 7200),
    }
    for i in range(1, 11)
]


@router.get("/tasks")
async def get_tasks(
    status: Optional[str] = None,
    task_type: Optional[str] = None,
):
    """Get all tasks with optional filtering."""
    tasks = _mock_tasks
    if status:
        tasks = [t for t in tasks if t["status"] == status]
    if task_type:
        tasks = [t for t in tasks if t["type"] == task_type]
    return {
        "total": len(tasks),
        "tasks": tasks,
        "stats": {
            "running": sum(1 for t in _mock_tasks if t["status"] == "running"),
            "completed": sum(1 for t in _mock_tasks if t["status"] == "completed"),
            "pending": sum(1 for t in _mock_tasks if t["status"] == "pending"),
            "failed": sum(1 for t in _mock_tasks if t["status"] == "failed"),
        },
    }


@router.post("/tasks")
async def create_task(task: TaskCreate):
    """Create a new computing task."""
    new_task = {
        "task_id": str(uuid.uuid4()),
        "name": task.name,
        "type": task.type,
        "status": "pending",
        "priority": task.priority,
        "progress": 0,
        "assigned_node": None,
        "created_at": int(time.time()),
        "duration": 0,
        "description": task.description,
    }
    _mock_tasks.append(new_task)
    return new_task


# =========================
# TaskManagement 页面联调接口
# =========================
@router.get("/tasks/demands")
async def get_task_demands():
    """
    获取算力任务需求列表
    对应用途：
    - 前端页面：算力需求管理视图
    - 文件位置：src/pages/ComputingSchedule/TaskManagement/index.tsx

    返回字段说明：
    - id: 任务唯一标识
    - task: 任务名称
    - cpu: CPU 需求（核）
    - memory: 内存需求（GB）
    - gpu: GPU 需求（张）
    - storage: 存储需求（GB）
    - priority: 优先级（高 / 中 / 低）
    - status: 状态（待分配 / 已分配 / 运行中 / 已完成）
    """
    return [
        {"id": "d1", "task": "联邦训练-图神经网络", "cpu": 16, "memory": 64, "gpu": 4, "storage": 200, "priority": "高", "status": "待分配"},
        {"id": "d2", "task": "异常行为检测-模型评估", "cpu": 12, "memory": 48, "gpu": 2, "storage": 150, "priority": "高", "status": "已完成"},
        {"id": "d3", "task": "大模型微调-通义千问", "cpu": 32, "memory": 128, "gpu": 8, "storage": 500, "priority": "高", "status": "运行中"},
        {"id": "d4", "task": "实时推理-欺诈交易识别", "cpu": 16, "memory": 64, "gpu": 4, "storage": 100, "priority": "高", "status": "已分配"},
        {"id": "d5", "task": "模型推理-欺诈检测", "cpu": 8, "memory": 32, "gpu": 2, "storage": 100, "priority": "中", "status": "已分配"},
        {"id": "d6", "task": "特征工程-用户画像构建", "cpu": 12, "memory": 48, "gpu": 1, "storage": 300, "priority": "中", "status": "运行中"},
        {"id": "d7", "task": "模型聚合-全局参数更新", "cpu": 16, "memory": 64, "gpu": 2, "storage": 80, "priority": "中", "status": "待分配"},
        {"id": "d8", "task": "增量训练-电信反诈模型", "cpu": 8, "memory": 32, "gpu": 2, "storage": 200, "priority": "中", "status": "运行中"},
        {"id": "d9", "task": "数据清洗-通信日志分析", "cpu": 4, "memory": 16, "gpu": 0, "storage": 500, "priority": "低", "status": "运行中"},
        {"id": "d10", "task": "日志归档-历史数据迁移", "cpu": 2, "memory": 8, "gpu": 0, "storage": 1000, "priority": "低", "status": "已完成"},
        {"id": "d11", "task": "数据同步-跨节点副本", "cpu": 4, "memory": 16, "gpu": 0, "storage": 800, "priority": "低", "status": "待分配"},
        {"id": "d12", "task": "模型评估-精度测试", "cpu": 8, "memory": 32, "gpu": 1, "storage": 120, "priority": "中", "status": "已完成"},
    ]


@router.get("/tasks/stats")
async def get_task_stats():
    """
    获取顶部统计卡片数据
    对应用途：
    - 前端页面：顶部统计概览卡片
    - 文件位置：src/pages/ComputingSchedule/TaskManagement/index.tsx

    返回格式说明：
    [
      { "title": "任务总数", "value": 12 },
      { "title": "运行中任务", "value": 4 }
    ]
    """
    demands = await get_task_demands()
    total = len(demands)
    running = len([d for d in demands if d["status"] == "运行中"])
    idle_nodes = len([d for d in demands if d["status"] == "待分配"])
    active_nodes = [d for d in demands if d["status"] in ("运行中", "已分配")]
    if active_nodes:
        avg_usage = round(
            sum(d["cpu"] for d in active_nodes) / len(active_nodes), 1
        )
    else:
        avg_usage = 0
    return [
        {"title": "任务总数", "value": total},
        {"title": "运行中任务", "value": running},
        {"title": "空闲节点", "value": idle_nodes},
        {"title": "资源利用率", "value": f"{avg_usage}%"},
    ]



@router.get("/tasks/{task_id}")
async def get_task(task_id: str):
    """Get details of a specific task."""
    for t in _mock_tasks:
        if t["task_id"] == task_id:
            return t
    return {"error": "Task not found"}


@router.get("/tasks/prediction/demand")
async def get_demand_prediction(period: str = "daily"):
    """Get resource demand prediction data."""
    periods_map = {"hourly": 24, "daily": 7, "weekly": 4}
    n = periods_map.get(period, 7)
    return {
        "period": period,
        "predictions": [
            {
                "time_slot": i,
                "cpu_demand": round(random.uniform(40, 90), 1),
                "memory_demand": round(random.uniform(30, 80), 1),
                "gpu_demand": round(random.uniform(20, 70), 1),
            }
            for i in range(n)
        ],
    }

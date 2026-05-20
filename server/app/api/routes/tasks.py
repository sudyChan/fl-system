from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional
from sqlalchemy import text, create_engine
import random
import time
import uuid

from app.core.config import settings
from app.core.cache import cached

router = APIRouter()


class TaskCreate(BaseModel):
    name: str
    type: str = "training"
    priority: str = "normal"
    resource_requirements: Optional[dict] = None
    description: Optional[str] = None


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


def _get_computing_network_engine():
    url = (
        f"postgresql://{settings.DB_USER}:{settings.DB_PASSWORD}"
        f"@{settings.DB_HOST}:{settings.DB_PORT}/{settings.DB_NAME}?sslmode=prefer"
    )
    return create_engine(url, connect_args={"connect_timeout": 5, "sslmode": "prefer"})


def _query_db(sql: str, params: dict | None = None):
    engine = _get_computing_network_engine()
    with engine.connect() as conn:
        result = conn.execute(text(sql), params or {})
        return [dict(row._mapping) for row in result.fetchall()]


_STATUS_MAP = {
    "pending": "待分配",
    "scheduled": "已分配",
    "running": "运行中",
    "paused": "运行中",
    "completed": "已完成",
    "failed": "已完成",
}

_PRIORITY_MAP = {
    "urgent": "高",
    "high": "高",
    "medium": "中",
    "low": "低",
}


def _fetch_demands_from_db():
    rows = _query_db("""
        SELECT
            t.task_id,
            t.name,
            t.status,
            t.priority,
            t.progress,
            t.task_type,
            t.business_type,
            t.submit_time,
            t.start_time,
            t.end_time,
            t.assigned_node_id,
            r.cpu_requested,
            r.memory_requested,
            r.gpu_requested,
            r.gpu_type_requested,
            r.storage_requested,
            r.bandwidth_requested,
            r.estimated_duration_sec
        FROM fact_task t
        JOIN fact_task_requirement r ON t.task_id = r.task_id
        ORDER BY t.submit_time DESC
    """)
    demands = []
    for r in rows:
        demands.append({
            "id": r["task_id"],
            "task": r["name"],
            "cpu": int(float(r["cpu_requested"] or 0)),
            "memory": int(float(r["memory_requested"] or 0)),
            "gpu": float(r["gpu_requested"] or 0),
            "storage": int(float(r["storage_requested"] or 0)),
            "priority": _PRIORITY_MAP.get(r["priority"], "中"),
            "status": _STATUS_MAP.get(r["status"], "待分配"),
        })
    return demands


_MOCK_DEMANDS = [
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


@router.get("/tasks")
@cached(ttl=30, key_prefix="tasks")
async def get_tasks(
    status: Optional[str] = None,
    task_type: Optional[str] = None,
):
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


@router.get("/tasks/demands")
@cached(ttl=60, key_prefix="tasks")
async def get_task_demands():
    try:
        return _fetch_demands_from_db()
    except Exception as e:
        print(f"[API] /tasks/demands query failed: {e}")
        return _MOCK_DEMANDS


@router.get("/tasks/stats")
@cached(ttl=60, key_prefix="tasks")
async def get_task_stats():
    try:
        demands = _fetch_demands_from_db()
    except Exception:
        demands = _MOCK_DEMANDS

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
@cached(ttl=30, key_prefix="tasks")
async def get_task(task_id: str):
    for t in _mock_tasks:
        if t["task_id"] == task_id:
            return t
    return {"error": "Task not found"}


@router.get("/tasks/prediction/demand")
@cached(ttl=120, key_prefix="tasks")
async def get_demand_prediction(period: str = "daily"):
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

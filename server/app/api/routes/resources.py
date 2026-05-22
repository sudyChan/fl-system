from fastapi import APIRouter, Depends, Query
from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy import text, create_engine
import random
import time

from app.core.database import get_db
from app.core.config import settings
from app.core.cache import cached
from app.services.alibaba_predictor import (
    get_available_dates,
    get_realtime_prediction,
    get_daily_overview,
)

router = APIRouter()


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


@router.get("/resources/nodes")
@cached(ttl=30, key_prefix="resources")
async def get_nodes():
    try:
        rows = _query_db("""
            SELECT
                node_id,
                node_name,
                COALESCE(display_status, status, 'offline') AS status,
                ROUND(cpu_percent::numeric, 1)  AS cpu_percent,
                ROUND(mem_percent::numeric, 1)  AS mem_percent,
                ROUND(gpu_percent::numeric, 1)  AS gpu_percent,
                ROUND(disk_percent::numeric, 1) AS disk_percent
            FROM vw_node_runtime_snapshot
            ORDER BY node_id
        """)
        nodes = [
            {
                "node_name": r["node_name"],
                "node_id": r["node_id"],
                "status": r["status"],
                "cpu_percent": float(r["cpu_percent"]),
                "mem_percent": float(r["mem_percent"]),
                "gpu_percent": float(r["gpu_percent"]),
                "disk_percent": float(r["disk_percent"]),
            }
            for r in rows
        ]
        online = sum(1 for n in nodes if n["status"] == "online")
        return {"total": len(nodes), "online": online, "nodes": nodes}
    except Exception as e:
        print(f"[API] /resources/nodes query failed: {e}")
        nodes = [_mock_node(str(i)) for i in range(1, 13)]
        return {"total": len(nodes), "online": sum(1 for n in nodes if n["status"] == "online"), "nodes": nodes}


def _mock_node(node_id: str):
    status = random.choice(["online", "online", "online", "offline", "warning"])
    return {
        "node_name": f"node-{node_id}",
        "node_id": node_id,
        "status": status,
        "cpu_percent": round(random.uniform(10, 95), 1),
        "mem_percent": round(random.uniform(20, 90), 1),
        "gpu_percent": round(random.uniform(0, 100), 1),
        "disk_percent": round(random.uniform(30, 85), 1),
    }


@router.get("/resources/nodes/{node_id}")
@cached(ttl=30, key_prefix="resources")
async def get_node_detail(node_id: str):
    try:
        rows = _query_db("""
            SELECT
                node_id,
                node_name,
                COALESCE(display_status, status, 'offline') AS status,
                location,
                ROUND(cpu_percent::numeric, 1)  AS cpu_percent,
                ROUND(mem_percent::numeric, 1)  AS mem_percent,
                ROUND(gpu_percent::numeric, 1)  AS gpu_percent,
                ROUND(disk_percent::numeric, 1) AS disk_percent,
                running_tasks,
                health_score,
                last_heartbeat,
                latest_metric_time
            FROM vw_node_runtime_snapshot
            WHERE node_id = :nid
        """, {"nid": node_id})
        if rows:
            r = rows[0]
            return {
                "node_id": r["node_id"],
                "hostname": r["node_name"],
                "status": r["status"],
                "location": r["location"],
                "cpu_usage": float(r["cpu_percent"]),
                "memory_usage": float(r["mem_percent"]),
                "disk_usage": float(r["disk_percent"]),
                "gpu_usage": float(r["gpu_percent"]),
                "running_tasks": int(r["running_tasks"]) if r["running_tasks"] else 0,
                "health_score": float(r["health_score"]) if r["health_score"] else None,
                "last_heartbeat": r["last_heartbeat"].isoformat() if r["last_heartbeat"] else None,
                "updated_at": int(time.time()),
            }
        return _mock_node(node_id)
    except Exception as e:
        print(f"[API] /resources/nodes/{node_id} query failed: {e}")
        return _mock_node(node_id)


@router.get("/resources/nodes/{node_id}/history")
@cached(ttl=60, key_prefix="resources")
async def get_node_history(
    node_id: str,
    metric: str = "cpu_usage",
    period: str = "1h",
):
    try:
        interval = "1 hour" if period == "1h" else "2 hours"
        col_map = {
            "cpu_usage": "cpu_usage_pct",
            "memory_usage": "memory_usage_pct",
            "gpu_usage": "gpu_usage_pct",
            "disk_usage": "disk_usage_pct",
        }
        col = col_map.get(metric, "cpu_usage_pct")
        sql = f"""
            SELECT metric_time, {col} AS value
            FROM ts_node_metric
            WHERE node_id = :nid
              AND metric_time >= now() - interval '{interval}'
            ORDER BY metric_time
        """
        rows = _query_db(sql, {"nid": node_id})
        if rows:
            return {
                "node_id": node_id,
                "metric": metric,
                "period": period,
                "data": [
                    {"timestamp": int(r["metric_time"].timestamp()), "value": round(float(r["value"]), 1)}
                    for r in rows
                ],
            }
    except Exception as e:
        print(f"[API] /resources/nodes/{node_id}/history query failed: {e}")

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
@cached(ttl=120, key_prefix="resources")
async def get_topology():
    try:
        vertices = _query_db("SELECT vertex_id, label, v_type FROM dim_topology_vertex ORDER BY vertex_id")
        edges = _query_db("SELECT source_id, target_id FROM dim_topology_edge ORDER BY edge_id")
        if vertices and edges:
            return {
                "nodes": [
                    {"id": v["vertex_id"], "label": v["label"], "type": v["v_type"]}
                    for v in vertices
                ],
                "edges": [
                    {"source": e["source_id"], "target": e["target_id"]}
                    for e in edges
                ],
            }
    except Exception as e:
        print(f"[API] /resources/topology query failed: {e}")

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
@cached(ttl=30, key_prefix="resources")
async def get_system_load():
    try:
        rows = _query_db("""
            SELECT
                AVG(cpu_usage_pct)    AS total_cpu,
                AVG(memory_usage_pct) AS total_memory,
                AVG(gpu_usage_pct)    AS total_gpu,
                AVG(disk_usage_pct)   AS total_disk
            FROM (
                SELECT DISTINCT ON (node_id)
                    cpu_usage_pct, memory_usage_pct, gpu_usage_pct, disk_usage_pct
                FROM ts_node_metric
                ORDER BY node_id, metric_time DESC
            ) sub
        """)
        if rows and rows[0]["total_cpu"] is not None:
            r = rows[0]
            node_loads = _query_db("""
                SELECT node_id, cpu_usage_pct AS load
                FROM (
                    SELECT DISTINCT ON (node_id) node_id, cpu_usage_pct
                    FROM ts_node_metric
                    ORDER BY node_id, metric_time DESC
                ) sub
                ORDER BY node_id
            """)
            return {
                "timestamp": int(time.time()),
                "total_cpu": round(float(r["total_cpu"]), 1),
                "total_memory": round(float(r["total_memory"]), 1),
                "total_gpu": round(float(r["total_gpu"]), 1),
                "total_disk": round(float(r["total_disk"]), 1),
                "node_loads": [
                    {"node_id": nl["node_id"], "load": round(float(nl["load"]), 1)}
                    for nl in node_loads
                ],
            }
    except Exception as e:
        print(f"[API] /resources/load query failed: {e}")

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
@cached(ttl=60, key_prefix="resources")
async def get_resource_usage():
    try:
        rows = _query_db("""
            SELECT
                AVG(cpu_usage_pct)     AS cpu,
                AVG(gpu_usage_pct)     AS gpu,
                AVG(disk_usage_pct)    AS disk,
                AVG(network_in_mbps)   AS network
            FROM (
                SELECT DISTINCT ON (node_id)
                    cpu_usage_pct, gpu_usage_pct, disk_usage_pct, network_in_mbps
                FROM ts_node_metric
                ORDER BY node_id, metric_time DESC
            ) sub
        """)
        if rows and rows[0]["cpu"] is not None:
            r = rows[0]
            return [
                {"name": "CPU", "value": round(float(r["cpu"]), 1)},
                {"name": "GPU", "value": round(float(r["gpu"]), 1)},
                {"name": "存储", "value": round(float(r["disk"]), 1)},
                {"name": "网络", "value": round(float(r["network"]), 1)},
            ]
    except Exception as e:
        print(f"[API] /resources/usage query failed: {e}")

    return [
        {"name": "CPU", "value": round(random.uniform(40, 80), 1)},
        {"name": "GPU", "value": round(random.uniform(30, 70), 1)},
        {"name": "存储", "value": round(random.uniform(30, 60), 1)},
        {"name": "网络", "value": round(random.uniform(20, 50), 1)},
    ]


@router.get("/resources/trend")
@cached(ttl=120, key_prefix="resources")
async def get_resource_trend():
    try:
        rows = _query_db("""
            SELECT
                metric_time,
                avg_cpu_pct,
                avg_memory_pct,
                avg_gpu_pct
            FROM ts_resource_trend_5m
            ORDER BY metric_time
        """)
        if rows:
            day_map: dict[str, dict] = {}
            for r in rows:
                mt = r["metric_time"]
                day = mt.strftime("%Y-%m-%d")
                time_label = mt.strftime("%H:%M")
                if day not in day_map:
                    day_map[day] = {"times": [], "cpu": [], "mem": [], "gpu": []}
                day_map[day]["times"].append(time_label)
                day_map[day]["cpu"].append(round(float(r["avg_cpu_pct"]), 1))
                day_map[day]["mem"].append(round(float(r["avg_memory_pct"]), 1))
                day_map[day]["gpu"].append(round(float(r["avg_gpu_pct"]), 1))

            days = sorted(day_map.keys())

            def avg(arr):
                return round(sum(arr) / len(arr), 1) if arr else 0

            daily_overview = {
                "x": days,
                "series": [
                    {"name": "CPU 利用率", "data": [avg(day_map[d]["cpu"]) for d in days]},
                    {"name": "内存利用率", "data": [avg(day_map[d]["mem"]) for d in days]},
                    {"name": "GPU 利用率", "data": [avg(day_map[d]["gpu"]) for d in days]},
                ],
            }

            daily_detail = {}
            for d in days:
                info = day_map[d]
                daily_detail[d] = {
                    "x": info["times"],
                    "series": [
                        {"name": "CPU 利用率", "data": info["cpu"]},
                        {"name": "内存利用率", "data": info["mem"]},
                        {"name": "GPU 利用率", "data": info["gpu"]},
                    ],
                }

            return {"dailyOverview": daily_overview, "dailyDetail": daily_detail}
    except Exception as e:
        print(f"[API] /resources/trend query failed: {e}")

    time_points = ["10:00", "11:00", "12:00", "13:00", "14:00"]
    return {
        "dailyOverview": {
            "x": ["2026-05-14"],
            "series": [
                {"name": "CPU 利用率", "data": [round(random.uniform(45, 85), 1)]},
                {"name": "内存利用率", "data": [round(random.uniform(35, 75), 1)]},
                {"name": "GPU 利用率", "data": [round(random.uniform(20, 65), 1)]},
            ],
        },
        "dailyDetail": {
            "2026-05-14": {
                "x": time_points,
                "series": [
                    {"name": "CPU 利用率", "data": [round(random.uniform(45, 85), 1) for _ in time_points]},
                    {"name": "内存利用率", "data": [round(random.uniform(35, 75), 1) for _ in time_points]},
                    {"name": "GPU 利用率", "data": [round(random.uniform(20, 65), 1) for _ in time_points]},
                ],
            }
        },
    }


# =========================================================
# TaskManagement 页面专用：全国算力节点分布
# =========================================================
@router.get("/resources/map")
@cached(ttl=300, key_prefix="resources")
async def get_map_nodes():
    try:
        rows = _query_db(
            "SELECT name, longitude, latitude, compute_power, center_level "
            "FROM dim_supercomputing_center "
            "WHERE is_active = true "
            "ORDER BY compute_power DESC"
        )
        return [
            {
                "name": r["name"],
                "longitude": r["longitude"],
                "latitude": r["latitude"],
                "capacity": r["compute_power"],
                "level": r["center_level"] or "区域级",
            }
            for r in rows
        ]
    except Exception as e:
        print(f"[API] /resources/map query failed: {e}")
        return []


@router.get("/resources/predict/dates")
async def predict_available_dates():
    try:
        dates = get_available_dates()
        return {"dates": dates}
    except Exception as e:
        print(f"[API] /resources/predict/dates failed: {e}")
        return {"dates": []}


@router.get("/resources/predict/trend")
async def predict_trend(date: str = Query(..., description="查询日期，格式 YYYY-MM-DD")):
    try:
        result = await get_realtime_prediction(date)
        if result:
            return result
        return {
            "date": date,
            "x": [],
            "currentTimeIndex": -1,
            "series": [],
        }
    except Exception as e:
        print(f"[API] /resources/predict/trend failed: {e}")
        return {"date": date, "x": [], "currentTimeIndex": -1, "series": []}


@router.get("/resources/predict/overview")
async def predict_overview():
    try:
        return get_daily_overview()
    except Exception as e:
        print(f"[API] /resources/predict/overview failed: {e}")
        return {"x": [], "series": []}

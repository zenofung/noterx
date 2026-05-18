import os
import sqlite3
import sys
import tempfile

from fastapi import FastAPI
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.api import admin_api, visit_api


def _create_admin_test_db():
    fd, path = tempfile.mkstemp(suffix=".db")
    os.close(fd)
    conn = sqlite3.connect(path)
    conn.execute("CREATE TABLE notes (id INTEGER PRIMARY KEY, category TEXT)")
    conn.execute("INSERT INTO notes (category) VALUES ('food')")
    conn.execute("""
        CREATE TABLE baseline_stats (
            id INTEGER PRIMARY KEY,
            category TEXT,
            metric_name TEXT,
            metric_value REAL,
            metric_json TEXT,
            updated_at TIMESTAMP
        )
    """)
    conn.execute("""
        CREATE TABLE usage_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ip TEXT NOT NULL,
            action TEXT NOT NULL DEFAULT 'diagnose',
            title TEXT DEFAULT '',
            category TEXT DEFAULT '',
            total_tokens INTEGER DEFAULT 0,
            duration_sec REAL DEFAULT 0,
            status TEXT DEFAULT 'ok',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.execute("""
        CREATE TABLE visit_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            visitor_hash TEXT NOT NULL,
            user_agent_hash TEXT DEFAULT '',
            path TEXT NOT NULL,
            referrer TEXT DEFAULT '',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.commit()
    conn.close()
    return path


def test_admin_stats_reports_real_visit_uv_separate_from_diagnosis_usage():
    db = _create_admin_test_db()
    original_db = admin_api.DB_PATH
    admin_api.DB_PATH = db
    try:
        conn = sqlite3.connect(db)
        conn.execute("INSERT INTO usage_log (ip, action, title, category) VALUES ('1.1.1.1', 'diagnose', 'A', 'food')")
        conn.execute("INSERT INTO visit_log (visitor_hash, user_agent_hash, path) VALUES ('visitor-a', 'ua', '/app')")
        conn.execute("INSERT INTO visit_log (visitor_hash, user_agent_hash, path) VALUES ('visitor-a', 'ua', '/report')")
        conn.execute("INSERT INTO visit_log (visitor_hash, user_agent_hash, path) VALUES ('visitor-b', 'ua', '/privacy')")
        conn.commit()
        conn.close()

        stats = admin_api._get_stats()

        assert stats["total_requests"] == 1
        assert stats["unique_ips"] == 1
        assert stats["total_pv"] == 3
        assert stats["total_uv"] == 2
        assert stats["today_pv"] == 3
        assert stats["today_uv"] == 2
        assert stats["visits_by_path"] == {"/app": 1, "/privacy": 1, "/report": 1}
    finally:
        admin_api.DB_PATH = original_db
        os.unlink(db)


def test_visit_endpoint_accepts_text_plain_beacon_payload():
    db = _create_admin_test_db()
    original_db = visit_api.DB_PATH
    visit_api.DB_PATH = db
    try:
        app = FastAPI()
        app.include_router(visit_api.router, prefix="/api")
        client = TestClient(app)

        response = client.post(
            "/api/visit",
            content='{"path":"/app","referrer":"https://example.com/from"}',
            headers={"content-type": "text/plain;charset=UTF-8", "user-agent": "BeaconBrowser"},
        )

        assert response.status_code == 200
        assert response.json() == {"ok": True}

        conn = sqlite3.connect(db)
        cur = conn.cursor()
        cur.execute("SELECT path FROM visit_log")
        assert cur.fetchone() == ("/app",)
        conn.close()
    finally:
        visit_api.DB_PATH = original_db
        os.unlink(db)


def test_log_visit_deduplicates_visitor_by_ip_and_user_agent():
    db = _create_admin_test_db()
    original_db = visit_api.DB_PATH
    visit_api.DB_PATH = db
    try:
        first = visit_api.log_visit("9.9.9.9", "Mozilla/5.0", "/app", "")
        second = visit_api.log_visit("9.9.9.9", "Mozilla/5.0", "/report", "")
        third = visit_api.log_visit("8.8.8.8", "Mozilla/5.0", "/app", "")

        assert first == second
        assert third != first

        conn = sqlite3.connect(db)
        cur = conn.cursor()
        cur.execute("SELECT COUNT(*), COUNT(DISTINCT visitor_hash) FROM visit_log")
        assert cur.fetchone() == (3, 2)
        conn.close()
    finally:
        visit_api.DB_PATH = original_db
        os.unlink(db)

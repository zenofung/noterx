import os
import logging
import pymysql
from pymysql.cursors import DictCursor
from dbutils.pooled_db import PooledDB

logger = logging.getLogger("noterx.mysql")

# Global connection pool instance
_pool = None

def get_mysql_config():
    """Retrieve MySQL credentials from environment variables."""
    return {
        "host": os.getenv("MYSQL_HOST", "127.0.0.1"),
        "port": int(os.getenv("MYSQL_PORT", "3306")),
        "user": os.getenv("MYSQL_USER", "root"),
        "password": os.getenv("MYSQL_PASSWORD", "root"),
        "database": os.getenv("MYSQL_DATABASE", "noterx"),
        "charset": "utf8mb4",
    }

def init_db_pool():
    """Initialize DBUtils MySQL connection pool. Called at FastAPI startup."""
    global _pool
    if _pool is not None:
        return

    config = get_mysql_config()
    try:
        logger.info(f"Initializing MySQL connection pool (Host: {config['host']}:{config['port']}, DB: {config['database']})")
        _pool = PooledDB(
            creator=pymysql,
            mincached=2,      # Minimum idle connections kept in pool
            maxcached=10,     # Maximum idle connections kept in pool
            maxconnections=20, # Maximum connections allowed
            blocking=True,    # Wait if max connections reached
            ping=7,           # Ping connection (7 = check connection before execution)
            **config
        )
        logger.info("MySQL connection pool initialized successfully.")
    except Exception as e:
        logger.error(f"Failed to initialize MySQL connection pool: {str(e)}")
        # Let it fail gracefully during startup, query execution will raise explicit errors
        _pool = None

def get_connection():
    """Get a connection from pool. Initializes the pool if not done yet."""
    global _pool
    if _pool is None:
        init_db_pool()
    if _pool is None:
        raise RuntimeError("MySQL connection pool is not initialized and could not be started.")
    return _pool.connection()

def execute_query(sql: str, params: tuple = None) -> list[dict]:
    """Execute a query returning rows (SELECT). Returns list of dictionaries."""
    conn = get_connection()
    try:
        with conn.cursor(DictCursor) as cursor:
            cursor.execute(sql, params)
            return cursor.fetchall()
    except Exception as e:
        logger.error(f"Database query error: {sql} | Error: {str(e)}")
        raise e
    finally:
        conn.close()

def execute_query_one(sql: str, params: tuple = None) -> dict | None:
    """Execute a query returning at most one row. Returns dictionary or None."""
    rows = execute_query(sql, params)
    return rows[0] if rows else None

def execute_update(sql: str, params: tuple = None, return_lastrowid: bool = False) -> int:
    """Execute a DML query (INSERT/UPDATE/DELETE). Returns affected rows or last insert id."""
    conn = get_connection()
    try:
        with conn.cursor() as cursor:
            affected_rows = cursor.execute(sql, params)
            conn.commit()
            if return_lastrowid:
                return cursor.lastrowid
            return affected_rows
    except Exception as e:
        conn.rollback()
        logger.error(f"Database update error: {sql} | Error: {str(e)}")
        raise e
    finally:
        conn.close()

def execute_transaction(statements: list[tuple[str, tuple]]) -> bool:
    """Execute multiple statements in a single transaction."""
    conn = get_connection()
    try:
        with conn.cursor() as cursor:
            for sql, params in statements:
                cursor.execute(sql, params)
        conn.commit()
        return True
    except Exception as e:
        conn.rollback()
        logger.error(f"Database transaction error: {str(e)}")
        raise e
    finally:
        conn.close()

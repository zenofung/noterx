"""
Initialize MySQL database schema and seed mock data for NoteRx Admin.

Usage:
    python scripts/seed_mysql.py
"""
import os
import sys
import json
import uuid
import random
from datetime import datetime, timedelta

# Ensure backend directory is in path
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(os.path.join(project_root, "backend"))

from dotenv import load_dotenv
env_path = os.path.join(project_root, ".env")
if os.path.exists(env_path):
    load_dotenv(env_path)

import pymysql

def get_connection(use_db=True):
    host = os.getenv("MYSQL_HOST", "127.0.0.1")
    port = int(os.getenv("MYSQL_PORT", "3306"))
    user = os.getenv("MYSQL_USER", "root")
    password = os.getenv("MYSQL_PASSWORD", "root")
    database = os.getenv("MYSQL_DATABASE", "noterx")
    
    return pymysql.connect(
        host=host,
        port=port,
        user=user,
        password=password,
        database=database if use_db else None,
        charset="utf8mb4",
        cursorclass=pymysql.cursors.DictCursor
    )

def run_ddl():
    print("Connecting to MySQL server to verify database...")
    # First connect without specifying database to create it if it doesn't exist
    conn = get_connection(use_db=False)
    db_name = os.getenv("MYSQL_DATABASE", "noterx")
    try:
        with conn.cursor() as cursor:
            cursor.execute(f"CREATE DATABASE IF NOT EXISTS {db_name} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;")
        conn.commit()
    finally:
        conn.close()
        
    print(f"Database '{db_name}' verified/created. Connecting to it...")
    conn = get_connection(use_db=True)
    try:
        schema_path = os.path.join(project_root, "backend", "scripts", "schema.sql")
        if not os.path.exists(schema_path):
            print(f"Error: Schema SQL file not found at {schema_path}", file=sys.stderr)
            sys.exit(1)
            
        with open(schema_path, "r", encoding="utf-8") as f:
            sql_content = f.read()
            
        # Split statements by semicolon
        # We need to filter out comments and empty lines
        statements = []
        current_statement = []
        for line in sql_content.split("\n"):
            stripped = line.strip()
            if not stripped or stripped.startswith("--"):
                continue
            current_statement.append(line)
            if stripped.endswith(";"):
                statements.append("\n".join(current_statement))
                current_statement = []
                
        with conn.cursor() as cursor:
            # We disable foreign key checks during schema creation / drop to make it easy
            cursor.execute("SET FOREIGN_KEY_CHECKS = 0;")
            
            # Optionally drop existing tables to refresh
            print("Dropping existing tables to refresh data...")
            tables = ["customer_feedback", "video_analysis_history", "usage_log", "diagnosis_history", "login_logs", "sms_verification_codes", "users"]
            for table in tables:
                cursor.execute(f"DROP TABLE IF EXISTS {table};")
                
            print("Creating tables from schema.sql...")
            for stmt in statements:
                # Skip 'CREATE DATABASE' and 'USE' since we already handled database creation/connection
                if "CREATE DATABASE" in stmt.upper() or "USE " in stmt.upper():
                    continue
                cursor.execute(stmt)
                
            cursor.execute("SET FOREIGN_KEY_CHECKS = 1;")
        conn.commit()
        print("Schema DDL executed successfully.")
    except Exception as e:
        print(f"Failed to execute schema DDL: {str(e)}", file=sys.stderr)
        conn.rollback()
        conn.close()
        sys.exit(1)
    finally:
        conn.close()

def seed_data():
    conn = get_connection(use_db=True)
    try:
        print("Seeding mock users...")
        users = []
        # Add a test admin (though code bypasses database check for admin, we keep it in DB for consistency)
        users.append({
            "id": "admin-uuid-1111-2222-333333333333",
            "phone": "13800000000",
            "wechat_openid": "owx_admin_openid_123456",
            "wechat_unionid": "union_admin_unionid_123456",
            "nickname": "系统管理员",
            "avatar_url": "https://api.dicebear.com/7.x/bottts/svg?seed=admin",
            "role": "admin",
            "is_guest": False,
            "created_at": datetime.now() - timedelta(days=30)
        })
        
        # Add normal users
        nicknames = ["秋天的落叶", "科技狂魔小张", "美妆博主丽丽", "健身达人阿强", "美食点评家老王", "行走的背包", "极简生活家", "大板栗", "爱折腾的数码控", "深夜食堂老板"]
        phones = ["13911112222", "13700001111", "18622223333", "15044445555", "18966667777", "13588889999", "13699990000", "15811113333", "18599998888", "13011112222"]
        
        for i in range(10):
            users.append({
                "id": str(uuid.uuid4()),
                "phone": phones[i],
                "wechat_openid": f"owx_openid_user_{i}",
                "wechat_unionid": f"union_unionid_user_{i}",
                "nickname": nicknames[i],
                "avatar_url": f"https://api.dicebear.com/7.x/adventurer/svg?seed={nicknames[i]}",
                "role": "user",
                "is_guest": False,
                "created_at": datetime.now() - timedelta(days=random.randint(1, 25), hours=random.randint(0, 23))
            })
            
        # Add guest users
        for i in range(5):
            users.append({
                "id": str(uuid.uuid4()),
                "phone": None,
                "wechat_openid": None,
                "wechat_unionid": None,
                "nickname": f"游客_{random.randint(1000, 9999)}",
                "avatar_url": f"https://api.dicebear.com/7.x/identicon/svg?seed=guest_{i}",
                "role": "user",
                "is_guest": True,
                "created_at": datetime.now() - timedelta(days=random.randint(1, 5), hours=random.randint(0, 23))
            })
            
        with conn.cursor() as cursor:
            for u in users:
                cursor.execute(
                    "INSERT INTO users (id, phone, wechat_openid, wechat_unionid, nickname, avatar_url, role, is_guest, created_at) "
                    "VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)",
                    (u["id"], u["phone"], u["wechat_openid"], u["wechat_unionid"], u["nickname"], u["avatar_url"], u["role"], u["is_guest"], u["created_at"])
                )
        print(f"Seeded {len(users)} users.")

        # Seed diagnoses history
        print("Seeding mock diagnosis history...")
        categories = ["food", "fashion", "tech", "travel", "beauty", "fitness", "lifestyle", "home"]
        titles = {
            "food": ["5分钟搞定懒人减脂早餐", "探秘街角的老火锅排队王", "在家复刻日式流心溏心蛋"],
            "fashion": ["微胖女孩的显瘦遮肉穿搭公式", "一周不重样的高级通勤OOTD", "小个子视觉增高5cm神仙搭配"],
            "tech": ["2026最强生产力平板评测", "普通人的第一套全屋智能指南", "程序员效率翻倍的开源神器"],
            "travel": ["大理3天2晚穷游避坑攻略", "人均1000玩转江浙沪小众海岛", "独自去西藏前必须知道的10件事"],
            "beauty": ["黄皮狂喜！10支平价显白口红", "保姆级5分钟快速出门消肿淡妆", "敏感肌换季抗敏护肤品红黑榜"],
            "fitness": ["新手居家10分钟无氧核心燃脂", "帕梅拉臀腿塑形15天跟练挑战", "每天这样拉伸5分钟告别圆肩驼背"],
            "lifestyle": ["独居女生的精致治愈周末vlog", "我的断舍离极简生活100天变化", "低成本提升出租屋幸福感的好物"],
            "home": ["40平LOFT极致空间收纳改造", "奶油风客厅硬装软装花费清单", "宜家必入的十款百元家居神器"]
        }
        
        diagnoses = []
        user_ids = [u["id"] for u in users if u["role"] == "user"]
        
        for _ in range(35):
            cat = random.choice(categories)
            title = random.choice(titles[cat])
            user_id = random.choice(user_ids)
            score = round(random.uniform(65.0, 95.0), 1)
            
            if score >= 90.0:
                grade = "S"
            elif score >= 80.0:
                grade = "A"
            elif score >= 70.0:
                grade = "B"
            else:
                grade = "C"
                
            report_mock = {
                "title_analysis": {
                    "score": score,
                    "suggestion": "标题包含痛点和数字，吸引力强。可以加入适当的感叹号或Emoji表情增加氛围感。"
                },
                "content_analysis": {
                    "score": score + random.randint(-5, 5),
                    "suggestion": "排版工整，痛点清晰。建议在首屏前3行直接抛出最吸引人的核心利益点。"
                },
                "cover_analysis": {
                    "score": score + random.randint(-8, 5),
                    "suggestion": "主色调亮眼，有文字提炼。若能把人脸或成品特写放大15%会更吸睛。"
                },
                "overall_suggestion": "该笔记定位精准，切中用户痛点，整体逻辑严密。建议配合发布时段（12:00-13:00）发布以获得更大自然流量。"
            }
            
            diagnoses.append({
                "id": str(uuid.uuid4()),
                "user_id": user_id,
                "title": title,
                "category": cat,
                "overall_score": score,
                "grade": grade,
                "report_json": json.dumps(report_mock, ensure_ascii=False),
                "created_at": datetime.now() - timedelta(days=random.randint(1, 20), hours=random.randint(0, 23))
            })
            
        with conn.cursor() as cursor:
            for d in diagnoses:
                cursor.execute(
                    "INSERT INTO diagnosis_history (id, user_id, title, category, overall_score, grade, report_json, created_at) "
                    "VALUES (%s, %s, %s, %s, %s, %s, %s, %s)",
                    (d["id"], d["user_id"], d["title"], d["category"], d["overall_score"], d["grade"], d["report_json"], d["created_at"])
                )
        print(f"Seeded {len(diagnoses)} diagnosis records.")

        # Seed video analyses
        print("Seeding mock video analyses...")
        video_titles = [
            "教你在家做超松软的手工生吐司，保姆级教程，新手一次成功！",
            "微胖女孩如何穿出清冷高级感？避开这3个穿搭误区！",
            "2026年最不后悔入手的数码单品！深度体验一个月报告",
            "川西三天两晚路线怎么走？看这一篇视频就够了，全是干货！",
            "我的保姆级夜间护肤步骤，抗老抗暗沉，皮肤细腻发光秘诀"
        ]
        authors = ["烘焙大师阿强", "穿搭博主木子", "科技狂魔小张", "背包客大伟", "美妆达人丽丽"]
        video_urls = [
            "https://www.douyin.com/video/7311111111111111111",
            "https://www.douyin.com/video/7322222222222222222",
            "https://www.douyin.com/video/7333333333333333333",
            "https://www.douyin.com/video/7344444444444444444",
            "https://www.douyin.com/video/7355555555555555555"
        ]
        
        video_analyses = []
        for i in range(len(video_titles)):
            task_id = f"video-task-uuid-{i}"
            user_id = random.choice(user_ids)
            created_at = datetime.now() - timedelta(days=random.randint(1, 10), hours=random.randint(0, 23))
            started_at = created_at + timedelta(seconds=15)
            completed_at = started_at + timedelta(seconds=random.randint(45, 90))
            elapsed = (completed_at - started_at).total_seconds()
            
            score = random.randint(75, 96)
            if score >= 90:
                level = "高"
            elif score >= 80:
                level = "中"
            else:
                level = "低"
                
            report_mock = {
                "task_id": task_id,
                "video_meta": {
                    "title": video_titles[i],
                    "author": authors[i],
                    "author_id": f"author_id_{i}",
                    "likes": random.randint(5000, 150000),
                    "comments": random.randint(200, 8000),
                    "shares": random.randint(100, 30000),
                    "duration": round(random.uniform(15.0, 120.0), 1),
                    "thumbnail_url": f"https://images.unsplash.com/photo-{1500000000000 + i*100000}?w=400"
                },
                "viral_analysis": {
                    "hook_score": score + random.randint(-5, 3),
                    "hook_analysis": "开头黄金3秒通过强烈的视觉反差或者直切痛点快速抓住用户眼球，吸睛率极高。",
                    "pacing_analysis": "视频剪辑紧凑，无余废镜头。音频配乐与画面卡点精准，情绪烘托到位。",
                    "emotional_arc": "开头激发痛点焦虑 -> 中段细致拆解释疑 -> 结尾爽快展示结果，情绪曲线非常完整。",
                    "key_viral_factors": ["痛点引入精准", "画面高清明亮", "文案口语化接地气", "转场利落"],
                    "target_audience": "泛生活受众，追求效率与美感的年轻人",
                    "content_formula": "反差视觉痛点 + 逻辑步骤拆解 + 情绪饱满结果呈现",
                    "recreation_blueprint": "翻拍时可增强开场的视觉反差，在第5秒及第15秒处设置互动引导（如点赞、评论讨论）。"
                }
            }
            
            video_analyses.append({
                "task_id": task_id,
                "user_id": user_id,
                "video_url": video_urls[i],
                "video_title": video_titles[i],
                "author_name": authors[i],
                "author_id": f"author_id_{i}",
                "duration": report_mock["video_meta"]["duration"],
                "likes": report_mock["video_meta"]["likes"],
                "comments": report_mock["video_meta"]["comments"],
                "shares": report_mock["video_meta"]["shares"],
                "publish_time": created_at - timedelta(days=2),
                "viral_score": score,
                "viral_level": level,
                "hook_score": report_mock["viral_analysis"]["hook_score"],
                "pacing_score": random.randint(70, 95),
                "emotion_score": random.randint(70, 95),
                "comment_bait_score": random.randint(70, 95),
                "share_bait_score": random.randint(70, 95),
                "cover_title_score": random.randint(70, 95),
                "created_at": created_at,
                "started_at": started_at,
                "completed_at": completed_at,
                "elapsed_seconds": elapsed,
                "report_json": json.dumps(report_mock, ensure_ascii=False)
            })
            
        with conn.cursor() as cursor:
            for v in video_analyses:
                cursor.execute(
                    "INSERT INTO video_analysis_history (task_id, user_id, video_url, video_title, author_name, author_id, "
                    "       duration, likes, comments, shares, publish_time, viral_score, viral_level, hook_score, pacing_score, "
                    "       emotion_score, comment_bait_score, share_bait_score, cover_title_score, created_at, started_at, "
                    "       completed_at, elapsed_seconds, report_json) "
                    "VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)",
                    (v["task_id"], v["user_id"], v["video_url"], v["video_title"], v["author_name"], v["author_id"],
                     v["duration"], v["likes"], v["comments"], v["shares"], v["publish_time"], v["viral_score"], v["viral_level"],
                     v["hook_score"], v["pacing_score"], v["emotion_score"], v["comment_bait_score"], v["share_bait_score"],
                     v["cover_title_score"], v["created_at"], v["started_at"], v["completed_at"], v["elapsed_seconds"], v["report_json"])
                )
        print(f"Seeded {len(video_analyses)} video analyses.")

        # Seed customer feedbacks
        print("Seeding customer feedbacks...")
        feedbacks = []
        feedback_messages = [
            "AI的诊断真的很准！我的笔记修改之后确实涨粉了，想咨询一下有没有更深度的定制分析合作？",
            "视频拉片里面的运镜建议很有帮助，不过有些名词我不太懂（比如三分法构图），有没有更通俗的解释？",
            "测试反馈：在上传特别大的视频时，页面偶尔会卡死，希望能优化一下进度条的稳定性。",
            "为什么有些热门的抖音链接解析会失败？希望能支持更多平台比如小红书视频的拉片分析。",
            "非常喜欢这个系统的诊断功能，界面也好看！希望能推出批量诊断笔记的功能，付费也可以！"
        ]
        
        # Link feedbacks to notes and videos
        for i in range(len(feedback_messages)):
            if i < 3: # Link to note
                ref_item = diagnoses[i]
                res_type = "note"
                res_id = ref_item["id"]
                title = ref_item["title"]
                rep_json = ref_item["report_json"]
            else: # Link to video
                ref_item = video_analyses[i - 3]
                res_type = "video"
                res_id = ref_item["task_id"]
                title = ref_item["video_title"]
                rep_json = ref_item["report_json"]
                
            feedbacks.append({
                "user_id": ref_item["user_id"],
                "result_id": res_id,
                "result_type": res_type,
                "report_title": title,
                "report_json": rep_json,
                "message_content": feedback_messages[i],
                "contact_info": f"13{random.randint(0,9)}1111{random.randint(1000,9999)}@163.com" if i % 2 == 0 else f"13{random.randint(10,99)}99998888",
                "created_at": datetime.now() - timedelta(days=random.randint(1, 5), hours=random.randint(0, 23))
            })
            
        with conn.cursor() as cursor:
            for f in feedbacks:
                cursor.execute(
                    "INSERT INTO customer_feedback (user_id, result_id, result_type, report_title, report_json, message_content, contact_info, created_at) "
                    "VALUES (%s, %s, %s, %s, %s, %s, %s, %s)",
                    (f["user_id"], f["result_id"], f["result_type"], f["report_title"], f["report_json"], f["message_content"], f["contact_info"], f["created_at"])
                )
        conn.commit()
        print(f"Seeded {len(feedbacks)} customer feedbacks successfully!")
        
    except Exception as e:
        print(f"Seeding failed: {str(e)}", file=sys.stderr)
        conn.rollback()
        conn.close()
        sys.exit(1)
    finally:
        conn.close()

if __name__ == "__main__":
    run_ddl()
    seed_data()
    print("\nSUCCESS: MySQL database has been fully initialized and seeded!")

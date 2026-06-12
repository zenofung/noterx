-- Create database
CREATE DATABASE IF NOT EXISTS noterx CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE noterx;

-- 1. users table
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(36) PRIMARY KEY COMMENT '用户唯一UUID',
    phone VARCHAR(20) UNIQUE COMMENT '手机号',
    wechat_openid VARCHAR(64) UNIQUE COMMENT '微信公众号/网页OpenID',
    wechat_unionid VARCHAR(64) UNIQUE COMMENT '微信开放平台UnionID',
    nickname VARCHAR(50) NOT NULL COMMENT '用户昵称',
    avatar_url VARCHAR(255) DEFAULT '' COMMENT '头像链接',
    role VARCHAR(20) NOT NULL DEFAULT 'user' COMMENT '角色: user=普通用户, admin=管理员',
    is_guest BOOLEAN NOT NULL DEFAULT FALSE COMMENT '是否是临时游客账户',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '注册时间',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    INDEX idx_phone (phone),
    INDEX idx_wechat_openid (wechat_openid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户账号表';

-- 2. sms verification codes table
CREATE TABLE IF NOT EXISTS sms_verification_codes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    phone VARCHAR(20) NOT NULL COMMENT '目标手机号',
    code VARCHAR(6) NOT NULL COMMENT '6位验证码',
    is_used BOOLEAN DEFAULT FALSE COMMENT '是否已使用',
    expire_at TIMESTAMP NOT NULL COMMENT '过期时间',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '生成时间',
    INDEX idx_phone_code (phone, code, expire_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='短信验证码验证记录表';

-- 3. user login logs table
CREATE TABLE IF NOT EXISTS login_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL COMMENT '关联用户ID',
    login_type VARCHAR(20) NOT NULL COMMENT '登录方式: sms, wechat, guest',
    ip_address VARCHAR(45) DEFAULT '' COMMENT '登录IP',
    user_agent VARCHAR(255) DEFAULT '' COMMENT '浏览器UA',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '登录时间',
    INDEX idx_user_id (user_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户登录日志表';

-- 4. diagnosis history table (migrated to MySQL for admin panel statistics)
CREATE TABLE IF NOT EXISTS diagnosis_history (
    id VARCHAR(36) PRIMARY KEY COMMENT '报告唯一UUID',
    user_id VARCHAR(36) NULL COMMENT '发起用户ID(游客或已登录用户)',
    title VARCHAR(255) NOT NULL COMMENT '笔记标题',
    category VARCHAR(50) NOT NULL COMMENT '类别',
    overall_score REAL COMMENT '综合得分',
    grade VARCHAR(5) COMMENT '评级',
    report_json LONGTEXT NOT NULL COMMENT '完整拉片/诊断诊断报告(JSON)',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '诊断时间',
    INDEX idx_user_id (user_id),
    INDEX idx_created_at (created_at DESC),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='诊断报告历史表';

-- 5. usage logs table
CREATE TABLE IF NOT EXISTS usage_log (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(36) NULL COMMENT '调用者ID',
    ip VARCHAR(45) NOT NULL COMMENT 'IP地址',
    action VARCHAR(50) NOT NULL DEFAULT 'diagnose' COMMENT '开发接口类型',
    title VARCHAR(255) DEFAULT '' COMMENT '调用素材标题',
    category VARCHAR(50) DEFAULT '' COMMENT '垂类',
    total_tokens INT DEFAULT 0 COMMENT '消耗的总Token数',
    duration_sec REAL DEFAULT 0 COMMENT 'API响应耗时',
    status VARCHAR(20) DEFAULT 'ok' COMMENT '调用状态',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '调用时间',
    INDEX idx_user_id (user_id),
    INDEX idx_created_at (created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='API接口调用统计表';

-- 6. video analysis history table (for detailed statistics and administration)
CREATE TABLE IF NOT EXISTS video_analysis_history (
    task_id VARCHAR(36) PRIMARY KEY COMMENT '任务唯一ID',
    user_id VARCHAR(36) NULL COMMENT '关联用户ID',
    video_url VARCHAR(512) NOT NULL COMMENT '用户输入的抖音链接',
    
    -- 视频元数据 (Video Metadata)
    video_title VARCHAR(255) DEFAULT '' COMMENT '视频标题',
    author_name VARCHAR(100) DEFAULT '' COMMENT '作者昵称',
    author_id VARCHAR(100) DEFAULT '' COMMENT '作者ID',
    duration DECIMAL(10, 2) DEFAULT 0.00 COMMENT '视频时长(秒)',
    likes INT DEFAULT NULL COMMENT '获赞数',
    comments INT DEFAULT NULL COMMENT '评论数',
    shares INT DEFAULT NULL COMMENT '分享数',
    publish_time TIMESTAMP NULL COMMENT '发布时间',
    
    -- 爆款多维度评分 (AI Ratings)
    viral_score INT DEFAULT NULL COMMENT '爆款得分',
    viral_level VARCHAR(20) DEFAULT '' COMMENT '爆款等级(低/中/高)',
    hook_score INT DEFAULT NULL COMMENT '3秒黄金钩子得分',
    pacing_score INT DEFAULT NULL COMMENT '节奏把控得分',
    emotion_score INT DEFAULT NULL COMMENT '情绪张力得分',
    comment_bait_score INT DEFAULT NULL COMMENT '互动诱饵得分',
    share_bait_score INT DEFAULT NULL COMMENT '分享传播得分',
    cover_title_score INT DEFAULT NULL COMMENT '封面标题得分',
    
    -- 时间统计 (Timestamps & Elapsed)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '任务创建时间',
    started_at TIMESTAMP NULL COMMENT '任务开始执行时间',
    completed_at TIMESTAMP NULL COMMENT '任务完成时间',
    elapsed_seconds DECIMAL(10, 2) DEFAULT NULL COMMENT 'AI处理总耗时(秒)',
    
    -- 完整 JSON 结构 (Full Report payload)
    report_json LONGTEXT NULL COMMENT '完整拉片分析报告数据(JSON)',
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_user_id (user_id),
    INDEX idx_created_at (created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='短视频拉片分析历史表';

-- 7. 客服留言表 (包含诊断结果备份与联系方式)
CREATE TABLE IF NOT EXISTS customer_feedback (
    id INT AUTO_INCREMENT PRIMARY KEY COMMENT '留言唯一ID',
    user_id VARCHAR(36) NULL COMMENT '关联用户ID(可选)',
    result_id VARCHAR(36) NULL COMMENT '关联报告ID (Note诊断ID 或 Video任务ID)',
    result_type VARCHAR(20) NOT NULL COMMENT '报告类型: note, video',
    report_title VARCHAR(255) COMMENT '分析报告标题',
    report_json LONGTEXT COMMENT '当时分析结果备份(JSON)',
    message_content TEXT NOT NULL COMMENT '留言内容',
    contact_info VARCHAR(100) NOT NULL COMMENT '联系手机号或邮箱',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '留言时间',
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_user_id (user_id),
    INDEX idx_created_at (created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='联系客服留言表';


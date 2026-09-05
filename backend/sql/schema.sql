-- ============================================================
--  智能旅游助手系统 · 数据库初始化脚本
--
--  适用版本：MySQL 5.7+ 或 MySQL 8.0
--  导入方式任选其一：
--    1. 命令行： mysql -u root -p < sql/schema.sql
--    2. 图形化： Navicat / DataGrip / SQLyog 打开后全选执行
--    3. 脚本  ： npm run init-db
--
--  可重复执行：脚本开头会先删旧表再重建，不会报错
-- ============================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

CREATE DATABASE IF NOT EXISTS travel_ai
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

USE travel_ai;

-- 按依赖倒序删除，避免外键约束导致删除失败
DROP TABLE IF EXISTS chat_messages;
DROP TABLE IF EXISTS chat_sessions;
DROP TABLE IF EXISTS itineraries;
DROP TABLE IF EXISTS users;

SET FOREIGN_KEY_CHECKS = 1;

-- ------------------------------------------------------------
-- 1. 用户表
-- ------------------------------------------------------------
CREATE TABLE users (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT              COMMENT '用户ID',
  username    VARCHAR(50)  NOT NULL                             COMMENT '用户名，唯一',
  password    VARCHAR(255) NOT NULL                             COMMENT '密码，bcrypt 加盐哈希后存储',
  nickname    VARCHAR(50)  DEFAULT NULL                         COMMENT '昵称',
  avatar      VARCHAR(255) DEFAULT NULL                         COMMENT '头像地址',
  preferences JSON         DEFAULT NULL                         COMMENT '旅行偏好档案 JSON（常驻城市/默认预算/天数/主题等，用于规划表单预填）',
  created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP                              COMMENT '注册时间',
  updated_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP  COMMENT '最后更新时间',
  PRIMARY KEY (id),
  UNIQUE KEY uk_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户表';

-- ------------------------------------------------------------
-- 2. 行程表
--
--    设计说明：
--    行程正文（每日安排、预算明细、提示）结构复杂且会随业务演进，
--    因此存为 JSON 列，避免频繁 ALTER TABLE；
--    而 city / budget / days / user_id 这类高频检索与统计字段
--    提升为独立列并建索引，兼顾灵活性与查询性能。
-- ------------------------------------------------------------
CREATE TABLE itineraries (
  id          INT UNSIGNED     NOT NULL AUTO_INCREMENT          COMMENT '行程ID',
  user_id     INT UNSIGNED     NOT NULL                         COMMENT '所属用户ID',
  title       VARCHAR(100)     NOT NULL                         COMMENT '行程标题，如「成都3日游」',
  city        VARCHAR(50)      NOT NULL                         COMMENT '目的地城市',
  budget      INT UNSIGNED     NOT NULL DEFAULT 0               COMMENT '总预算（元）',
  days        TINYINT UNSIGNED NOT NULL DEFAULT 1               COMMENT '旅行天数',
  content     JSON                                              COMMENT '行程正文 JSON',
  is_favorite TINYINT(1)       NOT NULL DEFAULT 0               COMMENT '是否收藏：0否 1是',
  created_at  TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP                              COMMENT '创建时间',
  updated_at  TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP  COMMENT '更新时间',
  PRIMARY KEY (id),
  KEY idx_user_created (user_id, created_at)                    COMMENT '「我的行程」按时间倒序分页',
  KEY idx_user_favorite (user_id, is_favorite)                  COMMENT '收藏筛选',
  KEY idx_city (city),
  CONSTRAINT fk_itineraries_user FOREIGN KEY (user_id)
    REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='行程表';

-- ------------------------------------------------------------
-- 3. AI 对话会话表
--
--    设计说明：
--    主键使用 UUID 而非自增 ID，原因有二：
--      1. 自增 ID 会暴露平台业务量
--      2. 前端可在发起对话前就生成 ID，便于乐观跳转
-- ------------------------------------------------------------
CREATE TABLE chat_sessions (
  id          VARCHAR(36)  NOT NULL                             COMMENT '会话ID（UUID）',
  user_id     INT UNSIGNED NOT NULL                             COMMENT '所属用户ID',
  title       VARCHAR(100) NOT NULL DEFAULT '新的对话'           COMMENT '会话标题，取首条用户消息',
  created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP                              COMMENT '创建时间',
  updated_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP  COMMENT '最后活动时间',
  PRIMARY KEY (id),
  KEY idx_user_updated (user_id, updated_at)                    COMMENT '会话列表按最近活跃排序',
  CONSTRAINT fk_sessions_user FOREIGN KEY (user_id)
    REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='AI 对话会话表';

-- ------------------------------------------------------------
-- 4. AI 对话消息表
-- ------------------------------------------------------------
CREATE TABLE chat_messages (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT               COMMENT '消息ID',
  session_id VARCHAR(36)  NOT NULL                              COMMENT '所属会话ID',
  role       ENUM('user', 'assistant') NOT NULL                 COMMENT '角色：user 用户 / assistant 模型',
  content    TEXT         NOT NULL                              COMMENT '消息内容',
  created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP    COMMENT '发送时间',
  PRIMARY KEY (id),
  KEY idx_session_created (session_id, created_at)              COMMENT '按会话拉取历史消息',
  CONSTRAINT fk_messages_session FOREIGN KEY (session_id)
    REFERENCES chat_sessions (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='AI 对话消息表';

-- ============================================================
--  执行完成后校验：应输出 4 张表
-- ============================================================
SELECT '数据库初始化完成' AS result, DATABASE() AS db_name;
SHOW TABLES;

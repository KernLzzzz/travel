-- ============================================================
--  迁移脚本：用户偏好档案
--  日期：2026-09-04
--
--  为 users 表新增 preferences JSON 列（旅行偏好档案）。
--  全新环境直接执行 sql/schema.sql 即可，无需本脚本；
--  已有数据的环境执行本脚本做增量迁移。
--
--  幂等性：MySQL 8.0 不支持 ADD COLUMN IF NOT EXISTS，
--  重复执行会报 ER_DUP_FIELDNAME（列已存在），可忽略该错误。
-- ============================================================

USE travel_ai;

ALTER TABLE users
  ADD COLUMN preferences JSON DEFAULT NULL
  COMMENT '旅行偏好档案 JSON（常驻城市/默认预算/天数/主题等，用于规划表单预填）';

-- 校验：应能看到 preferences 列
SHOW COLUMNS FROM users;

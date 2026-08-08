-- ============================================================
-- 岛屿记账（jizhang）数据库初始化脚本
-- ------------------------------------------------------------
-- 说明：
--   1. 后端 server/index.js 启动时会自动建库建表（CREATE TABLE IF NOT EXISTS），
--      并执行幂等迁移（补列 / 主键升级），通常无需手动执行本脚本。
--   2. 本文件用于手动初始化 / 参考表结构，需与 server/index.js 中保持一致。
--   3. 数据表全部带 user_id，实现多账号数据隔离；业务主键为复合主键 (user_id, id)。
--   4. 字符集 utf8mb4，金额统一 DECIMAL(14,2)（单位：元）。
--
-- 环境：MySQL 5.7+ / 8.0
-- 使用：mysql -u root -p < schema.sql
-- ============================================================

CREATE DATABASE IF NOT EXISTS `jizhang`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `jizhang`;

-- ------------------------------------------------------------
-- 用户（注册账号；密码以 scrypt 哈希存储，格式 salt:hash）
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `users` (
  `id`            VARCHAR(40)  NOT NULL,
  `username`      VARCHAR(50)  NOT NULL,
  `password_hash` VARCHAR(200) NOT NULL,
  `created_at`    BIGINT       NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_username` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- 登录会话（Bearer token，30 天有效）
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `sessions` (
  `token`      VARCHAR(64) NOT NULL,
  `user_id`    VARCHAR(40) NOT NULL,
  `created_at` BIGINT      NOT NULL,
  PRIMARY KEY (`token`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- 账户（钱包：初始余额 + 收入 - 支出 + 转入 - 转出 = 当前余额，由前端推导）
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `accounts` (
  `user_id`         VARCHAR(40)   NOT NULL,
  `id`              VARCHAR(40)   NOT NULL,
  `name`            VARCHAR(50)   NOT NULL,
  `type`            VARCHAR(20)   NOT NULL,  -- cash | bank | alipay | wechat | other
  `icon`            VARCHAR(10)   NOT NULL,  -- emoji
  `color`           VARCHAR(30)   NOT NULL,  -- 命名色（CardColor）
  `initial_balance` DECIMAL(14,2) NOT NULL DEFAULT 0,
  `hidden`          TINYINT(1)    NOT NULL DEFAULT 0,
  `created_at`      BIGINT        NOT NULL,
  PRIMARY KEY (`user_id`, `id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- 分类（支出 8 个 + 收入 4 个默认分类）
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `categories` (
  `user_id`    VARCHAR(40) NOT NULL,
  `id`         VARCHAR(40) NOT NULL,
  `name`       VARCHAR(50) NOT NULL,
  `type`       VARCHAR(10) NOT NULL,  -- expense | income
  `icon`       VARCHAR(10) NOT NULL,  -- emoji
  `color`      VARCHAR(20) NOT NULL,  -- hex，图表颜色
  `is_default` TINYINT(1)  NOT NULL DEFAULT 0,
  `sort`       INT         NOT NULL DEFAULT 0,
  PRIMARY KEY (`user_id`, `id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- 一笔账（收支流水）
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `txs` (
  `user_id`     VARCHAR(40)   NOT NULL,
  `id`          VARCHAR(40)   NOT NULL,
  `type`        VARCHAR(10)   NOT NULL,   -- expense | income
  `amount`      DECIMAL(14,2) NOT NULL,   -- 元，正数
  `category_id` VARCHAR(40)   NOT NULL,
  `account_id`  VARCHAR(40)   NOT NULL,
  `date`        CHAR(10)      NOT NULL,   -- YYYY-MM-DD
  `time`        CHAR(5)       NULL,       -- HH:mm（可选）
  `location`    VARCHAR(100)  DEFAULT '', -- 地点（可选）
  `pay_method`  VARCHAR(20)   DEFAULT '', -- cash | bank | alipay | wechat | credit | other（可选，付款渠道）
  `note`        TEXT,                     -- 详细说明（可选，多行）
  `created_at`  BIGINT        NOT NULL,
  `updated_at`  BIGINT        NULL,
  PRIMARY KEY (`user_id`, `id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- 账户间转账（只变余额，不产生收支）
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `transfers` (
  `user_id`         VARCHAR(40)   NOT NULL,
  `id`              VARCHAR(40)   NOT NULL,
  `from_account_id` VARCHAR(40)   NOT NULL,
  `to_account_id`   VARCHAR(40)   NOT NULL,
  `amount`          DECIMAL(14,2) NOT NULL,
  `date`            CHAR(10)      NOT NULL,
  `note`            VARCHAR(200)  DEFAULT '',
  `created_at`      BIGINT        NOT NULL,
  PRIMARY KEY (`user_id`, `id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- 月度预算（category_id 为 NULL 表示总预算）
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `budgets` (
  `user_id`     VARCHAR(40)   NOT NULL,
  `id`          VARCHAR(40)   NOT NULL,
  `category_id` VARCHAR(40)   NULL,
  `month`       CHAR(7)       NOT NULL,   -- YYYY-MM
  `amount`      DECIMAL(14,2) NOT NULL,
  PRIMARY KEY (`user_id`, `id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- 存钱目标（动森特色）
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `goals` (
  `user_id`       VARCHAR(40)   NOT NULL,
  `id`            VARCHAR(40)   NOT NULL,
  `name`          VARCHAR(50)   NOT NULL,
  `target_amount` DECIMAL(14,2) NOT NULL,
  `saved_amount`  DECIMAL(14,2) NOT NULL DEFAULT 0,
  `deadline`      CHAR(10)      NULL,
  `color`         VARCHAR(30)   NOT NULL,  -- hex
  `created_at`    BIGINT        NOT NULL,
  PRIMARY KEY (`user_id`, `id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- 全局设置（k/v 键值对，JSON 存 v 列）
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `settings` (
  `user_id` VARCHAR(40) NOT NULL,
  `k`       VARCHAR(40) NOT NULL,
  `v`       TEXT        NOT NULL,
  PRIMARY KEY (`user_id`, `k`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

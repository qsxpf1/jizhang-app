# 岛屿记账（jizhang-app）🏝️

一个动物森友会风格的**在线记账网站**：记录每一笔收支、做预算、立存钱目标、统计图表、达成成就。纯前端 + Node 后端，数据存储在 MySQL，支持多账号注册登录与数据隔离。

## ✨ 功能特性

- **记一笔**：支持输入 金额、分类、账户、日期、**时间、地点、支付方式、详细说明**（支出 / 收入通用，均为选填），首页与弹窗共用同一表单，可编辑 / 删除 / 快捷连记
- **流水明细**：按日分组展示，支持按 类型 / 分类 / 账户 筛选和关键词搜索（命中说明、地点、支付方式）
- **统计页**：月度收入/支出、分类占比饼图、每日折线图、每月柱状图，月度报表可导出
- **预算**：总预算 + 分类预算，超支红色警示
- **账户**：现金 / 银行卡 / 支付宝 / 微信 等钱包，初始余额 + 收支推导当前余额，支持**账户间转账**
- **存钱目标**：立目标、存一笔、倒计时、动森风格进度条
- **成就徽章**：数据驱动，完成记账 / 连续记账等行为解锁
- **设置**：铃钱模式（1 元 = N 铃）、岛主名字、数据导入导出备份
- **多用户**：注册 / 登录 / 退出，所有数据按账号隔离（Bearer token 鉴权，scrypt 密码哈希）

## 🧰 技术栈

| 端 | 技术 |
|---|---|
| 前端 | Vite + React 18 + TypeScript + `animal-island-ui`（动森风组件库）+ react-router-dom（HashRouter）+ zustand（状态管理）+ dayjs + recharts |
| 后端 | Node.js + Express + mysql2 |
| 数据库 | MySQL 5.7+（utf8mb4） |

## 📁 目录结构

```
jizhang-app/
├─ server/
│  ├─ index.js        # Express + MySQL 后端（自动建库建表 + 幂等迁移 + 鉴权）
│  ├─ package.json
│  └─ schema.sql      # 手动建库建表脚本（参考；后端会自动建表）
├─ src/
│  ├─ main.tsx / App.tsx / index.css
│  ├─ api.ts          # 后端接口封装（写请求串行化防竞态）
│  ├─ types.ts        # 数据模型（Account / Category / Tx / Budget / Goal 等）
│  ├─ data/           # 默认分类/账户、种子数据、支付方式、成就定义
│  ├─ store/          # zustand store（useBookStore 数据 + useAuthStore 登录 + useUiStore 弹窗）
│  ├─ utils/          # 计算（余额/汇总/图表）与金额格式化
│  ├─ components/     # 表单、流水、弹窗、日期选择等可复用组件
│  ├─ layouts/        # AppLayout（导航 + 鉴权门）
│  └─ pages/          # Home / List / Stats / Budget / Goals / Accounts / Achievements / Settings
├─ index.html / vite.config.ts / package.json
└─ dist/              # 前端构建产物（后端生产模式直接托管）
```

## 🚀 快速开始

### 1. 环境要求
- Node.js 18+（本项目用 nvm v24 验证）
- MySQL 5.7+，默认连接信息：`127.0.0.1:3306`，用户 `root`，密码 `123456`（可用环境变量覆盖，见下）

### 2. 安装依赖
```bash
cd jizhang-app
npm install
```

> Windows 提示：若 `npm install` 首次卡住，先结束残留的 cmd/node 进程再重试（已配置 npmmirror 镜像 `.npmrc`）。

### 3. 启动（开发模式，前后端一起）
```bash
npm run dev:all
```
- 前端：http://localhost:5173 （vite，把 `/api` 代理到后端 3000）
- 后端：http://localhost:3000

也可以分开启动：`npm run dev`（仅前端）/ `npm run server`（仅后端）。

### 4. 构建 + 生产运行
```bash
npm run build          # tsc 类型检查 + vite 构建到 dist/
npm run server         # 后端启动后自动托管 dist/，访问 http://localhost:3000
```

## 🗄️ 数据库

后端 `server/index.js` **首次启动会自动建库建表**（`CREATE DATABASE IF NOT EXISTS jizhang` + 每张表 `CREATE TABLE IF NOT EXISTS`），并执行幂等迁移（补 `user_id` 列、主键升级为 `(user_id, id)`、`txs` 表补充时间/地点/支付方式列、`note` 扩为 `TEXT`）。通常无需手动建库。

如需手动初始化，可执行 `server/schema.sql`：
```bash
mysql -u root -p < server/schema.sql
```

**表结构一览**（主键均为 `(user_id, id)`，业务数据按账号隔离）：

| 表 | 用途 |
|---|---|
| `users` | 用户（scrypt 密码哈希） |
| `sessions` | 登录会话（Bearer token） |
| `accounts` | 账户 / 钱包 |
| `categories` | 收支分类 |
| `txs` | 一笔账（含 `time` / `location` / `pay_method` / `note` 扩展字段） |
| `transfers` | 账户间转账 |
| `budgets` | 月度预算 |
| `goals` | 存钱目标 |
| `settings` | 全局设置（k/v JSON） |

**后端配置**（环境变量，均有默认值）：`PORT`(3000)、`DB_HOST`(127.0.0.1)、`DB_PORT`(3306)、`DB_USER`(root)、`DB_PASSWORD`(123456)、`DB_NAME`(jizhang)。

## 🔌 API 一览

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/auth/register` | 注册（返回 token） |
| POST | `/api/auth/login` | 登录（返回 token） |
| POST | `/api/auth/logout` | 退出（需登录） |
| GET | `/api/auth/me` | 当前登录用户名 |
| GET | `/api/state` | 拉取当前账号全量数据快照（需登录） |
| PUT | `/api/state` | 全量保存快照（写请求前端已串行化防竞态） |

## 📐 数据模型与关键约定

- **金额以「元」存储**（`DECIMAL(14,2)` / number），账户余额**由交易推导**（`src/utils/calc.ts`），不存快照，避免漂移
- **`Card` 颜色只接受 13 个命名 `CardColor`**（组件库约定，不可传 hex）；目标/账户颜色存命名色，展示进度条时用 `CARD_COLOR_HEX` 映射回 hex
- **表单与流水渲染已抽成组件**：`RecordForm` / `TxGrouped` / `DatePicker` 供首页、弹窗、列表复用
- **支付方式**（`pay_method`）：`cash | bank | alipay | wechat | credit | other`，与「账户（钱包）」是两个维度；标签映射在 `src/data/payMethods.ts`
- **全局记账弹窗**由 `src/store/useUiStore.ts` 控制；首页首次进入无数据时自动种子默认分类/账户
- 前端数据变更 → 防抖 200ms → `PUT /api/state` 全量提交；后端事务内先清后插

## ⚠️ 备注

- 旧版使用 localStorage 存数据，迁移到后端后**不再读取旧 localStorage**；如需迁移请先在旧版本中「导出备份」，再在设置页导入
- `animal-island-ui` 为 npm 依赖的动森风组件库（同级目录 `animal-island-ui-main` 是其源码）

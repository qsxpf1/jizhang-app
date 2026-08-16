# 岛屿记账（jizhang-app）· AI 协作指南

本文件是后续在此仓库写代码的 AI 的「项目速查手册」，目标是让你**无需逐个打开文件探索**即可上手、改对地方。
写码前先读本文；涉及后端 / 前端细节再按需读 `docs/BACKEND.md`、`docs/FRONTEND.md`。
本仓库所有注释、UI、git 提交信息均为中文，请沿用中文注释与提交风格。

## 1. 项目定位

动物森友会风格的在线记账应用。技术栈：

- **前端**：Vite + React 18 + TypeScript（strict）+ `animal-island-ui`（动森风组件库）+ react-router-dom（**HashRouter**）+ zustand + recharts
- **后端**：Express + mysql2，**全部逻辑在单文件 `server/index.js`**（纯 JS，不经 tsc 检查）
- **数据库**：MySQL 5.7+（utf8mb4），多用户登录，业务数据按 `user_id` 隔离

数据流一句话：前端 zustand 全量内存态 → 业务数据一变 → **防抖 200ms → `PUT /api/state` 全量提交**（乐观并发 + 版本号）→ 后端事务「先删后插」→ 版本 +1。

## 2. 常用命令

| 命令 | 作用 |
|---|---|
| `npm run dev` | 仅前端（vite :5173，`/api` 代理到 :3000） |
| `npm run server` | 仅后端（node server/index.js，:3000；生产模式同时托管 `dist/`） |
| `npm run dev:all` | 前后端一起启动 |
| `npm run build` | `tsc && vite build` → `dist/` |
| 数据库 | MySQL `127.0.0.1:3306` `root/123456`，库名 `jizhang`（可用环境变量覆盖） |

后端**首次启动自动建库建表 + 幂等迁移**，一般无需手动建库（`server/schema.sql` 仅参考）。

## 3. 架构与数据流（先看懂这个，再动手）

```
页面/组件
  → useBookStore 的 action 改内存态（addTx / updateTx / setBudget …）
  → useBookStore 模块级 subscribe 监听到业务数据引用变化
  → 防抖 200ms → saveNow() → buildPayload() 全量快照
  → putState(快照, currentVersion) → PUT /api/state（带 X-Version 头）
  → 后端：SELECT meta … FOR UPDATE 行锁 → 比对版本 → DELETE 全部业务表 → INSERT 全部 → 版本+1
  → 响应 X-Version → 前端回写 currentVersion、记 lastSavedJson
```

- **全量快照而非增量**：一次保存提交整份数据（accounts/categories/categoryGroups/txs/transfers/budgets/goals/settings）。
- **乐观并发**：`PUT /api/state` 必须带 `X-Version`（当前版本号）。后端版本不一致 → 回 `409 + {version, data: 最新快照}`，前端抛 `ConflictError`，store **丢弃本地旧快照、直接刷新为服务器数据**（绝不覆盖另一台设备的写入）。
- **新账号种子**：`useBookStore.init()` 仅当 **`version === 0` 且 `snap.accounts?.length === 0`** 双条件同时成立才种默认分类/账户。**绝不可只凭单一条件判断"空账号"**（见 §8 历史事故）。
- **前端写请求串行化**：`src/api.ts` 模块级 `writeChain` 让多个 PUT 排队按序发出，防止快速连续操作竞态。
- **读取**：登录成功 / 启动后 `getState()` 拉全量快照 + 响应头 `X-Version`。

## 4. 目录与文件职责（一图流）

```
jizhang-app/
├─ server/
│  ├─ index.js        # 全部后端：建库建表 + 幂等迁移 + 鉴权 + 4 个 auth 接口 + GET/PUT /api/state（乐观并发版本控制）+ 审计日志
│  └─ schema.sql      # 手动建库脚本（参考；后端会自动建）
├─ src/
│  ├─ main.tsx        # 入口：useAuthStore.boot() 校验登录态 → HashRouter 渲染
│  ├─ App.tsx         # 路由表：8 个页面 lazy 加载，* 兜底回 Home
│  ├─ index.css       # 全局样式 + 动森风 CSS 变量 --ac-*；900px/700px 响应式断点
│  ├─ api.ts          # HTTP 封装：getState/putState(X-Version)/authApi；token 存 localStorage 'jizhang-token'
│  ├─ types.ts        # 全部数据模型 + Snapshot + CardColor 13 个命名色
│  ├─ data/           # 常量与种子（见下）
│  ├─ store/          # zustand：useBookStore / useAuthStore / useUiStore
│  ├─ utils/          # 纯函数：金额/统计/日期（无 React）
│  ├─ components/     # 可复用组件
│  ├─ layouts/AppLayout.tsx  # 布局 + 鉴权门（loading/guest/loadError/hydrated 四态）
│  └─ pages/          # 8 个页面
└─ docs/              # 本指南的深度参考（按需读）
```

**server/index.js（改后端只看它）**：环境变量 `PORT`(3000) `DB_HOST`(127.0.0.1) `DB_PORT`(3306) `DB_USER`(root) `DB_PASSWORD`(123456) `DB_NAME`(jizhang)；12 张表、迁移、鉴权中间件、写路径算法全在这里。

**src/ 各文件职责（★=高频改动）：**

| 文件 | 职责 |
|---|---|
| `src/types.ts` ★ | 数据模型（Account/Category/CategoryGroup/Tx/Transfer/Budget/Goal/Settings）+ `Snapshot` + `CardColor` |
| `src/api.ts` ★ | 与后端交互的唯一入口；`putState` 内做写请求串行化 |
| `src/store/useBookStore.ts` ★ | 全部业务数据 + CRUD action + **自动保存管线**（subscribe→防抖→saveNow）；模块级 `currentVersion`/`lastSavedJson` |
| `src/store/useAuthStore.ts` | 登录态 boot/login/register/logout；成功后调 `useBookStore.init()` |
| `src/store/useUiStore.ts` | 全局「记一笔」弹窗开关 + 正在编辑的 Tx |
| `src/data/defaults.ts` | DEFAULT_CATEGORIES(12) / DEFAULT_ACCOUNTS(5) / seedTransactions() |
| `src/data/colors.ts` | CATEGORY_COLORS(hex) + CARD_COLOR_HEX/KEYS（命名色↔hex）+ 图标候选 |
| `src/data/payMethods.ts` | PAY_METHODS(6) + payMethodLabel() |
| `src/data/achievements.ts` | 成就定义（数据驱动，check(ctx)） |
| `src/utils/calc.ts` ★ | **所有统计/计算**：余额、月/区间汇总、分类/大类汇总、每日/每月、排序、按日分组、连续天数 |
| `src/utils/money.ts` | round2 / formatMoney(带±符号) / formatMoneyPlain(无符号) |
| `src/utils/storage.ts` | uid() 生成 id / downloadJSON() |

**components（★=高频复用）：**

| 文件 | 职责 |
|---|---|
| `RecordForm.tsx` ★ | 「记一笔」表单：首页快速记账 + RecordModal 弹窗共用（编辑/新增/resetKey 连记） |
| `RecordModal.tsx` | 全局记账弹窗（uiStore 控制，每次打开重挂载表单） |
| `TxGrouped.tsx` ★ | 按日期分组的流水渲染（首页 / 流水页共用） |
| `DatePicker.tsx` | 原生日期输入 + 今天/昨天快捷 |
| `MonthNav.tsx` | 月份切换器（预算页） |
| `MultiSelect.tsx` | 多选下拉（流水页筛选） |
| `ProgressBar.tsx` | 动森风进度条 |
| `SaveToast.tsx` | 保存结果提示（成功/失败/版本冲突） |
| `LoginScreen.tsx` | 登录 / 注册页 |
| `AccountModal` / `CategoryModal` / `CategoryGroupModal` / `GoalModal` / `TransferModal` | 各实体新增/编辑弹窗 |

**pages：**

| 文件 | 职责 |
|---|---|
| `Home.tsx` ★ | 首页：本月收支卡片、快速记账、本月流水、快捷入口 |
| `List.tsx` ★ | 流水明细：类型/分类/账户/关键词/**日期区间**筛选 + 分页 |
| `Stats.tsx` ★ | 统计：日期区间 + 饼图/折线/柱状图 + 报表导出/复制（recharts） |
| `Accounts.tsx` | 账户管理 + 转账 |
| `Budget.tsx` | 分类预算（**总预算 = 各分类预算合计**） |
| `Goals.tsx` | 存钱目标 + 存款 |
| `Achievements.tsx` | 成就徽章 |
| `Settings.tsx` | 岛主名、大类/分类管理、导入导出备份、清空/示例数据 |

## 5. 数据模型与关键约定

- **金额以「元」存 number**（后端 DECIMAL(14,2)），前端同理；展示统一走 `utils/money.ts`。
- **账户余额由交易推导**（`getAccountBalance` = 初始余额 + 收支 + 转入 − 转出），**不存余额快照**，避免漂移。
- **CardColor 命名色**：传给 `animal-island-ui` 的 `<Card color>` 只接受 13 个命名色（types.ts 的 `CardColor`），**不可传 hex**。账户/目标的颜色存命名色；图表、进度条需要色值用 `CARD_COLOR_HEX` 映射。分类颜色存 hex（图表用）。
- **分类组（大类）**：可选分组维度，`Category.groupId` 归属大类；`categoryGroups` 本身也有 type（支出/收入）。统计「按大类」用 `groupTotals`/`rangeGroupTotals`：有归属的分类累进大类，无归属的作为独立项。删除大类会让其下小类 `groupId` 置空（store 已处理）。
- **支付方式 ≠ 账户**：`payMethod` 是付款渠道（cash/bank/alipay/wechat/credit/other），`account` 是钱包（余额载体），两个独立维度，不要混用。
- **settings 表**：单行 `k='default'`, `v=JSON 字符串`（后端 `DEFAULT_SETTINGS` 兜底 `{firstName:'岛主'}`）。前端 `Settings` 目前实际只有 `firstName`（`lastImport` 字段已定义未用）。
- **id 生成**：前端实体用 `uid()`（`Date.now().toString(36)+随机`）；后端用户/会话用 `crypto.randomUUID()`。
- **日期格式**：tx.date=`YYYY-MM-DD`、time=`HH:mm`（可选）、budget.month=`YYYY-MM`。
- **budget 语义**：同月同分类重复设置 = 更新（`setBudget`）。**总预算不单独存**，UI 用「各分类预算之和」；`categoryId=null` 的总预算行是历史遗留，前端不再产生（成就页仍在查它，见 §7 已知不一致）。
- **后端 ↔ 前端字段名**：DB/后端对象用 snake_case，前端接口对象用 camelCase，`readAll`/`writeAll` 手工双向映射。

## 6. 常见任务 → 改哪些文件

| 任务 | 涉及文件 |
|---|---|
| 新增页面 | 建 `src/pages/X.tsx` → `App.tsx` 加 lazy+Route → `AppLayout.tsx` NAV 数组加项（`mobile` 决定是否进移动端 TabBar） |
| 给 tx/实体加字段 | `types.ts` → `RecordForm.tsx`(表单) → `TxGrouped.tsx`(展示) → `server/index.js` 的 TABLES 建表 SQL + `readAll` 映射 + `writeAll` INSERT + （老库需补列则）`migrate()` 幂等补列 |
| 改统计/图表 | 优先改 `utils/calc.ts` 纯函数 + 对应页面（Home/Stats/Budget） |
| 加成就 | `data/achievements.ts` 加一条 + `Achievements.tsx` 的 ctx 计算 |
| 改自动保存/数据层 | `store/useBookStore.ts`（subscribe/saveNow）+ `api.ts` + 后端 `writeAll` |
| 改鉴权 | `server/index.js` `authRequired` + `useAuthStore.ts` |
| 调 UI | `index.css`（CSS 变量 `--ac-*`、类名沿用）+ 对应组件 |

## 7. 绝不能破坏的不变量

1. **版本控制是生命线**：`PUT /api/state` 必须带 `X-Version`；后端 `writeAll` 必须「行锁 + 版本比对 → 先删后插 → 版本+1」原子执行。**砍掉它 = 重演 2026-08-09 的数据丢失**。
2. **新账号种子必须双条件**：`version === 0 && accounts 为空` 同时满足才种默认数据。任何仅凭单条件的空库判断都可能把已有账号当空账号**清空覆盖**。
3. **所有业务表主键 `(user_id, id)`，一切 SQL 都必须带 `user_id` 过滤**。跨账号读写/覆盖是最高级别事故。
4. **写路径「先删后插」是特意的**（8 张业务表全删再插，事务内原子），不要改成逐条 update——除非你同时改掉版本算法。
5. **别往 `useBookStore` 业务数据里塞非业务字段**（UI 状态放组件或用 useUiStore），否则会被自动保存写进 MySQL；subscribe 靠引用比较判断是否变化，避免保存循环。
6. **别绕过 `api.ts` 的 `writeChain` 串行化**直接发写请求。
7. **传给 `animal-island-ui` Card 的颜色必须是命名色**；金额一律经 `money.ts` 四舍五入。
8. **前后端改动要配套**：前端 store/api 改了，后端 server/index.js 必须同步改，反之亦然，别停在中间态（见 §8）。

## 8. 历史事故（2026-08-09，真实数据丢失，防护已上线）

开发中 vite HMR 触发「`api.ts` 已改、`useBookStore.ts` 未改」的中间态：`init()` 里 `snap.accounts` 变 `undefined`，`!snap.accounts` 误判为空账号 → 走种子分支 PUT 默认数据，把真实用户的流水**全量覆盖清空**（已从 MySQL binlog 恢复）。

由此上线的防护（**都是硬约束**）：
- `X-Version` 乐观并发：版本不一致后端回 409 并附最新快照，前端刷新而非覆盖；
- `init()` 种子改双条件判断，且对异常接口形状兜底（`snap.categoryGroups ?? []`）；
- `migrate()` 为所有存量账号初始化 `meta version=1`，让无版本头的旧客户端写不进来；
- 每次数据库操作写入 `operation_logs` 审计表（method/path/action/status/latency_ms/detail）+ 控制台。

**结论**：改数据层时先想清楚会不会有人停在中间态；读后端返回的字段永远做兼容（可选链、`?? []` 兜底）。

## 9. 已知不一致 / 陷阱（改代码前注意）

- **成就「预算守卫」可能永远无法解锁**：它查 `budgets.find(b => b.categoryId === null)` 的总预算行，而当前 UI 已不产生该行（总预算 = 分类预算之和）。改成就或预算逻辑时留意。
- **铃钱模式未实现**：README 之前宣称的「铃钱模式（1 元 = N 铃）」未实现，`money.ts` 的 `_settings` 参数是占位且从未使用，Settings 类型也没有相关字段。
- 删除账户/分类**不级联删流水**：相关流水保留，账户/分类名显示「未知」（分类会顺带删掉相关预算）。
- `dist/` 是构建产物（已 gitignore），生产模式由后端托管；改前端后用 `npm run build` 才会生效到 :3000。
- 后端是纯 JS 且不在 tsconfig 范围内，改它没有类型检查，多留心字段名映射。

## 10. 深度参考

- `docs/BACKEND.md` — server/index.js 全解析：12 张表结构、幂等迁移、鉴权、接口契约、版本算法、审计日志、加字段清单
- `docs/FRONTEND.md` — 前端架构：三个 store、自动保存管线源码走读、冲突处理、组件/页面模式、样式约定、开发任务清单

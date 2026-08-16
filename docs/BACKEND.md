# 后端深度参考（server/index.js）

后端是**单文件** `server/index.js`（Express + mysql2，ESM，纯 JS 不经 tsc）。读本文前先读根目录 `CLAUDE.md` §3 架构与数据流。本文按文件从上到下的执行顺序讲解。

## 1. 启动流程

```
start()
 1. 用 admin 连接（不指定库）→ CREATE DATABASE IF NOT EXISTS jizhang (utf8mb4_unicode_ci)
 2. 建连接池 pool（connectionLimit 10）
 3. 依次执行 TABLES[]（12 张 CREATE TABLE IF NOT EXISTS，幂等）
 4. migrate()（幂等迁移，见 §3）
 5. app.listen(PORT)
```

失败时打印错误并 `process.exit(1)`。**环境变量**（均有默认值）：`PORT`=3000、`DB_HOST`=127.0.0.1、`DB_PORT`=3306、`DB_USER`=root、`DB_PASSWORD`=123456、`DB_NAME`=jizhang。

## 2. 表结构（12 张）

所有业务表主键都是 `(user_id, id)`（settings 是 `(user_id, k)`），靠 `user_id` 做账号隔离。

| 表 | 用途 | 关键列 |
|---|---|---|
| `users` | 用户 | username UNIQUE、password_hash（scrypt `salt:hash`）、created_at BIGINT |
| `sessions` | 会话 | token VARCHAR(64) PK、user_id、created_at（TTL 30 天） |
| `accounts` | 账户/钱包 | name、type、icon、color、initial_balance DECIMAL(14,2)、hidden |
| `categories` | 收支分类 | name、type、icon、color(hex)、is_default、sort、**group_id**（归属大类） |
| `category_groups` | 大类 | name、type、icon、color(hex)、sort、created_at |
| `txs` | 一笔账 | type、amount、category_id、account_id、date CHAR(10)、time CHAR(5)、location、pay_method、note TEXT、created_at、updated_at |
| `transfers` | 转账 | from_account_id、to_account_id、amount、date、note |
| `budgets` | 月度预算 | category_id(可 NULL=总预算)、month CHAR(7)、amount |
| `goals` | 存钱目标 | name、target_amount、saved_amount、deadline、color |
| `settings` | 全局设置 | k、v(TEXT)，当前只有一行 `k='default'`, `v=JSON` |
| `meta` | **数据版本（乐观并发核心）** | user_id PK、version BIGINT、updated_at |
| `operation_logs` | 审计日志 | AUTO_INCREMENT、created_at、username、user_id、method、path、action、status、latency_ms、detail(≤2000字符)、索引 idx_logs_created |

`DATA_TABLES`（写路径会整表清空重插的 8 张）= accounts, categories, category_groups, txs, transfers, budgets, goals, settings。

## 3. migrate() 幂等迁移（老库升级）

1. 给缺 `user_id` 列的表 `ADD COLUMN user_id VARCHAR(40) NOT NULL DEFAULT ''`（settings 例外：直接 DROP 由建表重建，因为主键要变成 `(user_id,k)`）。
2. `ensureCompositePk(table)`：主键是单列 `id` 的转成 `(user_id, id)`（避免不同账号撞 id）。
3. `ensureTxColumns()`：给 txs 补 `time`/`location`/`pay_method` 列，`note` 非 TEXT 则 MODIFY 为 TEXT。
4. categories 缺 `group_id` 则补列。
5. 为所有存量账号 INSERT 进 `meta` 表并设 `version=1` —— 这使**无版本头的旧客户端**（按 version=0 请求）对老账号一律 409，防止中间态代码把已有账号当空账号清空。

**加列时照抄这个模式**：用 `information_schema` 查列是否存在 → 不存在才 ALTER，保证幂等、可重复启动。

## 4. 密码与会话

- `hashPassword`：scryptSync(salt 16B, 64B) → 存 `salt:hash`；`verifyPassword` 用 `timingSafeEqual`。
- `createSession`：48 位 hex token（24B），INSERT sessions；TTL 30 天，超时 token 失效。
- `authRequired` 中间件：从 `Authorization: Bearer <token>` 取 token → `userByToken` JOIN users → 挂 `req.userId`/`req.username`/`req.token`；失败回 401 并记审计日志。

## 5. 接口契约

| 方法 | 路径 | 鉴权 | 入参 | 成功返回 | 失败 |
|---|---|---|---|---|---|
| GET | `/api/health` | 无 | — | `{ok:true}` | — |
| POST | `/api/auth/register` | 无 | `{username(2-20), password(4-64)}` | `{token, username}` | 400 长度、409 用户名已存在 |
| POST | `/api/auth/login` | 无 | `{username, password}` | `{token, username}` | 401 用户名或密码错误 |
| POST | `/api/auth/logout` | 是 | — | `{ok:true}`（删 sessions 行） | 401 |
| GET | `/api/auth/me` | 是 | — | `{username}` | 401 |
| GET | `/api/state` | 是 | — | 全量快照（见下），响应头 `X-Version` | 500 |
| PUT | `/api/state` | 是 | 请求头 `X-Version`，body=全量快照 | `{ok, version}`，响应头 `X-Version` | **409** `{error, version, data:最新快照}`；500 |

**GET /api/state 返回的快照形状**（与前端 `Snapshot` 对应，snake→camel 已转换）：
```json
{
  "accounts": [{"id","name","type","icon","color","initialBalance","hidden","createdAt"}],
  "categories": [{"id","name","type","icon","color","isDefault","sort","groupId"}],
  "categoryGroups": [{"id","name","type","icon","color","sort","createdAt"}],
  "txs": [{"id","type","amount","categoryId","accountId","date","time","location","payMethod","note","createdAt","updatedAt"}],
  "transfers": [{"id","fromAccountId","toAccountId","amount","date","note","createdAt"}],
  "budgets": [{"id","categoryId","month","amount"}],
  "goals": [{"id","name","targetAmount","savedAmount","deadline","color","createdAt"}],
  "settings": {"firstName":"岛主"}
}
```
`readAll` 把 DB 行手工映射成 camelCase，并把 `0/1`、`DECIMAL`、可空列转成 `boolean/number/undefined`。**加字段时 `readAll` 与 `writeAll` 两处映射都要改。**

## 6. writeAll 算法（版本控制核心，逐行理解）

```js
async function writeAll(body, userId, expectedVersion) {
  // 1. 从 body 解出各数组，settings 用 DEFAULT_SETTINGS 合并兜底
  // 2. 开启事务，拿一个连接
  // 3. SELECT version FROM meta WHERE user_id=? FOR UPDATE   ← 行锁
  // 4. if currentVersion !== expectedVersion → rollback, return {conflict:true, version:currentVersion}
  // 5. 对 DATA_TABLES 全部 DELETE FROM ... WHERE user_id=?   ← 先删
  // 6. 逐条 INSERT 各表（settings 插一行 k='default'）       ← 后插
  // 7. meta 版本 currentVersion+1（ON DUPLICATE KEY UPDATE）
  // 8. commit；异常 rollback 并重抛
}
```

关键点：**校验版本→删→插→版本+1 必须在一个事务里原子完成**（`FOR UPDATE` 行锁防并发双写）。DELETE+INSERT 不是逐条 update，是刻意选择——前端本来就是整份快照提交。改这个算法必须先想清楚并发语义。

## 7. 审计日志（operation_logs）

每个接口（含鉴权失败路径）都调用 `logOperation({method,path,action,status,userId,username,latencyMs,detail})`：
- INSERT 一行到 operation_logs（`detail` 截断 2000 字符）；
- 同时 `console.log` 一行；
- **日志写入失败绝不影响主流程**（try/catch 吞掉）。

action 取值示例：`register`/`login`/`logout`/`me`/`read_state`/`save_state`/`auth`。status：`success`/`unauthorized`/`conflict`/`error`。

## 8. 生产托管

若 `dist/` 存在：`express.static(distDir)` + 非 `/api` 路径全部回退到 `index.html`（SPA）。所以**改了前端要 `npm run build` 才能在 :3000 生效**。

## 9. 改后端的检查清单

加一个业务字段/表时，逐项核对：

- [ ] `TABLES[]` 建表 SQL（含 `user_id` 列、主键 `(user_id,id)`）
- [ ] `DATA_TABLES` 是否需要包含（决定是否参与「先删后插」）
- [ ] `readAll` 的 snake→camel 映射
- [ ] `writeAll` 的 INSERT 语句（列顺序、null/默认值处理）
- [ ] 存量库迁移：`migrate()` 里加幂等补列逻辑（`information_schema` 判断）
- [ ] 需要的话在接口里补 `logOperation`
- [ ] 前端 `types.ts` 与 store 同步（见 docs/FRONTEND.md）

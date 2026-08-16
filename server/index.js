import express from 'express';
import mysql from 'mysql2/promise';
import crypto from 'node:crypto';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// ============================================================
// 配置（可用环境变量覆盖；默认 127.0.0.1:3306 root/123456 jizhang）
// ============================================================
const PORT = Number(process.env.PORT || 3000);
const DB_HOST = process.env.DB_HOST || '127.0.0.1';
const DB_PORT = Number(process.env.DB_PORT || 3306);
const DB_USER = process.env.DB_USER || 'root';
const DB_PASSWORD = process.env.DB_PASSWORD || '123456';
const DB_NAME = process.env.DB_NAME || 'jizhang';

const SESSION_TTL = 30 * 24 * 60 * 60 * 1000; // 30 天

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(__dirname, '../dist');

// ============================================================
// 表结构（所有数据表带 user_id 实现按账号隔离）
// ============================================================
const TABLES = [
  `CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(40) PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password_hash VARCHAR(200) NOT NULL,
    created_at BIGINT NOT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS sessions (
    token VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(40) NOT NULL,
    created_at BIGINT NOT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS accounts (
    user_id VARCHAR(40) NOT NULL,
    id VARCHAR(40) NOT NULL,
    name VARCHAR(50) NOT NULL,
    type VARCHAR(20) NOT NULL,
    icon VARCHAR(10) NOT NULL,
    color VARCHAR(30) NOT NULL,
    initial_balance DECIMAL(14,2) NOT NULL DEFAULT 0,
    hidden TINYINT(1) NOT NULL DEFAULT 0,
    created_at BIGINT NOT NULL,
    PRIMARY KEY (user_id, id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS categories (
    user_id VARCHAR(40) NOT NULL,
    id VARCHAR(40) NOT NULL,
    name VARCHAR(50) NOT NULL,
    type VARCHAR(10) NOT NULL,
    icon VARCHAR(10) NOT NULL,
    color VARCHAR(20) NOT NULL,
    is_default TINYINT(1) NOT NULL DEFAULT 0,
    sort INT NOT NULL DEFAULT 0,
    group_id VARCHAR(40) NULL,
    PRIMARY KEY (user_id, id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS category_groups (
    user_id VARCHAR(40) NOT NULL,
    id VARCHAR(40) NOT NULL,
    name VARCHAR(50) NOT NULL,
    type VARCHAR(10) NOT NULL,
    icon VARCHAR(10) NOT NULL,
    color VARCHAR(20) NOT NULL,
    sort INT NOT NULL DEFAULT 0,
    created_at BIGINT NOT NULL,
    PRIMARY KEY (user_id, id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS txs (
    user_id VARCHAR(40) NOT NULL,
    id VARCHAR(40) NOT NULL,
    type VARCHAR(10) NOT NULL,
    amount DECIMAL(14,2) NOT NULL,
    category_id VARCHAR(40) NOT NULL,
    account_id VARCHAR(40) NOT NULL,
    date CHAR(10) NOT NULL,
    time CHAR(5) NULL,
    location VARCHAR(100) DEFAULT '',
    pay_method VARCHAR(20) DEFAULT '',
    note TEXT,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NULL,
    PRIMARY KEY (user_id, id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS transfers (
    user_id VARCHAR(40) NOT NULL,
    id VARCHAR(40) NOT NULL,
    from_account_id VARCHAR(40) NOT NULL,
    to_account_id VARCHAR(40) NOT NULL,
    amount DECIMAL(14,2) NOT NULL,
    date CHAR(10) NOT NULL,
    note VARCHAR(200) DEFAULT '',
    created_at BIGINT NOT NULL,
    PRIMARY KEY (user_id, id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS budgets (
    user_id VARCHAR(40) NOT NULL,
    id VARCHAR(40) NOT NULL,
    category_id VARCHAR(40) NULL,
    month CHAR(7) NOT NULL,
    amount DECIMAL(14,2) NOT NULL,
    PRIMARY KEY (user_id, id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS goals (
    user_id VARCHAR(40) NOT NULL,
    id VARCHAR(40) NOT NULL,
    name VARCHAR(50) NOT NULL,
    target_amount DECIMAL(14,2) NOT NULL,
    saved_amount DECIMAL(14,2) NOT NULL DEFAULT 0,
    deadline CHAR(10) NULL,
    color VARCHAR(30) NOT NULL,
    created_at BIGINT NOT NULL,
    PRIMARY KEY (user_id, id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS settings (
    user_id VARCHAR(40) NOT NULL,
    k VARCHAR(40) NOT NULL,
    v TEXT NOT NULL,
    PRIMARY KEY (user_id, k)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS meta (
    user_id VARCHAR(40) PRIMARY KEY,
    version BIGINT NOT NULL DEFAULT 0,
    updated_at BIGINT NOT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS operation_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    created_at BIGINT NOT NULL,
    username VARCHAR(50) NOT NULL DEFAULT '',
    user_id VARCHAR(40) NOT NULL DEFAULT '',
    method VARCHAR(10) NOT NULL,
    path VARCHAR(100) NOT NULL,
    action VARCHAR(40) NOT NULL,
    status VARCHAR(20) NOT NULL,
    latency_ms INT NOT NULL,
    detail TEXT,
    KEY idx_logs_created (created_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
];

/** 参与迁移和全量写入的表（不含 settings，其主键特殊） */
const DATA_TABLES = [
  'accounts',
  'categories',
  'category_groups',
  'txs',
  'transfers',
  'budgets',
  'goals',
  'settings',
];
const DEFAULT_SETTINGS = { firstName: '岛主' };

// ============================================================
// 密码哈希 / 会话
// ============================================================
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  try {
    const [salt, hash] = String(stored).split(':');
    const test = crypto.scryptSync(password, salt, 64).toString('hex');
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(test, 'hex'));
  } catch {
    return false;
  }
}

async function createSession(userId) {
  const token = crypto.randomBytes(24).toString('hex');
  await pool.query('INSERT INTO sessions (token, user_id, created_at) VALUES (?,?,?)', [
    token,
    userId,
    Date.now(),
  ]);
  return token;
}

async function userByToken(token) {
  const [rows] = await pool.query(
    `SELECT u.id AS user_id, u.username
       FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.token = ? AND s.created_at > ?`,
    [token, Date.now() - SESSION_TTL],
  );
  return rows[0] || null;
}

// ============================================================
// 数据库连接与迁移
// ============================================================
let pool;

/** 老库升级：给 txs 补时间/地点/支付方式列，并把 note 扩为 TEXT（幂等） */
async function ensureTxColumns() {
  const [cols] = await pool.query(
    `SELECT COLUMN_NAME, DATA_TYPE
       FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'txs'`,
    [DB_NAME],
  );
  const info = new Map(cols.map((r) => [r.COLUMN_NAME, r.DATA_TYPE]));
  if (!info.has('time')) {
    await pool.query(`ALTER TABLE txs ADD COLUMN time CHAR(5) NULL`);
  }
  if (!info.has('location')) {
    await pool.query(`ALTER TABLE txs ADD COLUMN location VARCHAR(100) DEFAULT ''`);
  }
  if (!info.has('pay_method')) {
    await pool.query(`ALTER TABLE txs ADD COLUMN pay_method VARCHAR(20) DEFAULT ''`);
  }
  if (info.get('note') && info.get('note') !== 'text') {
    await pool.query(`ALTER TABLE txs MODIFY COLUMN note TEXT`);
  }
}

/** 把单列主键 (id) 转成复合主键 (user_id, id)，避免不同账号撞 id */
async function ensureCompositePk(table) {
  const [rows] = await pool.query(
    `SELECT GROUP_CONCAT(COLUMN_NAME ORDER BY ORDINAL_POSITION) AS cols
       FROM information_schema.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND CONSTRAINT_NAME = 'PRIMARY'`,
    [DB_NAME, table],
  );
  const cols = (rows[0]?.cols || '').split(',');
  if (cols.length === 1) {
    await pool.query(`ALTER TABLE \`${table}\` DROP PRIMARY KEY, ADD PRIMARY KEY (user_id, id)`);
  }
}

async function migrate() {
  // 1) 数据表补 user_id 列（幂等；settings 表直接重建，因为主键要变成 (user_id, k)）
  const [cols] = await pool.query(
    `SELECT TABLE_NAME FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = ? AND COLUMN_NAME = 'user_id'`,
    [DB_NAME],
  );
  const hasUser = new Set(cols.map((r) => r.TABLE_NAME));
  for (const t of DATA_TABLES) {
    if (t === 'settings') continue;
    if (!hasUser.has(t)) {
      await pool.query(`ALTER TABLE \`${t}\` ADD COLUMN user_id VARCHAR(40) NOT NULL DEFAULT ''`);
    }
  }
  if (!hasUser.has('settings')) {
    await pool.query('DROP TABLE IF EXISTS settings'); // 由下方 CREATE TABLE 重建
  }

  // 2) 主键转 (user_id, id)，让每个账号有独立 id 命名空间
  for (const t of DATA_TABLES) {
    if (t === 'settings') continue;
    await ensureCompositePk(t);
  }

  // 3) txs 补新列（时间/地点/支付方式），note 扩为 TEXT
  await ensureTxColumns();

  // 3.5) categories 补 group_id 列（大类归属），幂等
  const [catCols] = await pool.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'categories' AND COLUMN_NAME = 'group_id'`,
    [DB_NAME],
  );
  if (catCols.length === 0) {
    await pool.query(`ALTER TABLE categories ADD COLUMN group_id VARCHAR(40) NULL`);
  }

  // 4) 为已有账号初始化数据版本（version=1）：
  //    无版本头的旧客户端请求按 version=0 处理，若账号已是 version 1 则被 409 拒绝，
  //    避免旧前端 / 中间态代码把已有账号当空账号全量覆盖。
  await pool.query(
    'INSERT INTO meta (user_id, version, updated_at) SELECT id, 1, ? FROM users WHERE id NOT IN (SELECT user_id FROM meta)',
    [Date.now()],
  );
}

// ============================================================
// 读 / 写（按 userId 隔离）
// ============================================================
async function readAll(userId) {
  const [accounts] = await pool.query('SELECT * FROM accounts WHERE user_id = ?', [userId]);
  const [categories] = await pool.query('SELECT * FROM categories WHERE user_id = ?', [userId]);
  const [categoryGroups] = await pool.query('SELECT * FROM category_groups WHERE user_id = ?', [userId]);
  const [txs] = await pool.query('SELECT * FROM txs WHERE user_id = ?', [userId]);
  const [transfers] = await pool.query('SELECT * FROM transfers WHERE user_id = ?', [userId]);
  const [budgets] = await pool.query('SELECT * FROM budgets WHERE user_id = ?', [userId]);
  const [goals] = await pool.query('SELECT * FROM goals WHERE user_id = ?', [userId]);
  const [settingsRows] = await pool.query('SELECT * FROM settings WHERE user_id = ?', [userId]);

  return {
    accounts: accounts.map((r) => ({
      id: r.id,
      name: r.name,
      type: r.type,
      icon: r.icon,
      color: r.color,
      initialBalance: Number(r.initial_balance),
      hidden: !!r.hidden,
      createdAt: Number(r.created_at),
    })),
    categories: categories.map((r) => ({
      id: r.id,
      name: r.name,
      type: r.type,
      icon: r.icon,
      color: r.color,
      isDefault: !!r.is_default,
      sort: r.sort,
      groupId: r.group_id || undefined,
    })),
    categoryGroups: categoryGroups.map((r) => ({
      id: r.id,
      name: r.name,
      type: r.type,
      icon: r.icon,
      color: r.color,
      sort: r.sort,
      createdAt: Number(r.created_at),
    })),
    txs: txs.map((r) => ({
      id: r.id,
      type: r.type,
      amount: Number(r.amount),
      categoryId: r.category_id,
      accountId: r.account_id,
      date: r.date,
      time: r.time || undefined,
      location: r.location || undefined,
      payMethod: r.pay_method || undefined,
      note: r.note || undefined,
      createdAt: Number(r.created_at),
      updatedAt: r.updated_at ? Number(r.updated_at) : undefined,
    })),
    transfers: transfers.map((r) => ({
      id: r.id,
      fromAccountId: r.from_account_id,
      toAccountId: r.to_account_id,
      amount: Number(r.amount),
      date: r.date,
      note: r.note || undefined,
      createdAt: Number(r.created_at),
    })),
    budgets: budgets.map((r) => ({
      id: r.id,
      categoryId: r.category_id,
      month: r.month,
      amount: Number(r.amount),
    })),
    goals: goals.map((r) => ({
      id: r.id,
      name: r.name,
      targetAmount: Number(r.target_amount),
      savedAmount: Number(r.saved_amount),
      deadline: r.deadline || undefined,
      color: r.color,
      createdAt: Number(r.created_at),
    })),
    settings: settingsRows.length
      ? { ...DEFAULT_SETTINGS, ...JSON.parse(settingsRows[0].v) }
      : DEFAULT_SETTINGS,
  };
}

/** 读取账号的数据版本（无记录视为 0，即全新账号） */
async function getVersion(userId) {
  const [rows] = await pool.query('SELECT version FROM meta WHERE user_id = ?', [userId]);
  return rows[0]?.version ?? 0;
}

/** 原子版本校验 + 递增（用 UPDATE 的原子性代替 SELECT ... FOR UPDATE 显式行锁） */
async function checkVersion(conn, userId, expectedVersion) {
  const [result] = await conn.query(
    'UPDATE meta SET version = version + 1, updated_at = ? WHERE user_id = ? AND version = ?',
    [Date.now(), userId, expectedVersion],
  );
  return result.affectedRows === 1;
}

/**
 * 通用写操作路由包装器：
 * 1. 取 X-Version 头 → 2. 开启事务 → 3. checkVersion 原子校验
 * 4. 冲突 → ROLLBACK + 409 + 最新全量快照
 * 5. 执行具体的 executeFn(conn, req) → 6. COMMIT + 响应头 + 日志
 */
async function handleWrite(req, res, executeFn, action) {
  const t0 = Date.now();
  const expectedVersion = Number(req.headers['x-version'] ?? 0);
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const versionOk = await checkVersion(conn, req.userId, expectedVersion);
    if (!versionOk) {
      await conn.rollback();
      const latest = await readAll(req.userId);
      const currentVersion = await getVersion(req.userId);
      await logOperation({
        method: req.method, path: req.path, action: `${action}_conflict`,
        status: 'conflict', latencyMs: Date.now() - t0,
        userId: req.userId, username: req.username,
        detail: `版本冲突：客户端=${expectedVersion}，当前=${currentVersion}`,
      });
      return res.status(409).json({
        error: '另一台设备已修改数据，已为你刷新到最新版本',
        version: currentVersion, data: latest,
      });
    }
    await executeFn(conn, req);
    await conn.commit();
    const newVersion = expectedVersion + 1;
    res.set('X-Version', String(newVersion));
    await logOperation({
      method: req.method, path: req.path, action,
      status: 'success', latencyMs: Date.now() - t0,
      userId: req.userId, username: req.username,
      detail: `version=${newVersion}`,
    });
    res.json({ ok: true, version: newVersion });
  } catch (e) {
    await conn.rollback().catch(() => {});
    await logOperation({
      method: req.method, path: req.path, action,
      status: 'error', latencyMs: Date.now() - t0,
      userId: req.userId, username: req.username,
      detail: e?.message || String(e),
    });
    res.status(500).json({ error: `${action}失败：${e.message || e}` });
  } finally {
    conn.release();
  }
}

// (writeAll 已移除，改用增量 CRUD + 批量接口)

// ============================================================
// 操作日志（每次数据库操作都落一条到 operation_logs + 控制台）
// ============================================================
async function logOperation({ method, path, action, status, userId = '', username = '', latencyMs = 0, detail }) {
  try {
    await pool.query(
      'INSERT INTO operation_logs (created_at, username, user_id, method, path, action, status, latency_ms, detail) VALUES (?,?,?,?,?,?,?,?,?)',
      [Date.now(), username, userId, method, path, action, status, latencyMs, detail ? String(detail).slice(0, 2000) : null],
    );
  } catch (e) {
    // 审计日志写入失败不影响主流程
    console.error('⚠️ 写入操作日志失败：', e?.message || e);
  }
  console.log(
    `[${new Date().toISOString()}] ${method} ${path} · ${action} · ${status} · ${latencyMs}ms · user=${username || userId || '-'}${detail ? ' · ' + detail : ''}`,
  );
}

// ============================================================
// 鉴权中间件
// ============================================================
async function authRequired(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) {
      await logOperation({ method: req.method, path: req.path, action: 'auth', status: 'unauthorized', latencyMs: 0, detail: '缺少 token' });
      return res.status(401).json({ error: '未登录' });
    }
    const user = await userByToken(token);
    if (!user) {
      await logOperation({ method: req.method, path: req.path, action: 'auth', status: 'unauthorized', latencyMs: 0, detail: 'token 无效或已过期' });
      return res.status(401).json({ error: '登录已失效，请重新登录' });
    }
    req.userId = user.user_id;
    req.username = user.username;
    req.token = token;
    next();
  } catch (e) {
    await logOperation({ method: req.method, path: req.path, action: 'auth', status: 'error', latencyMs: 0, detail: e?.message || String(e) });
    res.status(500).json({ error: `鉴权失败：${e.message || e}` });
  }
}

// ============================================================
// HTTP 服务
// ============================================================
const app = express();
app.use(express.json({ limit: '2mb' }));

app.get('/api/health', (_req, res) => res.json({ ok: true }));

// ---- 认证 ----
app.post('/api/auth/register', async (req, res) => {
  const t0 = Date.now();
  try {
    const username = String(req.body?.username || '').trim();
    const password = String(req.body?.password || '');
    if (username.length < 2 || username.length > 20) {
      await logOperation({ method: 'POST', path: '/api/auth/register', action: 'register', status: 'error', latencyMs: Date.now() - t0, detail: '用户名长度不合法' });
      return res.status(400).json({ error: '用户名需 2-20 个字符' });
    }
    if (password.length < 4 || password.length > 64) {
      await logOperation({ method: 'POST', path: '/api/auth/register', action: 'register', status: 'error', latencyMs: Date.now() - t0, detail: '密码长度不合法' });
      return res.status(400).json({ error: '密码需 4-64 位' });
    }
    const [exist] = await pool.query('SELECT id FROM users WHERE username = ?', [username]);
    if (exist.length) {
      await logOperation({ method: 'POST', path: '/api/auth/register', action: 'register', status: 'error', latencyMs: Date.now() - t0, username, detail: '用户名已存在' });
      return res.status(409).json({ error: '该账号已存在，请直接登录' });
    }
    const id = crypto.randomUUID();
    await pool.query('INSERT INTO users (id, username, password_hash, created_at) VALUES (?,?,?,?)', [
      id,
      username,
      hashPassword(password),
      Date.now(),
    ]);
    const token = await createSession(id);
    await logOperation({ method: 'POST', path: '/api/auth/register', action: 'register', status: 'success', latencyMs: Date.now() - t0, userId: id, username });
    res.json({ token, username });
  } catch (e) {
    await logOperation({ method: 'POST', path: '/api/auth/register', action: 'register', status: 'error', latencyMs: Date.now() - t0, detail: e?.message || String(e) });
    res.status(500).json({ error: `注册失败：${e.message || e}` });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const t0 = Date.now();
  try {
    const username = String(req.body?.username || '').trim();
    const password = String(req.body?.password || '');
    const [rows] = await pool.query('SELECT * FROM users WHERE username = ?', [username]);
    if (!rows.length || !verifyPassword(password, rows[0].password_hash)) {
      await logOperation({ method: 'POST', path: '/api/auth/login', action: 'login', status: 'unauthorized', latencyMs: Date.now() - t0, username, detail: '用户名或密码错误' });
      return res.status(401).json({ error: '用户名或密码错误' });
    }
    const token = await createSession(rows[0].id);
    await logOperation({ method: 'POST', path: '/api/auth/login', action: 'login', status: 'success', latencyMs: Date.now() - t0, userId: rows[0].id, username: rows[0].username });
    res.json({ token, username: rows[0].username });
  } catch (e) {
    await logOperation({ method: 'POST', path: '/api/auth/login', action: 'login', status: 'error', latencyMs: Date.now() - t0, detail: e?.message || String(e) });
    res.status(500).json({ error: `登录失败：${e.message || e}` });
  }
});

app.post('/api/auth/logout', authRequired, async (req, res) => {
  const t0 = Date.now();
  try {
    await pool.query('DELETE FROM sessions WHERE token = ?', [req.token]);
    await logOperation({ method: 'POST', path: '/api/auth/logout', action: 'logout', status: 'success', latencyMs: Date.now() - t0, userId: req.userId, username: req.username });
    res.json({ ok: true });
  } catch (e) {
    await logOperation({ method: 'POST', path: '/api/auth/logout', action: 'logout', status: 'error', latencyMs: Date.now() - t0, userId: req.userId, username: req.username, detail: e?.message || String(e) });
    res.status(500).json({ error: `退出失败：${e.message || e}` });
  }
});

app.get('/api/auth/me', authRequired, async (req, res) => {
  const t0 = Date.now();
  await logOperation({ method: 'GET', path: '/api/auth/me', action: 'me', status: 'success', latencyMs: Date.now() - t0, userId: req.userId, username: req.username });
  res.json({ username: req.username });
});

// ---- 数据（需登录，按账号隔离；带版本号实现乐观并发）----
app.get('/api/state', authRequired, async (req, res) => {
  const t0 = Date.now();
  try {
    const version = await getVersion(req.userId);
    const data = await readAll(req.userId);
    res.set('X-Version', String(version));
    await logOperation({ method: 'GET', path: '/api/state', action: 'read_state', status: 'success', latencyMs: Date.now() - t0, userId: req.userId, username: req.username, detail: `version=${version}` });
    res.json(data);
  } catch (e) {
    await logOperation({ method: 'GET', path: '/api/state', action: 'read_state', status: 'error', latencyMs: Date.now() - t0, userId: req.userId, username: req.username, detail: e?.message || String(e) });
    res.status(500).json({ error: `读取数据失败：${e.message || e}` });
  }
});

// (PUT /api/state 已移除，改用增量 CRUD + POST /api/batch)

// ---- 增量 CRUD 接口（各实体独立增删改，带版本校验）----

// ── txs ──
app.post('/api/entities/txs', authRequired, (req, res) => {
  handleWrite(req, res, async (conn) => {
    const x = req.body;
    await conn.query(
      'INSERT INTO txs (user_id,id,type,amount,category_id,account_id,date,time,location,pay_method,note,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',
      [req.userId, x.id, x.type, x.amount, x.categoryId, x.accountId, x.date, x.time ?? null, x.location ?? '', x.payMethod ?? '', x.note ?? '', x.createdAt ?? Date.now(), x.updatedAt ?? null],
    );
  }, 'add_tx');
});

app.put('/api/entities/txs/:id', authRequired, (req, res) => {
  handleWrite(req, res, async (conn) => {
    const p = req.body;
    const sets = [];
    const vals = [];
    const fields = {
      type: p.type, amount: p.amount, category_id: p.categoryId,
      account_id: p.accountId, date: p.date, time: p.time ?? null,
      location: p.location ?? '', pay_method: p.payMethod ?? '',
      note: p.note ?? '', updated_at: Date.now(),
    };
    for (const [col, val] of Object.entries(fields)) {
      sets.push(`${col}=?`);
      vals.push(val);
    }
    if (sets.length === 0) return;
    vals.push(req.userId, req.params.id);
    await conn.query(`UPDATE txs SET ${sets.join(',')} WHERE user_id=? AND id=?`, vals);
  }, 'update_tx');
});

app.delete('/api/entities/txs/:id', authRequired, (req, res) => {
  handleWrite(req, res, async (conn) => {
    await conn.query('DELETE FROM txs WHERE user_id=? AND id=?', [req.userId, req.params.id]);
  }, 'delete_tx');
});

// ── accounts ──
app.post('/api/entities/accounts', authRequired, (req, res) => {
  handleWrite(req, res, async (conn) => {
    const x = req.body;
    await conn.query(
      'INSERT INTO accounts (user_id,id,name,type,icon,color,initial_balance,hidden,created_at) VALUES (?,?,?,?,?,?,?,?,?)',
      [req.userId, x.id, x.name, x.type, x.icon, x.color, x.initialBalance ?? 0, x.hidden ? 1 : 0, x.createdAt ?? Date.now()],
    );
  }, 'add_account');
});

app.put('/api/entities/accounts/:id', authRequired, (req, res) => {
  handleWrite(req, res, async (conn) => {
    const p = req.body;
    await conn.query(
      'UPDATE accounts SET name=?,type=?,icon=?,color=?,initial_balance=?,hidden=? WHERE user_id=? AND id=?',
      [p.name, p.type, p.icon, p.color, p.initialBalance ?? 0, p.hidden ? 1 : 0, req.userId, req.params.id],
    );
  }, 'update_account');
});

app.delete('/api/entities/accounts/:id', authRequired, (req, res) => {
  handleWrite(req, res, async (conn) => {
    await conn.query('DELETE FROM accounts WHERE user_id=? AND id=?', [req.userId, req.params.id]);
  }, 'delete_account');
});

// ── categories ──
app.post('/api/entities/categories', authRequired, (req, res) => {
  handleWrite(req, res, async (conn) => {
    const x = req.body;
    await conn.query(
      'INSERT INTO categories (user_id,id,name,type,icon,color,is_default,sort,group_id) VALUES (?,?,?,?,?,?,?,?,?)',
      [req.userId, x.id, x.name, x.type, x.icon, x.color, x.isDefault ? 1 : 0, x.sort ?? 0, x.groupId || null],
    );
  }, 'add_category');
});

app.put('/api/entities/categories/:id', authRequired, (req, res) => {
  handleWrite(req, res, async (conn) => {
    const p = req.body;
    await conn.query(
      'UPDATE categories SET name=?,type=?,icon=?,color=?,is_default=?,sort=?,group_id=? WHERE user_id=? AND id=?',
      [p.name, p.type, p.icon, p.color, p.isDefault ? 1 : 0, p.sort ?? 0, p.groupId || null, req.userId, req.params.id],
    );
  }, 'update_category');
});

app.delete('/api/entities/categories/:id', authRequired, (req, res) => {
  handleWrite(req, res, async (conn) => {
    await conn.query('DELETE FROM categories WHERE user_id=? AND id=?', [req.userId, req.params.id]);
    await conn.query('DELETE FROM budgets WHERE user_id=? AND category_id=?', [req.userId, req.params.id]);
  }, 'delete_category');
});

// ── category-groups ──
app.post('/api/entities/category-groups', authRequired, (req, res) => {
  handleWrite(req, res, async (conn) => {
    const x = req.body;
    await conn.query(
      'INSERT INTO category_groups (user_id,id,name,type,icon,color,sort,created_at) VALUES (?,?,?,?,?,?,?,?)',
      [req.userId, x.id, x.name, x.type, x.icon, x.color, x.sort ?? 0, x.createdAt ?? Date.now()],
    );
  }, 'add_category_group');
});

app.put('/api/entities/category-groups/:id', authRequired, (req, res) => {
  handleWrite(req, res, async (conn) => {
    const p = req.body;
    await conn.query(
      'UPDATE category_groups SET name=?,type=?,icon=?,color=?,sort=? WHERE user_id=? AND id=?',
      [p.name, p.type, p.icon, p.color, p.sort ?? 0, req.userId, req.params.id],
    );
  }, 'update_category_group');
});

app.delete('/api/entities/category-groups/:id', authRequired, (req, res) => {
  handleWrite(req, res, async (conn) => {
    await conn.query('DELETE FROM category_groups WHERE user_id=? AND id=?', [req.userId, req.params.id]);
  }, 'delete_category_group');
});

// ── transfers ──
app.post('/api/entities/transfers', authRequired, (req, res) => {
  handleWrite(req, res, async (conn) => {
    const x = req.body;
    await conn.query(
      'INSERT INTO transfers (user_id,id,from_account_id,to_account_id,amount,date,note,created_at) VALUES (?,?,?,?,?,?,?,?)',
      [req.userId, x.id, x.fromAccountId, x.toAccountId, x.amount, x.date, x.note ?? '', x.createdAt ?? Date.now()],
    );
  }, 'add_transfer');
});

app.delete('/api/entities/transfers/:id', authRequired, (req, res) => {
  handleWrite(req, res, async (conn) => {
    await conn.query('DELETE FROM transfers WHERE user_id=? AND id=?', [req.userId, req.params.id]);
  }, 'delete_transfer');
});

// ── budgets ──
app.post('/api/entities/budgets', authRequired, (req, res) => {
  handleWrite(req, res, async (conn) => {
    const x = req.body;
    const [exist] = await conn.query(
      'SELECT id FROM budgets WHERE user_id=? AND category_id=? AND month=?',
      [req.userId, x.categoryId, x.month],
    );
    if (exist.length > 0) {
      await conn.query('UPDATE budgets SET amount=? WHERE user_id=? AND id=?', [x.amount, req.userId, exist[0].id]);
    } else {
      await conn.query(
        'INSERT INTO budgets (user_id,id,category_id,month,amount) VALUES (?,?,?,?,?)',
        [req.userId, x.id, x.categoryId, x.month, x.amount],
      );
    }
  }, 'add_budget');
});

app.delete('/api/entities/budgets/:id', authRequired, (req, res) => {
  handleWrite(req, res, async (conn) => {
    await conn.query('DELETE FROM budgets WHERE user_id=? AND id=?', [req.userId, req.params.id]);
  }, 'delete_budget');
});

// ── goals ──
app.post('/api/entities/goals', authRequired, (req, res) => {
  handleWrite(req, res, async (conn) => {
    const x = req.body;
    await conn.query(
      'INSERT INTO goals (user_id,id,name,target_amount,saved_amount,deadline,color,created_at) VALUES (?,?,?,?,?,?,?,?)',
      [req.userId, x.id, x.name, x.targetAmount, x.savedAmount ?? 0, x.deadline ?? null, x.color, x.createdAt ?? Date.now()],
    );
  }, 'add_goal');
});

app.put('/api/entities/goals/:id', authRequired, (req, res) => {
  handleWrite(req, res, async (conn) => {
    const p = req.body;
    await conn.query(
      'UPDATE goals SET name=?,target_amount=?,saved_amount=?,deadline=?,color=? WHERE user_id=? AND id=?',
      [p.name, p.targetAmount, p.savedAmount ?? 0, p.deadline ?? null, p.color, req.userId, req.params.id],
    );
  }, 'update_goal');
});

app.delete('/api/entities/goals/:id', authRequired, (req, res) => {
  handleWrite(req, res, async (conn) => {
    await conn.query('DELETE FROM goals WHERE user_id=? AND id=?', [req.userId, req.params.id]);
  }, 'delete_goal');
});

// ── settings ──
app.put('/api/entities/settings', authRequired, (req, res) => {
  handleWrite(req, res, async (conn) => {
    const v = { ...req.body };
    await conn.query(
      'REPLACE INTO settings (user_id,k,v) VALUES (?,?,?)',
      [req.userId, 'default', JSON.stringify(v)],
    );
  }, 'update_settings');
});

// ---- 批量操作接口（导入/清空/初始化等场景，单事务内执行多个增删改）----
app.post('/api/batch', authRequired, async (req, res) => {
  const t0 = Date.now();
  const expectedVersion = Number(req.headers['x-version'] ?? 0);
  const ops = Array.isArray(req.body?.ops) ? req.body.ops : [];
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const versionOk = await checkVersion(conn, req.userId, expectedVersion);
    if (!versionOk) {
      await conn.rollback();
      const latest = await readAll(req.userId);
      const currentVersion = await getVersion(req.userId);
      await logOperation({
        method: 'POST', path: '/api/batch', action: 'batch_conflict',
        status: 'conflict', latencyMs: Date.now() - t0,
        userId: req.userId, username: req.username,
        detail: `版本冲突：客户端=${expectedVersion}，当前=${currentVersion}`,
      });
      return res.status(409).json({
        error: '另一台设备已修改数据，已为你刷新到最新版本',
        version: currentVersion, data: latest,
      });
    }

    for (const op of ops) {
      const d = op.data || {};
      switch (op.action) {
        case 'clear':
          for (const table of DATA_TABLES) {
            await conn.query(`DELETE FROM \`${table}\` WHERE user_id = ?`, [req.userId]);
          }
          break;
        case 'add_account':
          await conn.query(
            'INSERT INTO accounts (user_id,id,name,type,icon,color,initial_balance,hidden,created_at) VALUES (?,?,?,?,?,?,?,?,?)',
            [req.userId, d.id, d.name, d.type, d.icon, d.color, d.initialBalance ?? 0, d.hidden ? 1 : 0, d.createdAt ?? Date.now()],
          );
          break;
        case 'add_category':
          await conn.query(
            'INSERT INTO categories (user_id,id,name,type,icon,color,is_default,sort,group_id) VALUES (?,?,?,?,?,?,?,?,?)',
            [req.userId, d.id, d.name, d.type, d.icon, d.color, d.isDefault ? 1 : 0, d.sort ?? 0, d.groupId || null],
          );
          break;
        case 'add_category_group':
          await conn.query(
            'INSERT INTO category_groups (user_id,id,name,type,icon,color,sort,created_at) VALUES (?,?,?,?,?,?,?,?)',
            [req.userId, d.id, d.name, d.type, d.icon, d.color, d.sort ?? 0, d.createdAt ?? Date.now()],
          );
          break;
        case 'add_tx':
          await conn.query(
            'INSERT INTO txs (user_id,id,type,amount,category_id,account_id,date,time,location,pay_method,note,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',
            [req.userId, d.id, d.type, d.amount, d.categoryId, d.accountId, d.date, d.time ?? null, d.location ?? '', d.payMethod ?? '', d.note ?? '', d.createdAt ?? Date.now(), d.updatedAt ?? null],
          );
          break;
        case 'add_transfer':
          await conn.query(
            'INSERT INTO transfers (user_id,id,from_account_id,to_account_id,amount,date,note,created_at) VALUES (?,?,?,?,?,?,?,?)',
            [req.userId, d.id, d.fromAccountId, d.toAccountId, d.amount, d.date, d.note ?? '', d.createdAt ?? Date.now()],
          );
          break;
        case 'add_budget':
          await conn.query(
            'INSERT INTO budgets (user_id,id,category_id,month,amount) VALUES (?,?,?,?,?)',
            [req.userId, d.id, d.categoryId, d.month, d.amount],
          );
          break;
        case 'add_goal':
          await conn.query(
            'INSERT INTO goals (user_id,id,name,target_amount,saved_amount,deadline,color,created_at) VALUES (?,?,?,?,?,?,?,?)',
            [req.userId, d.id, d.name, d.targetAmount, d.savedAmount ?? 0, d.deadline ?? null, d.color, d.createdAt ?? Date.now()],
          );
          break;
        case 'update_settings':
          await conn.query(
            'REPLACE INTO settings (user_id,k,v) VALUES (?,?,?)',
            [req.userId, 'default', JSON.stringify(d)],
          );
          break;
        default:
          break;
      }
    }

    await conn.commit();
    const newVersion = expectedVersion + 1;
    res.set('X-Version', String(newVersion));
    await logOperation({
      method: 'POST', path: '/api/batch', action: 'batch',
      status: 'success', latencyMs: Date.now() - t0,
      userId: req.userId, username: req.username,
      detail: `ops=${ops.length}, version=${newVersion}`,
    });
    res.json({ ok: true, version: newVersion });
  } catch (e) {
    await conn.rollback().catch(() => {});
    await logOperation({
      method: 'POST', path: '/api/batch', action: 'batch',
      status: 'error', latencyMs: Date.now() - t0,
      userId: req.userId, username: req.username,
      detail: e?.message || String(e),
    });
    res.status(500).json({ error: `批量操作失败：${e.message || e}` });
  } finally {
    conn.release();
  }
});

// 生产模式：托管前端构建产物（SPA 回退到 index.html，/api 除外）
if (existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(path.join(distDir, 'index.html')));
}

// ============================================================
// 启动
// ============================================================
async function start() {
  const admin = await mysql.createConnection({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASSWORD,
  });
  await admin.query(
    `CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
  );
  await admin.end();

  pool = mysql.createPool({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    charset: 'utf8mb4',
  });

  // 先建表再迁移：保证新库首次启动时表已存在（CREATE TABLE IF NOT EXISTS 幂等）
  for (const sql of TABLES) {
    await pool.query(sql);
  }
  await migrate();

  app.listen(PORT, () => {
    console.log(`🏝️  岛屿记账后端已启动: http://localhost:${PORT}`);
    console.log(`   数据库: ${DB_USER}@${DB_HOST}:${DB_PORT}/${DB_NAME}（多用户，数据按账号隔离）`);
  });
}

start().catch((e) => {
  console.error('❌ 后端启动失败：', e?.message || e);
  console.error('   请确认 MySQL 已启动，且账号密码正确（可用环境变量 DB_HOST/DB_PORT/DB_USER/DB_PASSWORD/DB_NAME 覆盖）。');
  process.exit(1);
});

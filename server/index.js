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

const DATA_TABLES = ['accounts', 'categories', 'txs', 'transfers', 'budgets', 'goals', 'settings'];
const DEFAULT_SETTINGS = { bellMode: false, bellRate: 10, firstName: '岛主' };

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

/**
 * 全量写入（乐观并发控制）：expectedVersion 与当前版本一致才执行「先删后插」；
 * 不一致说明有另一台设备改过数据，返回 { conflict } 由上层回 409，让前端刷新，
 * 避免旧设备的旧快照覆盖新设备刚写入的数据。
 */
async function writeAll(body, userId, expectedVersion) {
  const a = Array.isArray(body?.accounts) ? body.accounts : [];
  const c = Array.isArray(body?.categories) ? body.categories : [];
  const t = Array.isArray(body?.txs) ? body.txs : [];
  const tr = Array.isArray(body?.transfers) ? body.transfers : [];
  const b = Array.isArray(body?.budgets) ? body.budgets : [];
  const g = Array.isArray(body?.goals) ? body.goals : [];
  const s = { ...DEFAULT_SETTINGS, ...(body?.settings || {}) };

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // 行锁 + 版本比对，保证「校验版本 → 删 → 插 → 递增版本」是原子操作
    const [metaRows] = await conn.query(
      'SELECT version FROM meta WHERE user_id = ? FOR UPDATE',
      [userId],
    );
    const currentVersion = metaRows[0]?.version ?? 0;
    if (currentVersion !== expectedVersion) {
      await conn.rollback();
      return { conflict: true, version: currentVersion };
    }

    for (const table of DATA_TABLES) {
      await conn.query(`DELETE FROM \`${table}\` WHERE user_id = ?`, [userId]);
    }

    for (const x of a) {
      await conn.query(
        'INSERT INTO accounts (user_id,id,name,type,icon,color,initial_balance,hidden,created_at) VALUES (?,?,?,?,?,?,?,?,?)',
        [userId, x.id, x.name, x.type, x.icon, x.color, x.initialBalance ?? 0, x.hidden ? 1 : 0, x.createdAt ?? Date.now()],
      );
    }
    for (const x of c) {
      await conn.query(
        'INSERT INTO categories (user_id,id,name,type,icon,color,is_default,sort) VALUES (?,?,?,?,?,?,?,?)',
        [userId, x.id, x.name, x.type, x.icon, x.color, x.isDefault ? 1 : 0, x.sort ?? 0],
      );
    }
    for (const x of t) {
      await conn.query(
        'INSERT INTO txs (user_id,id,type,amount,category_id,account_id,date,time,location,pay_method,note,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',
        [userId, x.id, x.type, x.amount, x.categoryId, x.accountId, x.date, x.time ?? null, x.location ?? '', x.payMethod ?? '', x.note ?? '', x.createdAt ?? Date.now(), x.updatedAt ?? null],
      );
    }
    for (const x of tr) {
      await conn.query(
        'INSERT INTO transfers (user_id,id,from_account_id,to_account_id,amount,date,note,created_at) VALUES (?,?,?,?,?,?,?,?)',
        [userId, x.id, x.fromAccountId, x.toAccountId, x.amount, x.date, x.note ?? '', x.createdAt ?? Date.now()],
      );
    }
    for (const x of b) {
      await conn.query(
        'INSERT INTO budgets (user_id,id,category_id,month,amount) VALUES (?,?,?,?,?)',
        [userId, x.id, x.categoryId, x.month, x.amount],
      );
    }
    for (const x of g) {
      await conn.query(
        'INSERT INTO goals (user_id,id,name,target_amount,saved_amount,deadline,color,created_at) VALUES (?,?,?,?,?,?,?,?)',
        [userId, x.id, x.name, x.targetAmount, x.savedAmount ?? 0, x.deadline ?? null, x.color, x.createdAt ?? Date.now()],
      );
    }
    await conn.query('INSERT INTO settings (user_id,k,v) VALUES (?,?,?)', [
      userId,
      'default',
      JSON.stringify(s),
    ]);

    await conn.query(
      'INSERT INTO meta (user_id, version, updated_at) VALUES (?,?,?) ON DUPLICATE KEY UPDATE version = VALUES(version), updated_at = VALUES(updated_at)',
      [userId, currentVersion + 1, Date.now()],
    );

    await conn.commit();
    return { ok: true, version: currentVersion + 1 };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

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

app.put('/api/state', authRequired, async (req, res) => {
  const t0 = Date.now();
  try {
    const expectedVersion = Number(req.headers['x-version'] ?? 0);
    const result = await writeAll(req.body, req.userId, expectedVersion);
    if (result.conflict) {
      // 本请求基于的版本已过期：拒绝写入，返回最新数据让前端刷新
      const latest = await readAll(req.userId);
      await logOperation({
        method: 'PUT', path: '/api/state', action: 'save_state', status: 'conflict',
        latencyMs: Date.now() - t0, userId: req.userId, username: req.username,
        detail: `版本冲突：客户端=${expectedVersion}，当前=${result.version}`,
      });
      res.status(409).json({ error: '另一台设备已修改数据，已为你刷新到最新版本', version: result.version, data: latest });
      return;
    }
    res.set('X-Version', String(result.version));
    await logOperation({ method: 'PUT', path: '/api/state', action: 'save_state', status: 'success', latencyMs: Date.now() - t0, userId: req.userId, username: req.username, detail: `version=${result.version}` });
    res.json({ ok: true, version: result.version });
  } catch (e) {
    await logOperation({ method: 'PUT', path: '/api/state', action: 'save_state', status: 'error', latencyMs: Date.now() - t0, userId: req.userId, username: req.username, detail: e?.message || String(e) });
    res.status(500).json({ error: `保存数据失败：${e.message || e}` });
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

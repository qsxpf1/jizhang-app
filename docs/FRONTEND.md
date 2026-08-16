# 前端深度参考（src/）

技术栈：Vite + React 18 + TS(strict) + `animal-island-ui` + **HashRouter** + zustand + recharts。读本文前先读根目录 `CLAUDE.md` §3 架构与数据流与 §4 文件职责。本文重点讲 store 数据层怎么工作、组件/页面怎么写、样式约定。

## 1. 启动与构建

- 开发：`npm run dev`（:5173，`/api` 由 vite 代理到 :3000）；`npm run dev:all` 前后端一起。
- 构建：`npm run build` = `tsc && vite build`，产物进 `dist/`（生产由后端托管，见 docs/BACKEND.md §8）。
- 入口：`main.tsx` 在渲染前执行 `useAuthStore.getState().boot()` 校验本地 token。

## 2. 三个 zustand store

### useBookStore（核心：业务数据 + 自动保存）

持有全部业务数据（accounts/categories/categoryGroups/txs/transfers/budgets/goals/settings）与 CRUD actions，外加：
- `hydrated` 是否已从后端加载完；`loadError` 加载失败信息；
- `saveStatus`：`idle | saving | success | error | conflict`；`saveError`。

**模块级私有变量**（不在 state 里，避免触发保存循环）：
- `currentVersion` — 服务器端数据版本（乐观并发用）；
- `lastSavedJson` — 上次成功写入的 JSON，用于**跳过无需重复写入**的场景（如加载回显）；
- `saveTimer` — 防抖计时器。

**自动保存管线（最关键，改它先看这里）：**

```js
useBookStore.subscribe((state, prevState) => {
  if (!state.hydrated) return;                    // 未加载完不保存
  const dataChanged = 8 个业务数组引用是否变化；    // 引用比较，UI 状态变化不触发
  if (!dataChanged) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveNow, 200);           // 防抖 200ms
});

async function saveNow() {
  // 1. buildPayload() 取全量快照 → JSON 与 lastSavedJson 相同则直接 return
  // 2. setState({ saveStatus:'saving' })
  // 3. putState(payload, currentVersion) → 成功后 currentVersion = res.version; lastSavedJson = json
  // 4. ConflictError → currentVersion = e.latest.version; setState({...e.latest.data, saveStatus:'conflict'})
  //    即放弃本地、刷新为服务器数据
  // 5. 其他错误 → saveStatus='error' + saveError
}
```

- **为什么能避免保存循环**：subscribe 只看 8 个业务数组的引用，`setState({saveStatus})` 不改变它们 → 不触发。
- **init() 的两个分支**：`version===0 && accounts 空` → 种 DEFAULT_ACCOUNTS/DEFAULT_CATEGORIES（**双条件，见 CLAUDE.md §8 事故**）；否则 `set({...snap, categoryGroups: snap.categoryGroups ?? []})`。两分支都会先写 `lastSavedJson`，防止回显触发一次多余 PUT。
- **reset()**：退出登录时清空内存、`currentVersion=0`、`lastSavedJson=null`，避免串号。

### useAuthStore（登录态）

`status: loading | guest | authed`。`boot()` 启动时校验 token → `me()` → 成功后 `useBookStore.init()`；登录/注册同理；`logout()` 调后端后 `useBookStore.reset()`。

### useUiStore（UI 态）

全局「记一笔」弹窗：`recordOpen` + `editingTx`，`openRecord(tx?)` / `closeRecord()`。AppLayout 里放 FAB 与 RecordModal。

## 3. 数据流（页面怎么写）

```tsx
const txs = useBookStore((s) => s.txs);        // 订阅
const addTx = useBookStore((s) => s.addTx);    // action
// 用户操作 → addTx(payload) → store 内部 set → subscribe 自动保存
```

- **页面/组件只读 store、调 action，不直接 fetch**；与后端的一切交互在 `api.ts`。
- 派生数据一律 `useMemo`（页面里反复出现该模式）；复杂计算放 `utils/calc.ts` 纯函数。
- **排序/分组**：取到 txs 后 `.sort(sortTx)` → `groupByDate(txs)` → 传给 `TxGrouped`（首页、流水页共用渲染）。
- **编辑/新增表单**：`RecordForm` 复用；编辑时传 `editing`，新增时 `resetKey` 变化重置（快速连记）。
- **弹窗通用模式**：本地 `useState(open/editing)` 管实体弹窗（Account/Category/Goal/Transfer…）；全局记账弹窗走 uiStore。

## 4. api.ts 关键点

- token 存 `localStorage['jizhang-token']`（`getToken/setToken`，带 try/catch）。
- `request()` 通用封装（auth 接口用）；`getState()` / `putState()` 是手写 fetch，因为要读写 `X-Version` 响应头。
- `putState` 里 `writeChain`（模块级 Promise 链）**串行化所有写请求**，防快速操作竞态。
- `ConflictError`：409 时抛带 `latest: {data, version}` 的专用错误，store 据此刷新。

## 5. 组件与页面模式

- **RecordForm**：首页快速记账 + RecordModal 共用。props：`editing` / `resetKey` / `onSubmit` / `showCancel` / `autoFocusAmount`。含分类（按大类分组显示）、账户（折叠最多 3 个）、支付方式、日期/时间、地点（历史地点联想下拉）、说明。
- **RecordModal**：`open` 时 `formKey+1` 强制重挂载表单（保证新增/编辑状态干净）。
- **TxGrouped**：props `{groups, categories, accounts, settings, onEdit, onDelete, emptyText}`，按日期分组渲染卡片。
- **页面骨架**：`.page` 容器 + `.page-head`（`page-title`/`page-desc`）+ 内容卡 + 删除确认 `Modal`（`typewriter={false}`，danger 按钮）。参照 Home.tsx / List.tsx。
- **Modal 约定**：`<Modal open title onClose typewriter={false} footer={<>取消 / 确认</>}>`；确认按钮 `type="primary"` + 删除用 `danger`。

## 6. 样式约定（index.css）

- **全部用动森风 CSS 变量**：`--ac-bg` `--ac-text` `--ac-title` `--ac-primary` `--ac-error` `--ac-border` 等，**不要写死 hex**（除非图表数据色，那是数据文件里的色值）。
- **通用工具类**：`mt8/mt16/mt24`（margin-top）、`row`（flex 行）、`grow`（flex:1）、`empty`（空态）、`form-tip`、`section-label`、`card-head`、`page-desc`。
- **表单类**：`date-native`（原生日期/时间输入，统一样式）、`type-toggle`/`type-btn`（支出/收入切换，active 有 expense/income 两个配色变体）、`cat-chip`/`acc-chip`（分类/账户选择）、`settings-row`（设置项行）。
- **响应式**：断点 `900px`（PC 侧边栏↔移动端）与 `700px`。移动端底部 TabBar `.app-tabbar`；FAB `.fab` 右下角。
- 全局动画、进度条等由 `animal-island-ui` + 少量自定义 CSS 提供。

## 7. 常见开发任务清单

**加一个页面：**
1. `src/pages/X.tsx` 写页面（照 Home/List 骨架）；
2. `App.tsx` 加 `const X = lazy(...)` + `<Route path="/x" element={<X/>} />`；
3. `AppLayout.tsx` 的 `NAV` 数组加 `{path,label,icon,mobile}`。

**给 tx 加一个可选字段（如 'store'）：**
1. `types.ts` Tx 加 `store?: string`；
2. `RecordForm.tsx` 加输入控件，`handleSave` 里 `store: store.trim() || undefined`；
3. `TxGrouped.tsx` 展示（可选）；
4. `server/index.js`：`TABLES` 的 txs 加列 → `readAll` 映射 `store: r.store || undefined` → `writeAll` INSERT 加列 → `migrate()` 加幂等补列（`information_schema` 判断）；
5. 若 seed/默认数据要带，`data/defaults.ts` 的 seedTransactions 可选。

**加一个成就：**
`data/achievements.ts` 数组加一条 `{id,icon,name,desc,check(ctx)}`；需要新指标则先在 `Achievements.tsx` 的 `AchCtx` 计算里加上。

**注意**：凡动数据形状，前端 store 的 `Snapshot`/`types.ts` 与后端 `readAll/writeAll` 必须同步改，保持 camel/snake 双向映射一致。

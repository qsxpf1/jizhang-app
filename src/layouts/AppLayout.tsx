import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { Button, Cursor, Divider, Footer } from 'animal-island-ui';
import { useBookStore } from '../store/useBookStore';
import { useUiStore } from '../store/useUiStore';
import { useAuthStore } from '../store/useAuthStore';
import RecordModal from '../components/RecordModal';
import LoginScreen from '../components/LoginScreen';

interface NavItem {
  path: string;
  label: string;
  icon: string;
  /** 是否出现在移动端底部 TabBar */
  mobile: boolean;
}

const NAV: NavItem[] = [
  { path: '/', label: '首页', icon: '🏝️', mobile: true },
  { path: '/list', label: '流水', icon: '📋', mobile: true },
  { path: '/stats', label: '统计', icon: '📊', mobile: true },
  { path: '/accounts', label: '账户', icon: '💰', mobile: true },
  { path: '/budget', label: '预算', icon: '🎯', mobile: false },
  { path: '/goals', label: '存钱', icon: '⛳', mobile: false },
  { path: '/achievements', label: '成就', icon: '🏆', mobile: false },
  { path: '/settings', label: '设置', icon: '⚙️', mobile: true },
];

export default function AppLayout({ children }: { children: ReactNode }) {
  const bellMode = useBookStore((s) => s.settings.bellMode);
  const openRecord = useUiStore((s) => s.openRecord);
  const hydrated = useBookStore((s) => s.hydrated);
  const loadError = useBookStore((s) => s.loadError);
  const init = useBookStore((s) => s.init);
  const authStatus = useAuthStore((s) => s.status);

  if (authStatus === 'loading') {
    return (
      <Cursor>
        <div className="app-loading">
          <span className="app-loading-icon">🏝️</span>
          <p className="app-loading-title">正在检查登录…</p>
        </div>
      </Cursor>
    );
  }

  if (authStatus === 'guest') {
    return <LoginScreen />;
  }

  if (loadError) {
    return (
      <Cursor>
        <div className="app-loading">
          <span className="app-loading-icon">⚠️</span>
          <p className="app-loading-title">无法连接后端服务</p>
          <p className="page-desc">{loadError}</p>
          <Button type="primary" onClick={() => init()}>
            重试
          </Button>
        </div>
      </Cursor>
    );
  }

  if (!hydrated) {
    return (
      <Cursor>
        <div className="app-loading">
          <span className="app-loading-icon">🏝️</span>
          <p className="app-loading-title">正在加载账本…</p>
        </div>
      </Cursor>
    );
  }

  return (
    <Cursor>
      <div className="app-shell">
        {/* PC 侧边栏 */}
        <aside className="app-sidebar">
          <div className="app-logo">
            <span className="app-logo-icon">🏝️</span>
            <div>
              <div className="app-logo-title">岛屿记账</div>
              <div className="app-logo-sub">Animal Ledger</div>
            </div>
          </div>
          <Divider type="line-brown" />
          <nav className="app-nav">
            {NAV.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/'}
                className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}
              >
                <span className="nav-icon">{item.icon}</span>
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>
          <div className="app-sidebar-foot">
            {bellMode && <span className="bell-chip">🪙 铃钱模式</span>}
          </div>
        </aside>

        {/* 主内容区 */}
        <div className="app-main">
          <main className="app-content">{children}</main>
          <Footer type="sea" />
        </div>

        {/* 移动端底部 TabBar */}
        <nav className="app-tabbar">
          {NAV.filter((item) => item.mobile).map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) => (isActive ? 'tab-item active' : 'tab-item')}
            >
              <span className="tab-icon">{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* 全局「记一笔」浮动按钮 */}
        <button
          type="button"
          className="fab"
          aria-label="记一笔"
          title="记一笔"
          onClick={() => openRecord()}
        >
          ＋
        </button>
      </div>
      <RecordModal />
    </Cursor>
  );
}

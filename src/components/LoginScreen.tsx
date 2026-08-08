import { useState } from 'react';
import { Button, Card, Cursor, Input } from 'animal-island-ui';
import { useAuthStore } from '../store/useAuthStore';

type Mode = 'login' | 'register';

/** 登录 / 注册页（未登录时展示，全屏居中） */
export default function LoginScreen() {
  const { login, register, busy, error, clearError } = useAuthStore();
  const [mode, setMode] = useState<Mode>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const switchMode = (m: Mode) => {
    setMode(m);
    clearError();
  };

  const submit = async () => {
    if (!username.trim() || !password) return;
    if (mode === 'login') await login(username.trim(), password);
    else await register(username.trim(), password);
  };

  return (
    <Cursor>
      <div className="login-wrap">
        <Card className="login-card">
          <div className="login-logo">🏝️</div>
          <h1 className="login-title">岛屿记账</h1>
          <p className="login-sub">Animal Ledger · 你的岛上财务管家</p>

          <div className="type-toggle login-toggle">
            <button
              type="button"
              className={`type-btn ${mode === 'login' ? 'active' : ''}`}
              onClick={() => switchMode('login')}
            >
              登录
            </button>
            <button
              type="button"
              className={`type-btn ${mode === 'register' ? 'active' : ''}`}
              onClick={() => switchMode('register')}
            >
              注册
            </button>
          </div>

          <div className="form-label">账号</div>
          <Input
            placeholder="用户名（唯一）"
            value={username}
            maxLength={20}
            onChange={(e) => setUsername(e.target.value)}
          />

          <div className="form-label">密码</div>
          <Input
            type="password"
            placeholder={mode === 'register' ? '至少 4 位' : '请输入密码'}
            value={password}
            maxLength={64}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit();
            }}
          />

          {error && <p className="form-error">{error}</p>}

          <Button type="primary" block className="mt16" loading={busy} onClick={submit}>
            {mode === 'login' ? '登录' : '注册并登录'}
          </Button>
          <p className="login-hint">
            {mode === 'login' ? '没有账号？点上方「注册」创建，各账号数据互相隔离' : '注册后自动登录，账目仅你自己可见'}
          </p>
        </Card>
      </div>
    </Cursor>
  );
}

import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import 'animal-island-ui/style';
import './index.css';
import App from './App';
import { useAuthStore } from './store/useAuthStore';

// 启动时校验登录态；通过后再加载该账号的账本数据
useAuthStore.getState().boot();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>,
);

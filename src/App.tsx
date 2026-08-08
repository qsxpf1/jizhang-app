import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import AppLayout from './layouts/AppLayout';

const Home = lazy(() => import('./pages/Home'));
const List = lazy(() => import('./pages/List'));
const Stats = lazy(() => import('./pages/Stats'));
const Accounts = lazy(() => import('./pages/Accounts'));
const Budget = lazy(() => import('./pages/Budget'));
const Goals = lazy(() => import('./pages/Goals'));
const Achievements = lazy(() => import('./pages/Achievements'));
const Settings = lazy(() => import('./pages/Settings'));

export default function App() {
  return (
    <AppLayout>
      <Suspense
        fallback={
          <div className="page-loading">
            <span>🏝️</span>
            加载中…
          </div>
        }
      >
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/list" element={<List />} />
          <Route path="/stats" element={<Stats />} />
          <Route path="/accounts" element={<Accounts />} />
          <Route path="/budget" element={<Budget />} />
          <Route path="/goals" element={<Goals />} />
          <Route path="/achievements" element={<Achievements />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Home />} />
        </Routes>
      </Suspense>
    </AppLayout>
  );
}

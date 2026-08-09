import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { RouteGuard } from './components/RouteGuard';
import { FloatingTabBar } from './components/FloatingTabBar';
import { AppStoreProvider, useAppStore } from './lib/store';
import Home from './pages/Home';
import Onboarding from './pages/Onboarding';
import Add from './pages/Add';
import Expenses from './pages/Expenses';
import Report from './pages/Report';
import Benchmark from './pages/Benchmark';
import Challenge from './pages/Challenge';
import Premium from './pages/Premium';
import Settings from './pages/Settings';

export default function App() {
  return (
    <AppStoreProvider>
      <AppRoutes />
    </AppStoreProvider>
  );
}

function AppRoutes() {
  const { profile, isLoading } = useAppStore();
  // store 로드 전에는 onboarded 미확정(undefined) — 가드가 리다이렉트를 보류한다.
  const onboarded = isLoading ? undefined : profile.onboarded;
  const location = useLocation();
  const showTabBar = onboarded === true && location.pathname !== '/onboarding';

  return (
    <>
      <Routes>
        <Route path="/onboarding" element={<RouteGuard onboarded={onboarded}><Onboarding /></RouteGuard>} />
        <Route path="/" element={<RouteGuard onboarded={onboarded}><Home /></RouteGuard>} />
        <Route path="/add" element={<RouteGuard onboarded={onboarded}><Add /></RouteGuard>} />
        <Route path="/expenses" element={<RouteGuard onboarded={onboarded}><Expenses /></RouteGuard>} />
        <Route path="/report" element={<RouteGuard onboarded={onboarded}><Report /></RouteGuard>} />
        <Route path="/benchmark" element={<RouteGuard onboarded={onboarded}><Benchmark /></RouteGuard>} />
        <Route path="/challenge" element={<RouteGuard onboarded={onboarded}><Challenge /></RouteGuard>} />
        <Route path="/premium" element={<RouteGuard onboarded={onboarded}><Premium /></RouteGuard>} />
        <Route path="/settings" element={<RouteGuard onboarded={onboarded}><Settings /></RouteGuard>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {showTabBar && (
        <FloatingTabBar
          items={[
            { label: '홈', path: '/' },
            { label: '내역', path: '/expenses' },
            { label: '리포트', path: '/report' },
            { label: '설정', path: '/settings' },
          ]}
        />
      )}
    </>
  );
}

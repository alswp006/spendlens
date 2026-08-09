import { Routes, Route, useLocation } from 'react-router-dom';
import { RouteGuard } from './components/RouteGuard';
import { FloatingTabBar } from './components/FloatingTabBar';
import { getItem } from './lib/storage';
import { AppStoreProvider } from './lib/store';
import type { UserProfile } from './lib/types';
import Home from './pages/Home';
import Onboarding from './pages/Onboarding';
import Add from './pages/Add';
import Expenses from './pages/Expenses';
import Report from './pages/Report';
import Benchmark from './pages/Benchmark';
import Challenge from './pages/Challenge';
import Premium from './pages/Premium';
import Settings from './pages/Settings';

function useOnboarded() {
  const profile = getItem<UserProfile>('spendlens.profile.v1');
  return profile?.onboarded ?? false;
}

export default function App() {
  const onboarded = useOnboarded();
  const location = useLocation();
  const showTabBar = onboarded && location.pathname !== '/onboarding';
  return (
    <AppStoreProvider>
      <Routes>
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="/" element={<RouteGuard onboarded={onboarded}><Home /></RouteGuard>} />
        <Route path="/add" element={<RouteGuard onboarded={onboarded}><Add /></RouteGuard>} />
        <Route path="/expenses" element={<RouteGuard onboarded={onboarded}><Expenses /></RouteGuard>} />
        <Route path="/report" element={<RouteGuard onboarded={onboarded}><Report /></RouteGuard>} />
        <Route path="/benchmark" element={<RouteGuard onboarded={onboarded}><Benchmark /></RouteGuard>} />
        <Route path="/challenge" element={<RouteGuard onboarded={onboarded}><Challenge /></RouteGuard>} />
        <Route path="/premium" element={<RouteGuard onboarded={onboarded}><Premium /></RouteGuard>} />
        <Route path="/settings" element={<RouteGuard onboarded={onboarded}><Settings /></RouteGuard>} />
        <Route path="*" element={<RouteGuard onboarded={onboarded}><Home /></RouteGuard>} />
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
    </AppStoreProvider>
  );
}

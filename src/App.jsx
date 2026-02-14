import { useEffect, useRef } from 'react';
import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import NavigationTracker from '@/lib/NavigationTracker'
import { pagesConfig } from './pages.config'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import { LandingPage } from '@/components/landing/LandingPage';
import MobileTabBar from '@/components/MobileTabBar';

const { Pages, Layout, mainPage } = pagesConfig;
const mainPageKey = mainPage ?? Object.keys(Pages)[0];
const MainPage = mainPageKey ? Pages[mainPageKey] : <></>;

const LayoutWrapper = ({ children, currentPageName }) => Layout ?
  <Layout currentPageName={currentPageName}>{children}</Layout>
  : <>{children}</>;

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();
  const touchStartYRef = useRef(0);
  const touchStartXRef = useRef(0);

  useEffect(() => {
    const isCoarseMobile = window.matchMedia('(max-width: 767px) and (pointer: coarse)').matches;
    if (!isCoarseMobile) return;

    const onTouchStart = (event) => {
      touchStartYRef.current = event.touches?.[0]?.clientY ?? 0;
      touchStartXRef.current = event.touches?.[0]?.clientX ?? 0;
    };

    const onTouchMove = (event) => {
      const currentY = event.touches?.[0]?.clientY ?? 0;
      const currentX = event.touches?.[0]?.clientX ?? 0;
      const deltaY = currentY - touchStartYRef.current;
      const deltaX = Math.abs(currentX - touchStartXRef.current);
      const scrollTop = document.scrollingElement?.scrollTop ?? window.scrollY;
      const isPullingDownAtTop = scrollTop <= 0 && deltaY > 8 && deltaY > deltaX;
      if (isPullingDownAtTop) {
        event.preventDefault();
      }
    };

    document.addEventListener('touchstart', onTouchStart, { passive: true });
    document.addEventListener('touchmove', onTouchMove, { passive: false });
    return () => {
      document.removeEventListener('touchstart', onTouchStart);
      document.removeEventListener('touchmove', onTouchMove);
    };
  }, []);

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      // Show landing page instead of auto-redirecting
      return <LandingPage onSignIn={navigateToLogin} />;
    }
  }

  // Render the main app
  return (
    <div className="mobile-app-shell">
      <Routes>
        <Route path="/" element={
          <LayoutWrapper currentPageName={mainPageKey}>
            <MainPage />
          </LayoutWrapper>
        } />
        {Object.entries(Pages).map(([path, Page]) => (
          <Route
            key={path}
            path={`/${path}`}
            element={
              <LayoutWrapper currentPageName={path}>
                <Page />
              </LayoutWrapper>
            }
          />
        ))}
        <Route path="*" element={<PageNotFound />} />
      </Routes>
      <MobileTabBar />
    </div>
  );
};


function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <NavigationTracker />
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App

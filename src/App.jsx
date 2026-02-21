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
      /* Option A: Do not interfere when the touch is inside the tab content area (Home 3-tab layout).
         There the scroll container is .tab-content-area, not document; preventDefault() here would
         block that scroll and cause stuck/ disconnected scroll. */
      if (
        event.target instanceof Element &&
        event.target.closest(".tab-content-area")
      ) {
        return;
      }

      const inPullRefreshZone =
        event.target instanceof Element &&
        !!event.target.closest('[data-pull-refresh-zone="true"]');
      if (inPullRefreshZone) return;

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

  // Splash/loading screen while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div
        style={{
          width: "100vw",
          height: "100dvh",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          background: "#faf7f2",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Ambient orange orbs — same as the main app */}
        <div
          style={{
            position: "absolute",
            top: "15%",
            left: "20%",
            width: 300,
            height: 300,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(224,112,40,0.08) 0%, transparent 70%)",
            filter: "blur(40px)",
            pointerEvents: "none",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: "20%",
            right: "15%",
            width: 250,
            height: 250,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(224,112,40,0.06) 0%, transparent 70%)",
            filter: "blur(40px)",
            pointerEvents: "none",
          }}
        />

        {/* Logo — centered */}
        <img
          src="/pulse-logo.svg"
          alt="PulseApp"
          style={{
            width: 80,
            height: 80,
            objectFit: "contain",
            marginBottom: 24,
          }}
        />

        {/* Pulse dots (replaces spinner) */}
        <div
          className="splash-pulse-dots"
          style={{
            display: "flex",
            gap: "6px",
            alignItems: "center",
          }}
        >
          <span className="splash-dot" style={{ animationDelay: "0ms" }} />
          <span className="splash-dot" style={{ animationDelay: "150ms" }} />
          <span className="splash-dot" style={{ animationDelay: "300ms" }} />
        </div>
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

import { useEffect, useRef } from 'react';
import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import NavigationTracker from '@/lib/NavigationTracker'
import { pagesConfig } from './pages.config'
import { BrowserRouter as Router, Route, Routes, useLocation } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import { LandingPage } from '@/components/landing/LandingPage';
import { isNativeApp } from '@/utils/isNativeApp';


const { Pages, Layout, mainPage } = pagesConfig;
const mainPageKey = mainPage ?? Object.keys(Pages)[0];
const MainPage = mainPageKey ? Pages[mainPageKey] : <></>;

function NativeAppAuthRedirect() {
  useEffect(() => {
    window.location.replace("/login");
  }, []);
  return <div style={{ width: "100vw", height: "100dvh", background: "#faf7f2" }} />;
}

const LayoutWrapper = ({ children, currentPageName }) => Layout ?
  <Layout currentPageName={currentPageName}>{children}</Layout>
  : <>{children}</>;

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();
  const location = useLocation();
  const touchStartYRef = useRef(0);
  const touchStartXRef = useRef(0);

  // Global redirect: native app on landing path when auth required → go straight to /login
  useEffect(() => {
    if (isNativeApp() && authError?.type === "auth_required") {
      const path = window.location.pathname || "";
      if (path === "/" || path === "" || path === "/landing") {
        window.location.replace("/login");
      }
    }
  }, [location.pathname, authError?.type]);

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

  // Loading state while checking app public settings or auth — warm beige only, no duplicate splash (Prompt G)
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div
        style={{
          width: "100vw",
          height: "100dvh",
          background: "#faf7f2",
        }}
      />
    );
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      // Native app: never show landing — go straight to /login
      if (isNativeApp()) {
        return <NativeAppAuthRedirect />;
      }
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
  // Prevent pinch-to-zoom and double-tap zoom (Prompt G §3c)
  useEffect(() => {
    const preventZoom = (e) => {
      if (e.touches && e.touches.length > 1) {
        e.preventDefault();
      }
    };

    let lastTouchEnd = 0;
    const preventDoubleTapZoom = (e) => {
      const now = Date.now();
      if (now - lastTouchEnd < 300) {
        e.preventDefault();
      }
      lastTouchEnd = now;
    };

    document.addEventListener("touchmove", preventZoom, { passive: false });
    document.addEventListener("touchend", preventDoubleTapZoom, { passive: false });

    return () => {
      document.removeEventListener("touchmove", preventZoom);
      document.removeEventListener("touchend", preventDoubleTapZoom);
    };
  }, []);

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

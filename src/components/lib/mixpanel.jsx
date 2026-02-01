import mixpanel from 'mixpanel-browser';

// Initialize Mixpanel
const MIXPANEL_TOKEN = 'fb89947ab79db86cb5a1ed97b535e043';

// Initialize with options for better performance
mixpanel.init(MIXPANEL_TOKEN, {
  debug: false, // Set to true for development debugging
  track_pageview: false, // We'll manually track page views for better control
  persistence: 'localStorage',
  ignore_dnt: false, // Respect Do Not Track
  batch_requests: true, // Batch events for better performance
  batch_size: 50,
  batch_flush_interval_ms: 5000,
});

// Session tracking
let sessionStartTime = null;
let sectionViewTimes = {};

// Helper to get session duration
const getSessionDuration = () => {
  if (!sessionStartTime) return 0;
  return Math.round((Date.now() - sessionStartTime) / 1000);
};

// Helper to generate session ID
const getSessionId = () => {
  let sessionId = sessionStorage.getItem('mixpanel_session_id');
  if (!sessionId) {
    sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    sessionStorage.setItem('mixpanel_session_id', sessionId);
  }
  return sessionId;
};

// Track landing page view (call this on mount)
export const trackLandingPageView = () => {
  sessionStartTime = Date.now();
  
  mixpanel.track('Landing Page Viewed', {
    session_id: getSessionId(),
    session_start_time: new Date().toISOString(),
    referrer: document.referrer || 'direct',
    url: window.location.href,
  });
};

// Track section view with IntersectionObserver
export const trackSectionView = (sectionName) => {
  const timeOnPage = getSessionDuration();
  
  // Track when section first enters view
  if (!sectionViewTimes[sectionName]) {
    sectionViewTimes[sectionName] = Date.now();
    
    mixpanel.track('Section Viewed', {
      session_id: getSessionId(),
      section: sectionName,
      time_to_view_seconds: timeOnPage,
      scroll_depth_percent: Math.round((window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100),
    });
  }
};

// Track CTA click
export const trackCTAClick = (ctaLocation) => {
  mixpanel.track('CTA Clicked', {
    session_id: getSessionId(),
    cta_location: ctaLocation,
    time_on_page_seconds: getSessionDuration(),
  });
};

// Track waitlist modal opened
export const trackWaitlistModalOpened = (triggeredBy) => {
  mixpanel.track('Waitlist Modal Opened', {
    session_id: getSessionId(),
    triggered_by: triggeredBy,
    time_on_page_seconds: getSessionDuration(),
    modal_open_time: Date.now(), // Store for later calculation
  });
  
  // Store modal open time for duration calculation
  sessionStorage.setItem('modal_open_time', Date.now().toString());
};

// Track waitlist modal closed
export const trackWaitlistModalClosed = (closeMethod, submitted = false) => {
  const modalOpenTime = parseInt(sessionStorage.getItem('modal_open_time') || Date.now());
  const timeInModal = Math.round((Date.now() - modalOpenTime) / 1000);
  
  mixpanel.track('Waitlist Modal Closed', {
    session_id: getSessionId(),
    close_method: closeMethod, // 'esc', 'x_button', 'outside_click', 'submitted'
    submitted,
    time_in_modal_seconds: timeInModal,
    total_time_on_page_seconds: getSessionDuration(),
  });
  
  // Clear modal open time
  sessionStorage.removeItem('modal_open_time');
};

// Track waitlist form submission
export const trackWaitlistFormSubmit = (status, errorMessage = null) => {
  const modalOpenTime = parseInt(sessionStorage.getItem('modal_open_time') || Date.now());
  const timeInModal = Math.round((Date.now() - modalOpenTime) / 1000);
  
  mixpanel.track('Waitlist Form Submitted', {
    session_id: getSessionId(),
    status, // 'success', 'error', 'already_exists'
    error_message: errorMessage,
    time_in_modal_seconds: timeInModal,
    total_time_on_page_seconds: getSessionDuration(),
  });
  
  // If successful, identify the user (without PII)
  if (status === 'success') {
    // Track conversion
    mixpanel.track('Waitlist Conversion', {
      session_id: getSessionId(),
      total_session_duration_seconds: getSessionDuration(),
      sections_viewed: Object.keys(sectionViewTimes),
    });
  }
};

// Track page exit (call on unmount or beforeunload)
export const trackLandingPageExit = (converted = false) => {
  const sessionDuration = getSessionDuration();
  
  // Use sendBeacon for reliable event sending on page exit
  mixpanel.track('Landing Page Exited', {
    session_id: getSessionId(),
    total_session_duration_seconds: sessionDuration,
    sections_viewed: Object.keys(sectionViewTimes),
    converted,
  });
  
  // Flush any pending events
  mixpanel.flush();
};

// Set up IntersectionObserver for automatic section tracking
export const setupSectionTracking = (sectionRefs) => {
  const observerOptions = {
    root: null,
    rootMargin: '0px',
    threshold: 0.3, // Track when 30% of section is visible
  };
  
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const sectionName = entry.target.dataset.section || entry.target.id;
        if (sectionName) {
          trackSectionView(sectionName);
        }
      }
    });
  }, observerOptions);
  
  // Observe all section refs
  sectionRefs.forEach((ref) => {
    if (ref.current) {
      observer.observe(ref.current);
    }
  });
  
  return () => {
    observer.disconnect();
  };
};

export default mixpanel;
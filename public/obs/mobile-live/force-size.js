// Force 1080x1920 size for OBS Browser Source
(function() {
  'use strict';
  
  // Set viewport size immediately
  function forceViewportSize() {
    // Force document dimensions
    document.documentElement.style.width = '1080px';
    document.documentElement.style.height = '1920px';
    document.documentElement.style.overflow = 'hidden';
    
    document.body.style.width = '1080px';
    document.body.style.height = '1920px';
    document.body.style.margin = '0';
    document.body.style.padding = '0';
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = '0';
    document.body.style.left = '0';
    
    // Set viewport meta tag
    let viewport = document.querySelector('meta[name="viewport"]');
    if (!viewport) {
      viewport = document.createElement('meta');
      viewport.name = 'viewport';
      document.head.appendChild(viewport);
    }
    viewport.content = 'width=1080, height=1920, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no';
    
    // Override window inner dimensions (for OBS)
    if (typeof window !== 'undefined') {
      try {
        Object.defineProperty(window, 'innerWidth', {
          get: function() { return 1080; },
          configurable: true
        });
        
        Object.defineProperty(window, 'innerHeight', {
          get: function() { return 1920; },
          configurable: true
        });
        
        // Override screen dimensions
        Object.defineProperty(window.screen, 'width', {
          get: function() { return 1080; },
          configurable: true
        });
        
        Object.defineProperty(window.screen, 'height', {
          get: function() { return 1920; },
          configurable: true
        });
        
        Object.defineProperty(window.screen, 'availWidth', {
          get: function() { return 1080; },
          configurable: true
        });
        
        Object.defineProperty(window.screen, 'availHeight', {
          get: function() { return 1920; },
          configurable: true
        });
      } catch (e) {
        console.warn('Could not override window dimensions:', e);
      }
    }
    
    // Log info for debugging
    console.log('OBS Mobile Live: Forced viewport to 1080x1920');
    console.log('Document size:', document.documentElement.clientWidth, 'x', document.documentElement.clientHeight);
    console.log('Body size:', document.body.clientWidth, 'x', document.body.clientHeight);
    console.log('Window size:', window.innerWidth, 'x', window.innerHeight);
  }
  
  // Apply immediately
  forceViewportSize();
  
  // Apply on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', forceViewportSize);
  } else {
    forceViewportSize();
  }
  
  // Apply on load
  window.addEventListener('load', forceViewportSize);
  
  // Prevent resize events
  window.addEventListener('resize', function(e) {
    e.stopPropagation();
    e.preventDefault();
    forceViewportSize();
  }, true);
  
  // Reapply periodically for stubborn browsers
  setInterval(function() {
    if (document.body && (document.body.clientWidth !== 1080 || document.body.clientHeight !== 1920)) {
      forceViewportSize();
    }
  }, 1000);
  
  // Detect OBS Browser Source
  const isOBS = typeof window !== 'undefined' && window.obsstudio !== undefined;
  if (isOBS) {
    console.log('OBS Browser Source detected!');
    // Force window size for OBS
    if (window.resizeTo) {
      window.resizeTo(1080, 1920);
    }
  }
})();
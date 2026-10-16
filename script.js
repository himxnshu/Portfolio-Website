(() => {
  'use strict';

  // =========================================================================
  // 1. Photo Scroll Animation Configuration (240-Frame Canvas Sequence)
  // =========================================================================
  const TOTAL_FRAMES = 240;
  const FRAME_PREFIX = 'Frames/frame_';
  const FRAME_EXTENSION = '.png';
  const LERP_FACTOR = 0.095; // Fluid lerp factor for smooth cinematic scrub

  // DOM Elements
  const canvas = document.getElementById('animation-canvas');
  let ctx = null;
  if (canvas) {
    ctx = canvas.getContext('2d', { alpha: false });
    if (ctx) {
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
    }
  }

  const loader = document.getElementById('loader');
  const progressFill = document.getElementById('progress-fill');
  const progressText = document.getElementById('progress-text');
  const globalNavbar = document.getElementById('global-navbar');

  // Menu Drawer Elements
  const menuToggle = document.getElementById('menu-toggle');
  const drawerCloseBtn = document.getElementById('drawer-close-btn');
  const menuDrawerLayer = document.getElementById('menu-drawer-layer');
  const drawerBackdrop = document.getElementById('drawer-backdrop');
  const drawerLinks = document.querySelectorAll('.d-link');

  // Photo Animation State
  const images = new Array(TOTAL_FRAMES);
  let loadedCount = 0;
  let currentFrame = 0;
  let targetFrame = 0;
  let lastRenderedFrame = -1;
  let isInitialFrameRendered = false;
  let isPageUnlocked = false;

  function getFramePath(index) {
    const padded = String(index + 1).padStart(4, '0');
    return `${FRAME_PREFIX}${padded}${FRAME_EXTENSION}`;
  }

  // Find nearest loaded frame to ensure 100% fluid scrub with zero blank flicker
  function getNearestLoadedFrame(targetIdx) {
    if (images[targetIdx] && images[targetIdx].isReady) {
      return images[targetIdx];
    }
    let closest = null;
    let minDistance = Infinity;
    for (let i = 0; i < TOTAL_FRAMES; i++) {
      if (images[i] && images[i].isReady) {
        const dist = Math.abs(i - targetIdx);
        if (dist < minDistance) {
          minDistance = dist;
          closest = images[i];
        }
      }
    }
    return closest;
  }

  // Draw image on canvas preserving cover aspect ratio with high sharpness
  function renderFrame(frameIndex) {
    if (!canvas || !ctx) return;
    const boundedIndex = Math.max(0, Math.min(TOTAL_FRAMES - 1, frameIndex));
    const img = getNearestLoadedFrame(boundedIndex);
    if (!img) return;

    const canvasW = canvas.width;
    const canvasH = canvas.height;
    const imgW = img.naturalWidth || 1920;
    const imgH = img.naturalHeight || 1080;

    // Cover math
    const scale = Math.max(canvasW / imgW, canvasH / imgH);
    const drawW = imgW * scale;
    const drawH = imgH * scale;

    const drawX = (canvasW - drawW) / 2;
    const drawY = (canvasH - drawH) / 2;

    ctx.drawImage(img, 0, 0, imgW, imgH, drawX, drawY, drawW, drawH);
    lastRenderedFrame = boundedIndex;
  }

  // Canvas resize with device pixel ratio scaling (optimized for mobile & desktop)
  function handleResize() {
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, window.innerWidth < 768 ? 1.5 : 2);
    const displayW = window.innerWidth;
    const displayH = window.innerHeight;

    const pixelW = Math.round(displayW * dpr);
    const pixelH = Math.round(displayH * dpr);

    if (canvas.width !== pixelW || canvas.height !== pixelH) {
      canvas.width = pixelW;
      canvas.height = pixelH;
    }

    if (isInitialFrameRendered) {
      renderFrame(Math.round(currentFrame));
    }
  }

  // Update target frame and navbar state based on window scroll
  function updateScroll() {
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    if (maxScroll > 0) {
      const scrollY = Math.max(0, Math.min(maxScroll, window.scrollY || window.pageYOffset));
      const progress = scrollY / maxScroll;
      targetFrame = progress * (TOTAL_FRAMES - 1);
      fetchNearbyFrames(targetFrame);
    }

    if (globalNavbar) {
      if (window.scrollY > 40) {
        globalNavbar.classList.add('scrolled');
      } else {
        globalNavbar.classList.remove('scrolled');
      }
    }
  }

  // Smooth Lerp Photo Animation Loop (Runs at native 60/120fps)
  function animationLoop() {
    const diff = targetFrame - currentFrame;
    if (Math.abs(diff) > 0.0005) {
      currentFrame += diff * LERP_FACTOR;
    } else {
      currentFrame = targetFrame;
    }

    const frameToRender = Math.round(currentFrame);
    if (frameToRender !== lastRenderedFrame) {
      renderFrame(frameToRender);
    }

    requestAnimationFrame(animationLoop);
  }

  // Dismiss loader cleanly and eliminate it from the DOM layout tree
  function unlockPage() {
    if (isPageUnlocked) return;
    isPageUnlocked = true;
    if (progressFill) progressFill.style.width = '100%';
    if (progressText) progressText.textContent = '100%';
    setTimeout(() => {
      if (loader) {
        loader.classList.add('loaded');
        setTimeout(() => {
          loader.style.display = 'none';
        }, 650);
      }
    }, 120);
  }

  // Snappy startup loader: smooth 250ms progress animation so user is never staring at a frozen 0% screen
  function startLoaderAnimation() {
    const startTime = performance.now();
    const duration = 260; // 260ms smooth progress

    function tick(now) {
      const elapsed = now - startTime;
      const progress = Math.min(100, Math.round((elapsed / duration) * 100));

      if (progressFill) progressFill.style.width = `${progress}%`;
      if (progressText) progressText.textContent = `${progress}%`;

      if (progress < 100 && !isPageUnlocked) {
        requestAnimationFrame(tick);
      } else {
        unlockPage();
      }
    }

    requestAnimationFrame(tick);
  }

  // Track state of frames (0 = unrequested, 1 = pending, 2 = loaded)
  const frameLoadStatus = new Uint8Array(TOTAL_FRAMES);

  function requestFrame(index) {
    const idx = Math.max(0, Math.min(TOTAL_FRAMES - 1, index));
    if (frameLoadStatus[idx] !== 0) return;
    frameLoadStatus[idx] = 1;

    const img = new Image();
    img.onload = () => {
      img.isReady = true;
      images[idx] = img;
      frameLoadStatus[idx] = 2;
      loadedCount++;
      if (idx === 0 && !isInitialFrameRendered) {
        isInitialFrameRendered = true;
        renderFrame(0);
      }
    };
    img.onerror = () => {
      frameLoadStatus[idx] = 0; // Allow retry on failure
    };
    img.src = getFramePath(idx);
  }

  // On-demand fetch around user's active scrub position
  function fetchNearbyFrames(targetIdx) {
    const center = Math.round(targetIdx);
    for (let offset = -3; offset <= 3; offset++) {
      const idx = center + offset;
      if (idx >= 0 && idx < TOTAL_FRAMES) {
        requestFrame(idx);
      }
    }
  }

  // Preload keyframes progressively so the network queue and browser tab are NEVER overloaded
  function preloadFrames() {
    // 1. Immediately request initial frame 0 for instant visual display
    requestFrame(0);

    // 2. Fetch a compact, spaced set of keyframes (1 every 8 frames = ~30 frames across full scroll)
    // Distributed sequentially during idle so browser tab spinner stops in under 1 second!
    const keyframeIndices = [];
    for (let i = 8; i < TOTAL_FRAMES; i += 8) {
      keyframeIndices.push(i);
    }

    let kIdx = 0;
    function loadNextKeyframe() {
      if (kIdx >= keyframeIndices.length) return;
      requestFrame(keyframeIndices[kIdx]);
      kIdx++;
      if (kIdx < keyframeIndices.length) {
        if ('requestIdleCallback' in window) {
          window.requestIdleCallback(() => setTimeout(loadNextKeyframe, 35), { timeout: 800 });
        } else {
          setTimeout(loadNextKeyframe, 45);
        }
      }
    }

    // Start gentle background prefetch after initial frame load
    setTimeout(loadNextKeyframe, 250);
  }

  // =========================================================================
  // 2. Sideways Projects Carousel Interactions (Guaranteed Never Stop in Between)
  // =========================================================================
  function setupProjectsCarousel() {
    const track = document.getElementById('projects-track');
    const prevBtn = document.getElementById('projects-prev-btn');
    const nextBtn = document.getElementById('projects-next-btn');
    const counter = document.getElementById('projects-counter');

    if (!track) return;
    const cards = Array.from(track.querySelectorAll('.project-carousel-card'));
    const totalCards = cards.length;
    if (totalCards === 0) return;

    let activeIndex = 0;

    // Exact card snapping function — prevents stopping in between cards!
    function goToCard(index, smooth = true) {
      activeIndex = Math.max(0, Math.min(totalCards - 1, index));
      const targetCard = cards[activeIndex];
      if (targetCard) {
        const targetScroll = targetCard.offsetLeft - track.offsetLeft;
        track.scrollTo({
          left: targetScroll,
          behavior: smooth ? 'smooth' : 'auto'
        });
      }
      updateCounterDisplay(activeIndex);
    }

    function updateCounterDisplay(index) {
      if (!counter) return;
      const padCurrent = String(index + 1).padStart(2, '0');
      const padTotal = String(totalCards).padStart(2, '0');
      counter.textContent = `${padCurrent} / ${padTotal}`;

      // Update button visual states
      if (prevBtn) {
        prevBtn.style.opacity = index === 0 ? '0.45' : '1';
        prevBtn.style.pointerEvents = index === 0 ? 'none' : 'auto';
      }
      if (nextBtn) {
        nextBtn.style.opacity = index === totalCards - 1 ? '0.45' : '1';
        nextBtn.style.pointerEvents = index === totalCards - 1 ? 'none' : 'auto';
      }
    }

    // Previous & Next Arrow Clicks
    if (prevBtn) {
      prevBtn.addEventListener('click', (e) => {
        e.preventDefault();
        goToCard(activeIndex - 1);
      });
    }

    if (nextBtn) {
      nextBtn.addEventListener('click', (e) => {
        e.preventDefault();
        goToCard(activeIndex + 1);
      });
    }

    // Scroll listener to sync active index and counter
    let scrollTimeout = null;
    track.addEventListener('scroll', () => {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        const currentScroll = track.scrollLeft;
        let closestIndex = 0;
        let minDiff = Infinity;

        cards.forEach((card, idx) => {
          const cardLeft = card.offsetLeft - track.offsetLeft;
          const diff = Math.abs(cardLeft - currentScroll);
          if (diff < minDiff) {
            minDiff = diff;
            closestIndex = idx;
          }
        });

        activeIndex = closestIndex;
        updateCounterDisplay(activeIndex);
      }, 60);
    }, { passive: true });

    // Passive scroll listener to update active index and counter smoothly
    // Vertical scrolling passes through 100% naturally without getting blocked!

    // Horizontal wheel / trackpad swipe handling:
    // Only intercepts when user is intentionally scrolling horizontally (Shift + Wheel or trackpad deltaX)
    // NEVER blocks normal vertical scrolling so the page NEVER gets stuck!
    track.addEventListener('wheel', (e) => {
      if (e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        // Natural horizontal swipe
        track.scrollLeft += e.deltaX || e.deltaY;
      }
    }, { passive: true });

    // Initialize with first card
    updateCounterDisplay(0);
  }

  // =========================================================================
  // 3. Setup General UI Interactions & Navigation
  // =========================================================================
  function setupInteractions() {
    // Smooth scrolling for all internal anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
      anchor.addEventListener('click', function (e) {
        const targetId = this.getAttribute('href');
        if (targetId === '#' || !targetId) return;
        const targetElem = document.querySelector(targetId);
        if (targetElem) {
          e.preventDefault();
          targetElem.scrollIntoView({ behavior: 'smooth' });
          closeDrawer();
        }
      });
    });

    // Drawer Controls
    function openDrawer() {
      if (menuDrawerLayer) menuDrawerLayer.classList.add('active');
      document.body.style.overflow = 'hidden';
    }

    function closeDrawer() {
      if (menuDrawerLayer) menuDrawerLayer.classList.remove('active');
      document.body.style.overflow = '';
    }

    if (menuToggle) menuToggle.addEventListener('click', openDrawer);
    if (drawerCloseBtn) drawerCloseBtn.addEventListener('click', closeDrawer);
    if (drawerBackdrop) drawerBackdrop.addEventListener('click', closeDrawer);

    drawerLinks.forEach(link => {
      link.addEventListener('click', closeDrawer);
    });

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && menuDrawerLayer && menuDrawerLayer.classList.contains('active')) {
        closeDrawer();
      }
    });

    // Active scroll listener (desktop, wheel, and mobile touch)
    window.addEventListener('scroll', updateScroll, { passive: true });
    window.addEventListener('wheel', updateScroll, { passive: true });
    window.addEventListener('touchmove', updateScroll, { passive: true });

    // Setup projects sideways carousel
    setupProjectsCarousel();
  }

  // =========================================================================
  // 4. Initialize Application
  // =========================================================================
  function init() {
    handleResize();
    window.addEventListener('resize', handleResize, { passive: true });

    startLoaderAnimation();
    preloadFrames();
    setupInteractions();
    animationLoop();

    // Absolute failsafe: guarantees page is unlocked in <= 400ms under any condition
    setTimeout(() => {
      if (!isPageUnlocked) unlockPage();
    }, 400);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

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

  // Canvas resize with device pixel ratio scaling
  function handleResize() {
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
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

  // Dismiss loader cleanly
  function unlockPage() {
    if (isPageUnlocked) return;
    isPageUnlocked = true;
    if (progressFill) progressFill.style.width = '100%';
    if (progressText) progressText.textContent = '100%';
    setTimeout(() => {
      if (loader) loader.classList.add('loaded');
    }, 180);
  }

  // Preload frames progressively so initial view loads immediately without freezing
  function preloadFrames() {
    // 1. High priority: Load frame 0 immediately and display it
    const firstImg = new Image();
    firstImg.onload = () => {
      firstImg.isReady = true;
      images[0] = firstImg;
      loadedCount++;
      renderFrame(0);
      isInitialFrameRendered = true;
      unlockPage(); // Instantly show page once first frame is ready!
    };
    firstImg.onerror = () => {
      unlockPage();
    };
    firstImg.src = getFramePath(0);

    // Fallback timer ensures page is unlocked within 400ms max
    setTimeout(() => unlockPage(), 400);

    // 2. Load keyframes first (every 4th frame) to give instant responsive scrub across entire scroll
    const keyframeIndices = [];
    for (let i = 4; i < TOTAL_FRAMES; i += 4) {
      keyframeIndices.push(i);
    }
    // Then fill in the rest
    for (let i = 1; i < TOTAL_FRAMES; i++) {
      if (i % 4 !== 0) keyframeIndices.push(i);
    }

    // Load sequentially in small batches to preserve network and CPU
    let batchIndex = 0;
    const BATCH_SIZE = 6;

    function loadNextBatch() {
      if (batchIndex >= keyframeIndices.length) return;
      const end = Math.min(batchIndex + BATCH_SIZE, keyframeIndices.length);

      for (let k = batchIndex; k < end; k++) {
        const frameIdx = keyframeIndices[k];
        const img = new Image();
        img.onload = () => {
          img.isReady = true;
          images[frameIdx] = img;
          loadedCount++;
        };
        img.onerror = () => {
          loadedCount++;
        };
        img.src = getFramePath(frameIdx);
      }

      batchIndex = end;
      if (batchIndex < keyframeIndices.length) {
        setTimeout(loadNextBatch, 25);
      }
    }

    // Start background loading
    setTimeout(loadNextBatch, 50);
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

    // Active scroll listener
    window.addEventListener('scroll', updateScroll, { passive: true });
    window.addEventListener('wheel', updateScroll, { passive: true });

    // Setup projects sideways carousel
    setupProjectsCarousel();
  }

  // =========================================================================
  // 4. Initialize Application
  // =========================================================================
  function init() {
    handleResize();
    window.addEventListener('resize', handleResize, { passive: true });

    preloadFrames();
    setupInteractions();
    animationLoop();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

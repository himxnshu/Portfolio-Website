(() => {
  'use strict';

  // Configuration
  const TOTAL_FRAMES = 240;
  const FRAME_PREFIX = 'Frames/frame_';
  const FRAME_EXTENSION = '.png';
  const LERP_FACTOR = 0.095; // Fluid lerp factor

  // DOM Elements
  const canvas = document.getElementById('animation-canvas');
  const ctx = canvas.getContext('2d', { alpha: false });
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  const loader = document.getElementById('loader');
  const progressFill = document.getElementById('progress-fill');
  const progressText = document.getElementById('progress-text');
  const scrubIndicator = document.getElementById('scrub-frame-indicator');
  const globalNavbar = document.getElementById('global-navbar');

  // Menu Drawer Elements
  const menuToggle = document.getElementById('menu-toggle');
  const drawerCloseBtn = document.getElementById('drawer-close-btn');
  const menuDrawerLayer = document.getElementById('menu-drawer-layer');
  const drawerBackdrop = document.getElementById('drawer-backdrop');
  const drawerLinks = document.querySelectorAll('.d-link');

  // State
  const images = new Array(TOTAL_FRAMES);
  let loadedCount = 0;
  let currentFrame = 0;
  let targetFrame = 0;
  let lastRenderedFrame = -1;
  let isInitialFrameRendered = false;
  let animationFrameId = null;

  // Format frame filename with 4-digit zero-padding
  function getFramePath(index) {
    const padded = String(index + 1).padStart(4, '0');
    return `${FRAME_PREFIX}${padded}${FRAME_EXTENSION}`;
  }

  // Find nearest loaded frame to prevent blank flicker
  function getNearestLoadedFrame(targetIdx) {
    if (images[targetIdx] && images[targetIdx].isReady) {
      return images[targetIdx];
    }

    let minDistance = Infinity;
    let closest = null;

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

  // Draw image on canvas preserving cover aspect ratio
  function renderFrame(frameIndex) {
    const boundedIndex = Math.max(0, Math.min(TOTAL_FRAMES - 1, frameIndex));
    const img = getNearestLoadedFrame(boundedIndex);
    if (!img) return;

    const canvasW = canvas.width;
    const canvasH = canvas.height;
    const imgW = img.naturalWidth || 1920;
    const imgH = img.naturalHeight || 1080;

    // Cover math: scale up to fully cover canvas while keeping aspect ratio
    const scale = Math.max(canvasW / imgW, canvasH / imgH);
    const drawW = imgW * scale;
    const drawH = imgH * scale;

    // Centered composition
    const drawX = (canvasW - drawW) / 2;
    const drawY = (canvasH - drawH) / 2;

    ctx.drawImage(img, 0, 0, imgW, imgH, drawX, drawY, drawW, drawH);
    lastRenderedFrame = boundedIndex;
  }

  // Canvas resize with device pixel ratio scaling for crisp rendering
  function handleResize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const displayW = window.innerWidth;
    const displayH = window.innerHeight;

    const pixelW = Math.round(displayW * dpr);
    const pixelH = Math.round(displayH * dpr);

    if (canvas.width !== pixelW || canvas.height !== pixelH) {
      canvas.width = pixelW;
      canvas.height = pixelH;
    }

    // Force re-render of current frame
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

    // Navbar background blur toggle on scroll
    if (globalNavbar) {
      if (window.scrollY > 40) {
        globalNavbar.classList.add('scrolled');
      } else {
        globalNavbar.classList.remove('scrolled');
      }
    }
  }

  // Main animation render loop using lerp (Linear Interpolation)
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

      // Update frame indicator pill
      if (scrubIndicator) {
        const paddedFrame = String(frameToRender + 1).padStart(3, '0');
        scrubIndicator.textContent = `${paddedFrame} / ${TOTAL_FRAMES}`;
      }
    }

    animationFrameId = requestAnimationFrame(animationLoop);
  }

  // Update loader UI and check if preloading is complete
  function onFrameLoad(index, img) {
    img.isReady = true;
    loadedCount++;

    const percent = Math.floor((loadedCount / TOTAL_FRAMES) * 100);
    if (progressFill) progressFill.style.width = `${percent}%`;
    if (progressText) progressText.textContent = `${percent}%`;

    // Render frame 0 immediately when loaded so user never sees a black box
    if (!isInitialFrameRendered && (index === 0 || loadedCount >= 1)) {
      renderFrame(0);
      isInitialFrameRendered = true;
    }

    // Dismiss loader once all frames are loaded
    if (loadedCount >= TOTAL_FRAMES) {
      setTimeout(() => {
        if (loader) loader.classList.add('loaded');
      }, 250);
    }
  }

  // Preload all frames concurrently with error resilience
  function preloadFrames() {
    // 1. High priority: Load first frame immediately
    const firstImg = new Image();
    images[0] = firstImg;
    firstImg.onload = () => onFrameLoad(0, firstImg);
    firstImg.onerror = () => onFrameLoad(0, firstImg);
    firstImg.src = getFramePath(0);

    // 2. Load the rest of the frames
    for (let i = 1; i < TOTAL_FRAMES; i++) {
      const img = new Image();
      images[i] = img;
      img.onload = () => onFrameLoad(i, img);
      img.onerror = () => onFrameLoad(i, img);
      img.src = getFramePath(i);
    }
  }

  // Setup UI Interactions
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

    // Active wheel listener to ensure smooth laptop touchpad scrolling
    window.addEventListener('wheel', updateScroll, { passive: true });

    // =========================================================================
    // Sideways Projects Carousel Interactions
    // =========================================================================
    const projectsTrack = document.getElementById('projects-track');
    const projectsPrevBtn = document.getElementById('projects-prev-btn');
    const projectsNextBtn = document.getElementById('projects-next-btn');
    const projectsCounter = document.getElementById('projects-counter');

    if (projectsTrack) {
      const cards = projectsTrack.querySelectorAll('.project-carousel-card');
      const totalCards = cards.length;

      function updateCounter() {
        if (!projectsCounter || totalCards === 0) return;
        const scrollLeft = projectsTrack.scrollLeft;
        const cardWidth = cards[0] ? cards[0].offsetWidth + 28 : 568;
        const currentIndex = Math.min(totalCards - 1, Math.max(0, Math.round(scrollLeft / cardWidth)));
        const padCurrent = String(currentIndex + 1).padStart(2, '0');
        const padTotal = String(totalCards).padStart(2, '0');
        projectsCounter.textContent = `${padCurrent} / ${padTotal}`;
      }

      function scrollTrack(direction) {
        const firstCard = cards[0];
        const step = firstCard ? (firstCard.offsetWidth + 28) : 568;
        projectsTrack.scrollBy({
          left: direction === 'next' ? step : -step,
          behavior: 'smooth'
        });
      }

      if (projectsPrevBtn) {
        projectsPrevBtn.addEventListener('click', () => scrollTrack('prev'));
      }

      if (projectsNextBtn) {
        projectsNextBtn.addEventListener('click', () => scrollTrack('next'));
      }

      projectsTrack.addEventListener('scroll', updateCounter, { passive: true });

      // Horizontal Wheel translation when hovering carousel
      projectsTrack.addEventListener('wheel', (e) => {
        if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
          const maxScroll = projectsTrack.scrollWidth - projectsTrack.clientWidth;
          if ((e.deltaY > 0 && projectsTrack.scrollLeft < maxScroll - 2) ||
              (e.deltaY < 0 && projectsTrack.scrollLeft > 2)) {
            e.preventDefault();
            projectsTrack.scrollLeft += e.deltaY * 0.9;
          }
        }
      }, { passive: false });

      // Mouse Drag-to-Scroll UX
      let isDown = false;
      let startX = 0;
      let scrollLeftPos = 0;

      projectsTrack.addEventListener('mousedown', (e) => {
        if (e.target.closest('a') || e.target.closest('button')) return;
        isDown = true;
        projectsTrack.classList.add('grabbing');
        startX = e.pageX - projectsTrack.offsetLeft;
        scrollLeftPos = projectsTrack.scrollLeft;
      });

      window.addEventListener('mouseup', () => {
        if (isDown) {
          isDown = false;
          projectsTrack.classList.remove('grabbing');
        }
      });

      projectsTrack.addEventListener('mouseleave', () => {
        if (isDown) {
          isDown = false;
          projectsTrack.classList.remove('grabbing');
        }
      });

      projectsTrack.addEventListener('mousemove', (e) => {
        if (!isDown) return;
        e.preventDefault();
        const x = e.pageX - projectsTrack.offsetLeft;
        const walk = (x - startX) * 1.5;
        projectsTrack.scrollLeft = scrollLeftPos - walk;
      });

      updateCounter();
    }
  }

  // Initialize
  function init() {
    handleResize();
    window.addEventListener('resize', handleResize, { passive: true });
    window.addEventListener('scroll', updateScroll, { passive: true });

    setupInteractions();
    preloadFrames();
    animationLoop();
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

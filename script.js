(() => {
  'use strict';

  // DOM Elements
  const canvas = document.getElementById('animation-canvas');
  let ctx = null;
  if (canvas) {
    ctx = canvas.getContext('2d');
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

  // =========================================================================
  // 1. Snappy Zero-Lag Preloader (Smooth 300ms Startup)
  // =========================================================================
  function runSnappyLoader() {
    let progress = 0;
    const startTime = performance.now();
    const duration = 280; // 280ms total snappy intro

    function step(currentTime) {
      const elapsed = currentTime - startTime;
      progress = Math.min(100, Math.round((elapsed / duration) * 100));

      if (progressFill) progressFill.style.width = `${progress}%`;
      if (progressText) progressText.textContent = `${progress}%`;

      if (progress < 100) {
        requestAnimationFrame(step);
      } else {
        setTimeout(() => {
          if (loader) loader.classList.add('loaded');
        }, 120);
      }
    }

    requestAnimationFrame(step);
  }

  // =========================================================================
  // 2. High-Performance Hardware-Accelerated Ambient Canvas
  // =========================================================================
  let particles = [];
  let mouse = { x: null, y: null, targetX: null, targetY: null };
  let scrollProgress = 0;
  let animId = null;

  class AmbientParticle {
    constructor(w, h) {
      this.reset(w, h);
    }

    reset(w, h) {
      this.x = Math.random() * w;
      this.y = Math.random() * h;
      this.baseRadius = Math.random() * 2 + 0.8;
      this.radius = this.baseRadius;
      this.vx = (Math.random() - 0.5) * 0.45;
      this.vy = (Math.random() - 0.5) * 0.45;
      this.alpha = Math.random() * 0.45 + 0.15;
      // Signature accents: Vibrant Orange, Warm Amber, Cyan AI glow
      const colors = ['255, 87, 34', '255, 171, 0', '0, 210, 255', '255, 255, 255'];
      this.color = colors[Math.floor(Math.random() * colors.length)];
      this.pulseSpeed = Math.random() * 0.02 + 0.008;
      this.pulseVal = Math.random() * Math.PI;
    }

    update(w, h, scrollDelta) {
      this.x += this.vx;
      this.y += this.vy + scrollDelta * 0.4;

      this.pulseVal += this.pulseSpeed;
      this.radius = this.baseRadius + Math.sin(this.pulseVal) * 0.6;

      // Mouse subtle repulsion
      if (mouse.x !== null && mouse.y !== null) {
        const dx = mouse.x - this.x;
        const dy = mouse.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 120) {
          const force = (120 - dist) / 120;
          this.x -= (dx / dist) * force * 1.5;
          this.y -= (dy / dist) * force * 1.5;
        }
      }

      // Wrap edges
      if (this.x < 0) this.x = w;
      if (this.x > w) this.x = 0;
      if (this.y < 0) this.y = h;
      if (this.y > h) this.y = 0;
    }

    draw(ctx) {
      ctx.beginPath();
      ctx.arc(this.x, this.y, Math.max(0.2, this.radius), 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${this.color}, ${this.alpha})`;
      ctx.shadowColor = `rgba(${this.color}, 0.5)`;
      ctx.shadowBlur = 8;
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  }

  function initAmbientCanvas() {
    if (!canvas || !ctx) return;

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.scale(dpr, dpr);

      // Populate particles
      const count = window.innerWidth < 768 ? 28 : 55;
      particles = [];
      for (let i = 0; i < count; i++) {
        particles.push(new AmbientParticle(window.innerWidth, window.innerHeight));
      }
    }

    resize();
    window.addEventListener('resize', resize, { passive: true });

    window.addEventListener('mousemove', (e) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    }, { passive: true });

    window.addEventListener('mouseleave', () => {
      mouse.x = null;
      mouse.y = null;
    });

    let lastScrollY = window.scrollY || 0;
    let scrollDelta = 0;

    function renderLoop() {
      const currentScrollY = window.scrollY || 0;
      scrollDelta = (currentScrollY - lastScrollY) * 0.15;
      lastScrollY = currentScrollY;

      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

      const w = window.innerWidth;
      const h = window.innerHeight;

      // Draw faint interconnecting constellation lines
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 110) {
            const lineAlpha = (1 - dist / 110) * 0.12;
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(255, 87, 34, ${lineAlpha})`;
            ctx.lineWidth = 0.75;
            ctx.stroke();
          }
        }
      }

      // Draw particles
      for (let i = 0; i < particles.length; i++) {
        particles[i].update(w, h, scrollDelta);
        particles[i].draw(ctx);
      }

      animId = requestAnimationFrame(renderLoop);
    }

    renderLoop();
  }

  // =========================================================================
  // 3. Scroll & Navbar States
  // =========================================================================
  function updateScroll() {
    if (globalNavbar) {
      if (window.scrollY > 40) {
        globalNavbar.classList.add('scrolled');
      } else {
        globalNavbar.classList.remove('scrolled');
      }
    }
  }

  // =========================================================================
  // 4. Setup UI Interactions
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

    // =========================================================================
    // 5. Sideways Projects Carousel Interactions
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

  // =========================================================================
  // 6. Application Initialization
  // =========================================================================
  function init() {
    runSnappyLoader();
    initAmbientCanvas();
    setupInteractions();
    updateScroll();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

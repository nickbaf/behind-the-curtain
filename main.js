/* ════════════════════════════════════════════════════════════════
   BEHIND THE CURTAIN — main.js
   ════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  /* ── Element refs ─────────────────────────────────────────────── */
  const curtainLeft  = document.getElementById('curtainLeft');
  const curtainRight = document.getElementById('curtainRight');
  const curtainWrap  = document.getElementById('curtainWrap');
  const hint         = document.getElementById('hint');
  const invite       = document.getElementById('invite');
  const ringsContainer = document.querySelector('.curtain-rod__rings');

  /* ── State ────────────────────────────────────────────────────── */
  let isOpen        = false;
  let hintTimer     = null;
  const HINT_DELAY  = 5000; // ms before hint appears

  /* ════════════════════════════════════════════════════════════════
     SETUP
     ════════════════════════════════════════════════════════════════ */

  function init() {
    buildRings();
    buildParticles();
    startIdleSway();
    scheduleHint();
    bindEvents();
  }

  /* ── Inject curtain rod rings ─────────────────────────────────── */
  function buildRings() {
    const count = Math.floor(window.innerWidth / 55);
    for (let i = 0; i < count; i++) {
      const ring = document.createElement('div');
      ring.className = 'curtain-rod__ring';
      ringsContainer.appendChild(ring);
    }
  }

  /* ── Spawn floating gold particles ───────────────────────────── */
  function buildParticles() {
    const container = document.getElementById('particles');
    const count = 28;

    for (let i = 0; i < count; i++) {
      const p = document.createElement('div');
      p.className = 'particle';

      const size  = Math.random() * 3 + 1;
      const left  = Math.random() * 100;
      const dur   = Math.random() * 8 + 5;
      const delay = Math.random() * 10;
      const drift = (Math.random() - 0.5) * 120;

      p.style.cssText = `
        width: ${size}px;
        height: ${size}px;
        left: ${left}%;
        --dur: ${dur}s;
        --delay: ${delay}s;
        --drift: ${drift}px;
      `;
      container.appendChild(p);
    }
  }

  /* ── Subtle curtain sway while idle ──────────────────────────── */
  function startIdleSway() {
    curtainLeft.classList.add('is-swaying');
    curtainRight.classList.add('is-swaying');
  }

  function stopIdleSway() {
    curtainLeft.classList.remove('is-swaying');
    curtainRight.classList.remove('is-swaying');
  }

  /* ════════════════════════════════════════════════════════════════
     HINT SYSTEM
     ════════════════════════════════════════════════════════════════ */

  function scheduleHint() {
    hintTimer = setTimeout(showHint, HINT_DELAY);
  }

  function showHint() {
    hint.setAttribute('aria-hidden', 'false');
    gsap.to(hint, {
      opacity: 1,
      duration: 0.8,
      ease: 'power2.out',
    });
  }

  function hideHint() {
    clearTimeout(hintTimer);
    gsap.to(hint, {
      opacity: 0,
      duration: 0.3,
      ease: 'power2.in',
      onComplete: () => hint.setAttribute('aria-hidden', 'true'),
    });
  }

  /* ════════════════════════════════════════════════════════════════
     CURTAIN OPEN SEQUENCE
     ════════════════════════════════════════════════════════════════ */

  function openCurtain() {
    if (isOpen) return;
    isOpen = true;

    hideHint();
    stopIdleSway();

    /* Disable pointer events immediately so double-clicks are safe */
    curtainLeft.style.pointerEvents  = 'none';
    curtainRight.style.pointerEvents = 'none';

    const tl = gsap.timeline({ defaults: { ease: 'power3.inOut' } });

    /* 1. Brief pause + slight inward gather before the big pull */
    tl.to([curtainLeft, curtainRight], {
      scaleX: 1.04,
      duration: 0.25,
      ease: 'power1.in',
    });

    /* 2. Main curtain slide — left goes left, right goes right */
    tl.to(curtainLeft, {
      x: '-105%',
      duration: 1.6,
      ease: 'power3.inOut',
    }, '<0.1');

    tl.to(curtainRight, {
      x: '105%',
      duration: 1.6,
      ease: 'power3.inOut',
    }, '<');

    /* 3. Rod follows a tiny arc (stays behind, droops slightly) */
    tl.to('.curtain-rod', {
      y: 6,
      duration: 1.6,
      ease: 'power3.inOut',
    }, '<');

    /* 4. Hide wrap so it can't block clicks on invite */
    tl.set(curtainWrap, { pointerEvents: 'none' });

    /* 5. Reveal the invite — stagger each child in */
    tl.add(revealInvite, '-=0.4');
  }

  /* ── Invite entrance ──────────────────────────────────────────── */
  function revealInvite() {
    const children = Array.from(invite.querySelector('.invite__inner').children);

    /* Spotlights brighten */
    gsap.to('.spotlight', {
      opacity: 1,
      duration: 1.2,
      stagger: 0.2,
      ease: 'power2.out',
    });

    /* Particles become visible */
    gsap.to('.particle', {
      opacity: 1,
      duration: 0.01,
    });

    /* Each invite element fades + slides up */
    gsap.to(children, {
      opacity: 1,
      y: 0,
      duration: 0.7,
      stagger: 0.12,
      ease: 'power3.out',
      delay: 0.1,
    });
  }

  /* ════════════════════════════════════════════════════════════════
     EVENT BINDING
     ════════════════════════════════════════════════════════════════ */

  function bindEvents() {
    /* Click on either panel */
    curtainLeft.addEventListener('click',  openCurtain);
    curtainRight.addEventListener('click', openCurtain);

    /* Keyboard accessibility */
    curtainLeft.addEventListener('keydown',  (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openCurtain(); }
    });
    curtainRight.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openCurtain(); }
    });

    /* Any user interaction resets the hint timer */
    ['mousemove', 'touchstart', 'keydown'].forEach((evt) => {
      document.addEventListener(evt, onUserActivity, { once: true });
    });
  }

  function onUserActivity() {
    if (isOpen) return;
    /* Reset hint timer on first real interaction */
    clearTimeout(hintTimer);
    hintTimer = setTimeout(showHint, HINT_DELAY);
  }

  /* ── Kick everything off ─────────────────────────────────────── */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();

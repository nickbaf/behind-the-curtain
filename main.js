/* ════════════════════════════════════════════════════════════════
   BEHIND THE CURTAIN — main.js

   Curtain state per panel: 0 = closed | 1 = peeked | 2 = open

   Click left  side → advance left curtain
   Click right side → advance right curtain
   Click center     → randomly advance left or right
   ════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  /* ── Refs ─────────────────────────────────────────────────────── */
  const curtainLeft    = document.getElementById('curtainLeft');
  const curtainRight   = document.getElementById('curtainRight');
  const curtainWrap    = document.getElementById('curtainWrap');
  const hint           = document.getElementById('hint');
  const hintText       = document.getElementById('hintText');
  const invite         = document.getElementById('invite');
  const ringsContainer = document.querySelector('.curtain-rod__rings');

  /* ── State ────────────────────────────────────────────────────── */
  const state = { left: 0, right: 0 };   // 0=closed | 1=peek | 2=open
  const busy  = { left: false, right: false };

  let hintTimer    = null;
  const HINT_DELAY = 5000;

  // centre band (% of viewport width) that triggers random side
  const CENTER_BAND = 0.12;

  /* ════════════════════════════════════════════════════════════════
     INIT
     ════════════════════════════════════════════════════════════════ */
  function init() {
    buildRings();
    buildParticles();
    curtainLeft.classList.add('is-swaying');
    curtainRight.classList.add('is-swaying');
    scheduleHint();
    bindEvents();
  }

  /* ── Rod rings ────────────────────────────────────────────────── */
  function buildRings() {
    const count = Math.floor(window.innerWidth / 50);
    for (let i = 0; i < count; i++) {
      const ring = document.createElement('div');
      ring.className = 'curtain-rod__ring';
      ringsContainer.appendChild(ring);
    }
  }

  /* ── Particles ────────────────────────────────────────────────── */
  function buildParticles() {
    const container = document.getElementById('particles');
    for (let i = 0; i < 30; i++) {
      const p     = document.createElement('div');
      p.className = 'particle';
      const size  = Math.random() * 3 + 1;
      const left  = Math.random() * 100;
      const dur   = Math.random() * 8 + 5;
      const delay = Math.random() * 12;
      const drift = (Math.random() - 0.5) * 120;
      p.style.cssText = `width:${size}px;height:${size}px;left:${left}%;--dur:${dur}s;--delay:${delay}s;--drift:${drift}px;`;
      container.appendChild(p);
    }
  }

  /* ════════════════════════════════════════════════════════════════
     HINT
     ════════════════════════════════════════════════════════════════ */
  function scheduleHint(msg) {
    clearTimeout(hintTimer);
    if (msg) hintText.textContent = msg;
    hintTimer = setTimeout(showHint, HINT_DELAY);
  }

  function showHint() {
    hint.setAttribute('aria-hidden', 'false');
    gsap.to(hint, { opacity: 1, duration: 0.8, ease: 'power2.out' });
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
     CURTAIN ADVANCE
     ════════════════════════════════════════════════════════════════ */

  function advanceLeft() {
    if (busy.left || state.left === 2) return;
    hideHint();
    if (state.left === 0) peekLeft();
    else if (state.left === 1) openLeft();
  }

  function advanceRight() {
    if (busy.right || state.right === 2) return;
    hideHint();
    if (state.right === 0) peekRight();
    else if (state.right === 1) openRight();
  }

  /* ── PEEK LEFT (stage 0 → 1) ──────────────────────────────────── */
  function peekLeft() {
    busy.left = true;
    state.left = 1;
    curtainLeft.classList.remove('is-swaying');

    const folds = curtainLeft.querySelectorAll('.curtain__fold');
    const tl = gsap.timeline({
      onComplete: () => {
        busy.left = false;
        curtainLeft.setAttribute('aria-label', 'Click to fully open');
        scheduleHint('Click left to open fully');
      },
    });

    // 1. Initial resistance — heavy fabric resists before yielding
    tl.to(curtainLeft, { x: 12, duration: 0.3, ease: 'power2.in' });

    // 2. Main pull — slow start, builds momentum
    tl.to(curtainLeft, { 
      x: '-50%', 
      duration: 1.8,
      ease: 'power2.inOut'
    });

    // Wave propagates through folds (tassel edge moves first, anchored edge last)
    tl.to(folds, {
      x: (i, target, targets) => {
        // folds near tassel (right edge) move more
        const ratio = (targets.length - i) / targets.length;
        return -18 * ratio;
      },
      skewX: (i, target, targets) => {
        const ratio = (targets.length - i) / targets.length;
        return -3 * ratio;
      },
      duration: 1.6,
      stagger: { 
        each: 0.1, 
        from: 'end',  // tassel side first
        ease: 'power1.in'
      },
      ease: 'power2.out'
    }, '-=1.7');

    // 3. Settling sway — curtain swings to rest
    tl.to(curtainLeft, {
      x: '-48%',
      skewX: 1.2,
      duration: 0.5,
      ease: 'sine.out'
    });
    tl.to(curtainLeft, {
      x: '-50.5%',
      skewX: -0.4,
      duration: 0.45,
      ease: 'sine.inOut'
    });
    tl.to(curtainLeft, {
      x: '-50%',
      skewX: 0,
      duration: 0.6,
      ease: 'power1.out'
    });

    // Folds settle back to neutral
    tl.to(folds, {
      x: 0,
      skewX: 0,
      duration: 0.9,
      ease: 'power2.out'
    }, '-=1.2');

    // Faint invite reveal
    gsap.to(Array.from(invite.querySelector('.invite__inner').children), {
      opacity: 0.3, y: 0, duration: 0.6, stagger: 0.08, ease: 'power2.out', delay: 0.8,
    });
  }

  /* ── OPEN LEFT (stage 1 → 2) ──────────────────────────────────── */
  function openLeft() {
    busy.left = true;
    state.left = 2;
    curtainLeft.style.pointerEvents = 'none';

    const folds = curtainLeft.querySelectorAll('.curtain__fold');
    const tl = gsap.timeline({ onComplete: () => { busy.left = false; checkBothOpen(); } });

    // 1. Pre-tension — curtain gathers inward before the big pull
    tl.to(curtainLeft, { 
      x: '-48%', 
      skewX: 1.5, 
      duration: 0.4, 
      ease: 'power2.in' 
    });

    // Folds compress toward center (gathering tension)
    tl.to(folds, {
      x: (i) => 8 - i * 1.5,
      skewX: 1.5,
      duration: 0.35,
      ease: 'power1.in'
    }, '-=0.35');

    // 2. Acceleration phase — starts slow, builds to peak speed
    tl.to(curtainLeft, { 
      x: '-75%', 
      skewX: -7,
      duration: 1.0,
      ease: 'power2.in'
    });

    // Wave rips through folds as curtain accelerates
    tl.to(folds, {
      x: (i, target, targets) => {
        const ratio = (targets.length - i) / targets.length;
        return -25 * ratio;
      },
      skewX: (i, target, targets) => {
        const ratio = (targets.length - i) / targets.length;
        return -5 * ratio;
      },
      duration: 1.0,
      stagger: {
        each: 0.08,
        from: 'end',
        ease: 'power1.in'
      },
      ease: 'power2.in'
    }, '-=0.95');

    // 3. Deceleration + exit — fabric bunches as it hits the wall
    tl.to(curtainLeft, { 
      x: '-115%', 
      skewX: 0,
      duration: 0.9,
      ease: 'power3.out'
    });

    // Folds compress + snap back as curtain bunches off-screen
    tl.to(folds, {
      x: (i) => -10 - i * 2,
      skewX: 0,
      duration: 0.8,
      stagger: {
        each: 0.05,
        from: 'end'
      },
      ease: 'power3.out'
    }, '-=0.85');

    // 4. Final wobble — small bounce-back before settling
    tl.to(curtainLeft, {
      x: '-113%',
      duration: 0.35,
      ease: 'back.out(2)'
    });
    tl.to(curtainLeft, {
      x: '-115%',
      duration: 0.4,
      ease: 'power2.inOut'
    });
  }

  /* ── PEEK RIGHT (stage 0 → 1) ─────────────────────────────────── */
  function peekRight() {
    busy.right = true;
    state.right = 1;
    curtainRight.classList.remove('is-swaying');

    const folds = curtainRight.querySelectorAll('.curtain__fold');
    const tl = gsap.timeline({
      onComplete: () => {
        busy.right = false;
        curtainRight.setAttribute('aria-label', 'Click to fully open');
        scheduleHint('Click right to open fully');
      },
    });

    // 1. Initial resistance
    tl.to(curtainRight, { x: -12, duration: 0.3, ease: 'power2.in' });

    // 2. Main pull
    tl.to(curtainRight, { 
      x: '50%', 
      duration: 1.8,
      ease: 'power2.inOut'
    });

    // Wave propagates (tassel on left edge = 'start')
    tl.to(folds, {
      x: (i, target, targets) => {
        const ratio = i / targets.length;  // reversed: first fold moves most
        return 18 * ratio;
      },
      skewX: (i, target, targets) => {
        const ratio = i / targets.length;
        return 3 * ratio;
      },
      duration: 1.6,
      stagger: { 
        each: 0.1, 
        from: 'start',  // tassel side first (left edge for right curtain)
        ease: 'power1.in'
      },
      ease: 'power2.out'
    }, '-=1.7');

    // 3. Settling sway
    tl.to(curtainRight, {
      x: '48%',
      skewX: -1.2,
      duration: 0.5,
      ease: 'sine.out'
    });
    tl.to(curtainRight, {
      x: '50.5%',
      skewX: 0.4,
      duration: 0.45,
      ease: 'sine.inOut'
    });
    tl.to(curtainRight, {
      x: '50%',
      skewX: 0,
      duration: 0.6,
      ease: 'power1.out'
    });

    // Folds settle
    tl.to(folds, {
      x: 0,
      skewX: 0,
      duration: 0.9,
      ease: 'power2.out'
    }, '-=1.2');

    gsap.to(Array.from(invite.querySelector('.invite__inner').children), {
      opacity: 0.3, y: 0, duration: 0.6, stagger: 0.08, ease: 'power2.out', delay: 0.8,
    });
  }

  /* ── OPEN RIGHT (stage 1 → 2) ─────────────────────────────────── */
  function openRight() {
    busy.right = true;
    state.right = 2;
    curtainRight.style.pointerEvents = 'none';

    const folds = curtainRight.querySelectorAll('.curtain__fold');
    const tl = gsap.timeline({ onComplete: () => { busy.right = false; checkBothOpen(); } });

    // 1. Pre-tension
    tl.to(curtainRight, { 
      x: '48%', 
      skewX: -1.5, 
      duration: 0.4, 
      ease: 'power2.in' 
    });

    // Folds compress
    tl.to(folds, {
      x: (i) => -8 + i * 1.5,
      skewX: -1.5,
      duration: 0.35,
      ease: 'power1.in'
    }, '-=0.35');

    // 2. Acceleration phase
    tl.to(curtainRight, { 
      x: '75%', 
      skewX: 7,
      duration: 1.0,
      ease: 'power2.in'
    });

    // Wave through folds
    tl.to(folds, {
      x: (i, target, targets) => {
        const ratio = i / targets.length;
        return 25 * ratio;
      },
      skewX: (i, target, targets) => {
        const ratio = i / targets.length;
        return 5 * ratio;
      },
      duration: 1.0,
      stagger: {
        each: 0.08,
        from: 'start',
        ease: 'power1.in'
      },
      ease: 'power2.in'
    }, '-=0.95');

    // 3. Deceleration + exit
    tl.to(curtainRight, { 
      x: '115%', 
      skewX: 0,
      duration: 0.9,
      ease: 'power3.out'
    });

    // Folds compress + snap
    tl.to(folds, {
      x: (i) => 10 + i * 2,
      skewX: 0,
      duration: 0.8,
      stagger: {
        each: 0.05,
        from: 'start'
      },
      ease: 'power3.out'
    }, '-=0.85');

    // 4. Final wobble
    tl.to(curtainRight, {
      x: '113%',
      duration: 0.35,
      ease: 'back.out(2)'
    });
    tl.to(curtainRight, {
      x: '115%',
      duration: 0.4,
      ease: 'power2.inOut'
    });
  }

  /* ── Check if both fully open ─────────────────────────────────── */
  function checkBothOpen() {
    if (state.left === 2 && state.right === 2) {
      curtainWrap.style.pointerEvents = 'none';
      revealInvite();
    } else {
      // one side still has a curtain — nudge user to open the other
      const msg = state.left < 2 ? 'Now open the left side' : 'Now open the right side';
      scheduleHint(msg);
    }
  }

  /* ── Full invite reveal ───────────────────────────────────────── */
  function revealInvite() {
    const children = Array.from(invite.querySelector('.invite__inner').children);

    gsap.to('.curtain-rod', { y: 8, duration: 1.2, ease: 'power3.out' });

    gsap.to('.spotlight', {
      opacity: 1, duration: 1.4, stagger: 0.2, ease: 'power2.out',
    });

    gsap.to('.particle', { opacity: 1, duration: 0.01 });

    gsap.to(children, {
      opacity: 1, y: 0, duration: 0.75, stagger: 0.13, ease: 'power3.out',
    });
  }

  /* ════════════════════════════════════════════════════════════════
     CLICK ROUTING
     Determine left / right / center based on click x position.
     ════════════════════════════════════════════════════════════════ */
  function routeClick(e) {
    if (state.left === 2 && state.right === 2) return;

    const ratio = e.clientX / window.innerWidth;
    const halfBand = CENTER_BAND / 2;
    const mid      = 0.5;

    if (ratio < mid - halfBand) {
      advanceLeft();
    } else if (ratio > mid + halfBand) {
      advanceRight();
    } else {
      // center band — pick a side that still has curtain to advance
      const canLeft  = state.left  < 2 && !busy.left;
      const canRight = state.right < 2 && !busy.right;

      if (canLeft && canRight) {
        Math.random() < 0.5 ? advanceLeft() : advanceRight();
      } else if (canLeft)  {
        advanceLeft();
      } else if (canRight) {
        advanceRight();
      }
    }
  }

  /* ════════════════════════════════════════════════════════════════
     EVENTS
     ════════════════════════════════════════════════════════════════ */
  function bindEvents() {
    // Route all clicks on the curtain wrap
    curtainWrap.style.pointerEvents = 'auto';
    curtainWrap.addEventListener('click', routeClick);

    // Keyboard: Enter/Space on focused panel
    curtainLeft.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); advanceLeft(); }
    });
    curtainRight.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); advanceRight(); }
    });

    // Reset hint timer on first user activity
    ['mousemove', 'touchstart'].forEach((evt) => {
      document.addEventListener(evt, () => {
        if (state.left === 2 && state.right === 2) return;
        scheduleHint();
      }, { once: true });
    });
  }

  /* ── Boot ─────────────────────────────────────────────────────── */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();

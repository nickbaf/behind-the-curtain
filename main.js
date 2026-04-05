/* ════════════════════════════════════════════════════════════════
   BEHIND THE CURTAIN — main.js
   Three.js cloth simulation with Verlet integration

   Curtain state per panel: 0 = closed | 1 = peeked | 2 = open
   ════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  const { Scene, PerspectiveCamera, WebGLRenderer, PlaneGeometry,
          MeshStandardMaterial, Mesh, DoubleSide, TextureLoader,
          RepeatWrapping, AmbientLight, SpotLight, Vector3,
          Color, SRGBColorSpace, Vector2 } = THREE;

  const curtainWrap  = document.getElementById('curtainWrap');
  const hint         = document.getElementById('hint');
  const hintText     = document.getElementById('hintText');
  const invite       = document.getElementById('invite');
  const ringsEl      = document.querySelector('.curtain-rod__rings');

  let stage = 0;   // 0 = closed, 1 = left peeked, 2 = right peeked, 3 = fully open
  let busy  = false;

  let hintTimer    = null;
  const HINT_DELAY = 5000;

  /* ════════════════════════════════════════════════════════════════
     A. CLOTH PHYSICS — Verlet Integration
     ════════════════════════════════════════════════════════════════ */

  const GRAVITY    = new Vector3(0, -12.0, 0);
  const DAMPING    = 0.985;
  const ITERATIONS = 18;
  const TIMESTEP   = 1 / 60;

  class Particle {
    constructor(x, y, z, mass) {
      this.position  = new Vector3(x, y, z);
      this.previous  = new Vector3(x, y, z);
      this.original  = new Vector3(x, y, z);
      this.mass      = mass;
      this.invMass   = 1 / mass;
      this.pinned    = false;
      this.pinTarget = new Vector3(x, y, z);
    }
  }

  class Cloth {
    constructor(segsW, segsH, width, height, pleatCount, pleatDepth) {
      this.segsW  = segsW;
      this.segsH  = segsH;
      this.width  = width;
      this.height = height;
      this.particles   = [];
      this.constraints = [];

      for (let j = 0; j <= segsH; j++) {
        for (let i = 0; i <= segsW; i++) {
          const u = i / segsW;
          const x = (u - 0.5) * width;
          const y = (1 - j / segsH) * height - height * 0.5;

          const pleatPhase = u * pleatCount * Math.PI * 2;
          const depthFade  = 1 - (j / segsH) * 0.15;
          const z = Math.sin(pleatPhase) * pleatDepth * depthFade;

          const p = new Particle(x, y, z, 1);
          if (j === 0) {
            p.pinned = true;
            p.pinTarget.set(x, y, z);
          }
          this.particles.push(p);
        }
      }

      const idx = (i, j) => j * (segsW + 1) + i;

      for (let j = 0; j <= segsH; j++) {
        for (let i = 0; i <= segsW; i++) {
          if (i < segsW) {
            const a = idx(i, j), b = idx(i + 1, j);
            this.constraints.push([a, b, this.particles[a].position.distanceTo(this.particles[b].position)]);
          }
          if (j < segsH) {
            const a = idx(i, j), b = idx(i, j + 1);
            this.constraints.push([a, b, this.particles[a].position.distanceTo(this.particles[b].position)]);
          }
          if (i < segsW && j < segsH) {
            const a1 = idx(i, j), b1 = idx(i + 1, j + 1);
            const a2 = idx(i + 1, j), b2 = idx(i, j + 1);
            this.constraints.push([a1, b1, this.particles[a1].position.distanceTo(this.particles[b1].position)]);
            this.constraints.push([a2, b2, this.particles[a2].position.distanceTo(this.particles[b2].position)]);
          }
        }
      }
    }

    simulate(dt, windForce) {
      const dtSq = dt * dt;

      for (const p of this.particles) {
        if (p.pinned) {
          p.position.copy(p.pinTarget);
          p.previous.copy(p.pinTarget);
          continue;
        }

        const vel = p.position.clone().sub(p.previous).multiplyScalar(DAMPING);
        const accel = GRAVITY.clone().multiplyScalar(p.invMass * dtSq);

        if (windForce) accel.add(windForce.clone().multiplyScalar(dtSq));

        p.previous.copy(p.position);
        p.position.add(vel).add(accel);
      }

      for (let iter = 0; iter < ITERATIONS; iter++) {
        for (const [a, b, rest] of this.constraints) {
          const pa = this.particles[a];
          const pb = this.particles[b];
          const diff = pb.position.clone().sub(pa.position);
          const dist = diff.length();
          if (dist < 0.0001) continue;
          const correction = diff.multiplyScalar((dist - rest) / dist * 0.5);

          if (!pa.pinned) pa.position.add(correction);
          if (!pb.pinned) pb.position.sub(correction);
        }
      }
    }

    updateGeometry(geometry) {
      const pos = geometry.attributes.position;
      for (let i = 0; i < this.particles.length; i++) {
        const p = this.particles[i];
        pos.setXYZ(i, p.position.x, p.position.y, p.position.z);
      }
      pos.needsUpdate = true;
      geometry.computeVertexNormals();
    }

    setPinOffset(offsetX) {
      const topRow = this.segsW + 1;
      for (let i = 0; i < topRow; i++) {
        const p = this.particles[i];
        p.pinTarget.x = p.original.x + offsetX;
      }
    }
  }

  /* ════════════════════════════════════════════════════════════════
     B. THREE.JS SCENE
     ════════════════════════════════════════════════════════════════ */

  const SEGS_W      = 50;
  const SEGS_H      = 45;
  const PANEL_W     = 3.2;
  const PANEL_H     = 5.0;
  const GAP         = 0.0;
  const PLEAT_COUNT = 8;
  const PLEAT_DEPTH = 0.22;

  let scene, camera, renderer;
  let leftMesh, rightMesh;
  let leftCloth, rightCloth;
  let windTime = 0;

  function initThree() {
    scene = new Scene();

    camera = new PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(0, 0, 5.6);
    camera.lookAt(0, 0, 0);

    renderer = new WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.id = 'curtainCanvas';
    curtainWrap.insertBefore(renderer.domElement, curtainWrap.firstChild);

    const loader = new TextureLoader();
    const diffuse  = loader.load('assets/velvet-diffuse.jpg');
    const normal   = loader.load('assets/velvet-normal.jpg');
    const rough    = loader.load('assets/velvet-roughness.jpg');

    [diffuse, normal, rough].forEach(tex => {
      tex.wrapS = tex.wrapT = RepeatWrapping;
      tex.repeat.set(4, 6);
    });
    diffuse.colorSpace = SRGBColorSpace;

    const material = new MeshStandardMaterial({
      map: diffuse,
      normalMap: normal,
      roughnessMap: rough,
      color: new Color(0xffd0d0),
      roughness: 0.88,
      metalness: 0.03,
      side: DoubleSide,
      normalScale: new Vector2(0.6, 0.6),
    });

    const leftGeo  = new PlaneGeometry(PANEL_W, PANEL_H, SEGS_W, SEGS_H);
    const rightGeo = new PlaneGeometry(PANEL_W, PANEL_H, SEGS_W, SEGS_H);

    leftMesh  = new Mesh(leftGeo, material);
    rightMesh = new Mesh(rightGeo, material.clone());

    scene.add(leftMesh, rightMesh);

    leftCloth  = new Cloth(SEGS_W, SEGS_H, PANEL_W, PANEL_H, PLEAT_COUNT, PLEAT_DEPTH);
    rightCloth = new Cloth(SEGS_W, SEGS_H, PANEL_W, PANEL_H, PLEAT_COUNT, PLEAT_DEPTH);

    const halfPanel = PANEL_W / 2;
    leftCloth.particles.forEach(p => {
      p.position.x  -= halfPanel + GAP;
      p.previous.x  -= halfPanel + GAP;
      p.original.x  -= halfPanel + GAP;
      p.pinTarget.x -= halfPanel + GAP;
    });
    rightCloth.particles.forEach(p => {
      p.position.x  += halfPanel + GAP;
      p.previous.x  += halfPanel + GAP;
      p.original.x  += halfPanel + GAP;
      p.pinTarget.x += halfPanel + GAP;
    });

    leftCloth.updateGeometry(leftGeo);
    rightCloth.updateGeometry(rightGeo);

    const ambient = new AmbientLight(0xfff0e0, 0.8);
    scene.add(ambient);

    const spotCenter = new SpotLight(0xffe8b0, 4.0, 15, Math.PI / 4, 0.5, 1.2);
    spotCenter.position.set(0, 4, 5);
    spotCenter.target.position.set(0, -0.5, 0);
    scene.add(spotCenter, spotCenter.target);

    const spotLeft = new SpotLight(0xffe8b0, 3.0, 15, Math.PI / 5, 0.6, 1.5);
    spotLeft.position.set(-3, 4, 4);
    spotLeft.target.position.set(-1.5, -1, 0);
    scene.add(spotLeft, spotLeft.target);

    const spotRight = new SpotLight(0xffe8b0, 3.0, 15, Math.PI / 5, 0.6, 1.5);
    spotRight.position.set(3, 4, 4);
    spotRight.target.position.set(1.5, -1, 0);
    scene.add(spotRight, spotRight.target);

    window.addEventListener('resize', onResize);
  }

  function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }

  /* ════════════════════════════════════════════════════════════════
     C. ANIMATION LOOP
     ════════════════════════════════════════════════════════════════ */

  function animate() {
    requestAnimationFrame(animate);

    windTime += TIMESTEP;
    const windX = Math.sin(windTime * 0.3) * 0.08;
    const windZ = Math.cos(windTime * 0.5) * 0.05;
    const wind  = new Vector3(windX, 0, windZ);

    leftCloth.simulate(TIMESTEP, wind);
    rightCloth.simulate(TIMESTEP, wind);

    leftCloth.updateGeometry(leftMesh.geometry);
    rightCloth.updateGeometry(rightMesh.geometry);

    renderer.render(scene, camera);
  }

  /* ════════════════════════════════════════════════════════════════
     D. INTERACTION — 3-STAGE SEQUENTIAL REVEAL

     Click 1: Left curtain peeks — text half-visible
     Click 2: Right curtain peeks — text peeking both sides
     Click 3: Both curtains fly open — full reveal
     ════════════════════════════════════════════════════════════════ */

  const PEEK_AMOUNT = PANEL_W * 0.10;
  const OPEN_AMOUNT = PANEL_W * 1.5;

  function advance() {
    if (busy || stage >= 3) return;
    hideHint();

    if (stage === 0)      peekLeft();
    else if (stage === 1) peekRight();
    else if (stage === 2) openBoth();
  }

  function peekLeft() {
    busy = true;
    stage = 1;

    const target = { x: 0 };
    gsap.to(target, {
      x: -PEEK_AMOUNT,
      duration: 2.5,
      ease: 'power2.inOut',
      onUpdate: () => leftCloth.setPinOffset(target.x),
      onComplete: () => {
        busy = false;
        teasInvite(0.15);
        scheduleHint('Click again to peek the other side');
      },
    });
  }

  function peekRight() {
    busy = true;
    stage = 2;

    const target = { x: 0 };
    gsap.to(target, {
      x: PEEK_AMOUNT,
      duration: 2.5,
      ease: 'power2.inOut',
      onUpdate: () => rightCloth.setPinOffset(target.x),
      onComplete: () => {
        busy = false;
        teasInvite(0.35);
        scheduleHint('Click to reveal');
      },
    });
  }

  function openBoth() {
    busy = true;
    stage = 3;

    const leftCurrent  = leftCloth.particles[0].pinTarget.x - leftCloth.particles[0].original.x;
    const rightCurrent = rightCloth.particles[0].pinTarget.x - rightCloth.particles[0].original.x;
    const leftTarget  = { x: leftCurrent };
    const rightTarget = { x: rightCurrent };

    const tl = gsap.timeline({
      onComplete: () => {
        busy = false;
        renderer.domElement.style.pointerEvents = 'none';
        curtainWrap.style.pointerEvents = 'none';
        revealInvite();
      },
    });

    tl.to(leftTarget, {
      x: -OPEN_AMOUNT,
      duration: 2.2,
      ease: 'power3.in',
      onUpdate: () => leftCloth.setPinOffset(leftTarget.x),
    }, 0);

    tl.to(rightTarget, {
      x: OPEN_AMOUNT,
      duration: 2.2,
      ease: 'power3.in',
      onUpdate: () => rightCloth.setPinOffset(rightTarget.x),
    }, 0.15);
  }

  function teasInvite(opacity) {
    gsap.to(Array.from(invite.querySelector('.invite__inner').children), {
      opacity: opacity, y: 0, duration: 0.8, stagger: 0.08, ease: 'power2.out',
    });
  }

  function revealInvite() {
    const children = Array.from(invite.querySelector('.invite__inner').children);

    gsap.to('.curtain-rod', { y: -40, opacity: 0, duration: 1.0, ease: 'power3.in' });

    gsap.to('.spotlight', {
      opacity: 1, duration: 1.4, stagger: 0.2, ease: 'power2.out',
    });

    gsap.to('.particle', { opacity: 1, duration: 0.01 });

    gsap.to(children, {
      opacity: 1, y: 0, duration: 0.75, stagger: 0.13, ease: 'power3.out',
    });
  }

  /* ════════════════════════════════════════════════════════════════
     F. HINT SYSTEM
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
      opacity: 0, duration: 0.3, ease: 'power2.in',
      onComplete: () => hint.setAttribute('aria-hidden', 'true'),
    });
  }

  /* ════════════════════════════════════════════════════════════════
     G. CLICK ROUTING & EVENTS
     ════════════════════════════════════════════════════════════════ */

  function routeClick() {
    advance();
  }

  function buildRings() {
    const count = Math.floor(window.innerWidth / 50);
    for (let i = 0; i < count; i++) {
      const ring = document.createElement('div');
      ring.className = 'curtain-rod__ring';
      ringsEl.appendChild(ring);
    }
  }

  function buildSparkles() {
    const container = document.getElementById('sparkles');
    for (let i = 0; i < 50; i++) {
      const s = document.createElement('div');
      s.className = 'sparkle';
      const size  = Math.random() * 4 + 2;
      const x     = Math.random() * 100;
      const y     = Math.random() * 100;
      const dur   = Math.random() * 4 + 2;
      const delay = Math.random() * 8;
      const peak  = (Math.random() * 0.5 + 0.3).toFixed(2);
      s.style.cssText = `width:${size}px;height:${size}px;left:${x}%;top:${y}%;--twinkle-dur:${dur}s;--twinkle-delay:${delay}s;--twinkle-peak:${peak};`;
      container.appendChild(s);
    }
  }

  function buildBokeh() {
    const container = document.getElementById('bokeh');
    for (let i = 0; i < 8; i++) {
      const orb = document.createElement('div');
      orb.className = 'bokeh-orb';
      const size  = Math.random() * 120 + 60;
      const x     = Math.random() * 90 + 5;
      const y     = Math.random() * 80 + 10;
      const dur   = Math.random() * 10 + 10;
      const delay = Math.random() * 8;
      const dx    = (Math.random() - 0.5) * 60;
      const dy    = (Math.random() - 0.5) * 40;
      orb.style.cssText = `width:${size}px;height:${size}px;left:${x}%;top:${y}%;--bokeh-dur:${dur}s;--bokeh-delay:${delay}s;--bokeh-dx:${dx}px;--bokeh-dy:${dy}px;`;
      container.appendChild(orb);
    }
  }

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
     INIT
     ════════════════════════════════════════════════════════════════ */

  function init() {
    buildRings();
    buildSparkles();
    buildBokeh();
    buildParticles();
    initThree();
    animate();
    scheduleHint();

    curtainWrap.style.pointerEvents = 'auto';
    renderer.domElement.addEventListener('click', routeClick);

    ['mousemove', 'touchstart'].forEach((evt) => {
      document.addEventListener(evt, () => {
        if (stage >= 3) return;
        scheduleHint();
      }, { once: true });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();

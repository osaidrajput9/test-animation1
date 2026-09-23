/* =========================================================
   FXContainer
   Core idea: one number (pos) describes where the carousel is.
   Each effect is a pure function that turns an item's distance
   from pos into a 3D pose. Drag, keys, autoplay and tweens all
   just change pos, then render() applies the poses.
   ========================================================= */
import gsap from "gsap";

const DEG = 180 / Math.PI;
const mod = (a, n) => ((a % n) + n) % n;
const clamp = (min, max, v) => Math.min(max, Math.max(min, v));
const pose = (o) => Object.assign({ x:0, y:0, z:0, rotationX:0, rotationY:0, rotationZ:0, scale:1, opacity:1 }, o);

export class FXContainer {
  static effects = {};
  static register(name, layout) { FXContainer.effects[name] = layout; }

  constructor(root, opts = {}) {
    this.root  = root;
    this.scene = root.querySelector('.fx__scene');
    this.items = [...root.querySelectorAll('.fx__item')];
    this.n     = this.items.length;
    this.o = Object.assign({ effect:'ring', duration:0.9, ease:'power3.out', morphDuration:1.1,
                             tilt:true, autoplay:0, accent:null, onChange:null }, opts);
    this.pos = { v: 0 };
    this.index = -1;
    this.flipped = null;
    this.morphing = false;
    this.effectName = this.o.effect;
    this.ac = new AbortController();

    this.mq = matchMedia('(prefers-reduced-motion: reduce)');
    this.reduced = this.mq.matches;
    this.mq.addEventListener('change', e => { this.reduced = e.matches; this.setTilt(this.o.tilt); }, { signal: this.ac.signal });

    gsap.set(this.root, { '--fx-accent': this.o.accent || getComputedStyle(root).getPropertyValue('--fx-accent').trim() });
    this.tiltX = gsap.quickTo(this.scene, 'rotationX', { duration: 0.7, ease: 'power3' });
    this.tiltY = gsap.quickTo(this.scene, 'rotationY', { duration: 0.7, ease: 'power3' });

    this.measure();
    this._bind();
    this.setTilt(this.o.tilt);
    this.setAutoplay(this.o.autoplay);
    this._intro();
  }

  /* ---------- geometry ---------- */
  measure() { this.w = this.items[0].offsetWidth; this.h = this.items[0].offsetHeight; }
  offset(i)  { let d = mod(i - this.pos.v, this.n); if (d >= this.n / 2) d -= this.n; return d; } // signed, shortest way round
  forward(i) { return mod(i - this.pos.v, this.n); }                                             // 0..n, for stacks
  poses() {
    const layout = FXContainer.effects[this.effectName];
    return this.items.map((_, i) => {
      const p = pose(layout({ i, d: this.offset(i), f: this.forward(i), n: this.n, w: this.w, h: this.h }));
      p.zIndex = Math.round(1000 + p.z);
      return p;
    });
  }
  render() {
    if (this.morphing) return;
    this.poses().forEach((p, i) => gsap.set(this.items[i], p));
    this._sync();
  }
  _tweenPoses(P, vars) {
    this.morphing = true;
    gsap.killTweensOf(this.items);
    gsap.set(this.items, { zIndex: i => P[i].zIndex });
    const t = {};
    ['x','y','z','rotationX','rotationY','rotationZ','scale','opacity'].forEach(k => t[k] = i => P[i][k]);
    return gsap.to(this.items, Object.assign(t, vars, {
      onComplete: () => { this.morphing = false; this.render(); }
    }));
  }
  _intro() {
    const P = this.poses();
    gsap.set(this.items, { opacity: 0, z: -900, rotationY: -80, scale: 0.6 });
    this._tweenPoses(P, { duration: this.reduced ? 0 : 1.4, ease: 'expo.out', stagger: this.reduced ? 0 : 0.06 });
    this._sync();
  }

  /* ---------- navigation ---------- */
  goTo(target, duration = this.o.duration) {
    if (this.morphing) return;
    this._unflip();
    gsap.killTweensOf(this.pos);
    gsap.to(this.pos, { v: target, duration: this.reduced ? 0 : duration, ease: this.o.ease,
                        onUpdate: () => this.render() });
  }
  next() { this.goTo(Math.round(this.pos.v) + 1); }
  prev() { this.goTo(Math.round(this.pos.v) - 1); }
  show(i) { this.goTo(Math.round(this.pos.v + this.offset(i))); }

  /* ---------- effects ---------- */
  use(name) {
    if (!FXContainer.effects[name] || name === this.effectName) return;
    gsap.killTweensOf(this.pos);
    this.pos.v = Math.round(this.pos.v);
    this._unflip();
    this.effectName = name;
    this.root.dataset.effect = name;
    this._tweenPoses(this.poses(), {
      duration: this.reduced ? 0 : this.o.morphDuration, ease: 'expo.inOut',
      stagger: { each: this.reduced ? 0 : 0.03, from: mod(Math.round(this.pos.v), this.n) }
    });
  }

  /* ---------- theming ---------- */
  setColor(color, duration = 0.8) {
    gsap.to(this.root, { '--fx-accent': color, duration: this.reduced ? 0 : duration, ease: 'power2.out' });
  }

  /* ---------- flip ---------- */
  flip() {
    const idx = this.index, card = this.items[idx].querySelector('.fx__card');
    const on = this.flipped !== idx;
    this._unflip();
    if (on) { gsap.to(card, { rotationY: 180, duration: this.reduced ? 0 : 0.8, ease: 'back.out(1.3)' }); this.flipped = idx; }
  }
  _unflip() {
    if (this.flipped === null) return;
    gsap.to(this.items[this.flipped].querySelector('.fx__card'), { rotationY: 0, duration: this.reduced ? 0 : 0.5, ease: 'power2.out' });
    this.flipped = null;
  }

  /* ---------- options ---------- */
  setTilt(on) {
    this.o.tilt = on;
    if (!on || this.reduced) { this.tiltX(0); this.tiltY(0); }
  }
  setAutoplay(sec) {
    this.o.autoplay = sec;
    this._auto && this._auto.kill();
    if (!sec || this.reduced) return;
    const loop = () => {
      if (!this._paused && !this.drag && !this.morphing) this.next();
      this._auto = gsap.delayedCall(sec, loop);
    };
    this._auto = gsap.delayedCall(sec, loop);
  }

  /* ---------- state sync ---------- */
  _sync() {
    const idx = mod(Math.round(this.pos.v), this.n);
    if (idx === this.index) return;
    this.index = idx;
    this.items.forEach((el, i) => {
      el.classList.toggle('is-active', i === idx);
      el.setAttribute('aria-hidden', i === idx ? 'false' : 'true');
    });
    this.o.onChange && this.o.onChange(idx, this);
  }

  /* ---------- input ---------- */
  _bind() {
    const r = this.root, sig = { signal: this.ac.signal };

    r.addEventListener('pointerdown', e => {
      if (this.morphing || e.button > 0) return;
      gsap.killTweensOf(this.pos);
      const unit = this.effectName === 'deck' ? this.w * 1.1 : this.w * 0.7;
      this.drag = { x: e.clientX, start: this.pos.v, unit, moved: false, lastX: e.clientX, lastT: performance.now(), vel: 0, target: e.target };
      r.setPointerCapture(e.pointerId);
    }, sig);

    r.addEventListener('pointermove', e => {
      const d = this.drag;
      if (!d) {                                   // hover tilt
        if (!this.o.tilt || this.reduced || e.pointerType !== 'mouse') return;
        const b = r.getBoundingClientRect();
        this.tiltY(((e.clientX - b.left) / b.width - 0.5) * 12);
        this.tiltX(-((e.clientY - b.top) / b.height - 0.5) * 9);
        return;
      }
      const dx = e.clientX - d.x;
      if (!d.moved && Math.abs(dx) > 6) { d.moved = true; r.classList.add('is-dragging'); this._unflip(); }
      if (!d.moved) return;
      const now = performance.now();
      d.vel = (e.clientX - d.lastX) / Math.max(1, now - d.lastT);   // px per ms
      d.lastX = e.clientX; d.lastT = now;
      this.pos.v = d.start - dx / d.unit;
      this.render();
    }, sig);

    const end = () => {
      const d = this.drag; if (!d) return;
      this.drag = null; r.classList.remove('is-dragging');
      if (d.moved) {
        const fling = clamp(-2, 2, (-d.vel * 250) / d.unit);          // momentum in "items"
        this.goTo(Math.round(this.pos.v + fling), 0.8);
      } else {
        const item = d.target.closest('.fx__item');
        if (!item) return;
        const i = this.items.indexOf(item);
        i === this.index ? this.flip() : this.show(i);
      }
    };
    r.addEventListener('pointerup', end, sig);
    r.addEventListener('pointercancel', end, sig);
    r.addEventListener('pointerleave', () => { if (!this.drag) { this.tiltX(0); this.tiltY(0); } }, sig);

    r.addEventListener('keydown', e => {
      if (e.key === 'ArrowRight') { e.preventDefault(); this.next(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); this.prev(); }
      else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.flip(); }
    }, sig);

    // pause autoplay while the user is interacting
    ['pointerenter','focusin'].forEach(t => r.addEventListener(t, () => this._paused = true, sig));
    ['pointerleave','focusout'].forEach(t => r.addEventListener(t, () => this._paused = false, sig));

    this.ro = new ResizeObserver(() => { this.measure(); this.render(); });
    this.ro.observe(r);
  }

  destroy() {
    this.ac.abort(); this.ro.disconnect();
    this._auto && this._auto.kill();
    gsap.killTweensOf([this.pos, this.scene, this.root, ...this.items]);
    gsap.set([this.scene, ...this.items, ...this.root.querySelectorAll('.fx__card')], { clearProps: 'all' });
  }
}

/* =========================================================
   Built-in effects. Inputs:
     d = signed distance from the front (-n/2 .. n/2), fractional while moving
     f = forward distance (0 .. n), used by stack-style layouts
     n = item count, w/h = item size in px
   ========================================================= */
FXContainer.register('ring', ({ d, n, w }) => {
  const step = (2 * Math.PI) / Math.max(n, 3);
  const r = (w * 0.5 + 20) / Math.tan(Math.PI / Math.max(n, 3));
  const a = d * step;
  return { x: Math.sin(a) * r, z: Math.cos(a) * r - r, rotationY: a * DEG,
           opacity: 0.35 + 0.65 * (Math.cos(a) + 1) / 2 };
});

FXContainer.register('coverflow', ({ d, w }) => {
  const ad = Math.abs(d), s = Math.sign(d), c = Math.min(ad, 1), rest = Math.max(ad - 1, 0);
  return { x: s * (c * w * 0.66 + rest * w * 0.3), z: -c * 200 - rest * 70,
           rotationY: -s * c * 55, opacity: clamp(0, 1, 3.5 - ad) };
});

FXContainer.register('deck', ({ f, n, w }) => {
  if (f > n - 1) {                       // the front card leaving (or returning)
    const e = n - f;                     // 0 = front, 1 = gone
    return { x: -e * w * 1.35, y: -e * 30, z: 60 * e, rotationY: -e * 30, rotationZ: -e * 16, opacity: 1 - e };
  }
  return { y: -f * 18, z: -f * 70, scale: 1 - f * 0.045, rotationX: f * 2, opacity: clamp(0, 1, 4 - f) };
});

FXContainer.register('helix', ({ d, w, h }) => {
  const a = d * (Math.PI / 3);
  const r = w * 0.95;
  return { x: Math.sin(a) * r, y: d * h * 0.26, z: Math.cos(a) * r - r, rotationY: a * DEG,
           scale: 0.92, opacity: clamp(0, 1, 3.4 - Math.abs(d)) };
});

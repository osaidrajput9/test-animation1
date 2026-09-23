import { createDialRoot } from "dialkit/vanilla";
import "dialkit/vanilla/styles.css";
import { FXContainer } from "./fx-container.js";

/* DialKit controls are added in Step 3. The root is mounted now so the
   panel wiring exists, hidden outside dev builds. */
createDialRoot({ productionEnabled: !import.meta.env.PROD });

/* ===================== Demo wiring ===================== */
const live = document.getElementById('fx-live');
const count = document.getElementById('count');
const titles = [...document.querySelectorAll('.fx__face--front .fx__title')].map(t => t.textContent);

const fx = new FXContainer(document.getElementById('fx'), {
  effect: 'ring', accent: '#3D5AFE', tilt: true,
  onChange: (i, c) => {
    count.textContent = `${i + 1} / ${c.n}`;
    live.textContent = `${titles[i]}, ${i + 1} of ${c.n}`;
  }
});

document.getElementById('next').onclick = () => fx.next();
document.getElementById('prev').onclick = () => fx.prev();

document.querySelectorAll('#effects button').forEach(b => b.onclick = () => {
  document.querySelectorAll('#effects button').forEach(x => x.setAttribute('aria-pressed', x === b));
  fx.use(b.dataset.effect);
});

const swatches = document.querySelectorAll('.swatch');
swatches.forEach(s => s.onclick = () => {
  swatches.forEach(x => x.setAttribute('aria-pressed', x === s));
  document.getElementById('picker').value = s.dataset.c;
  fx.setColor(s.dataset.c);
});
document.getElementById('picker').addEventListener('input', e => {
  swatches.forEach(x => x.setAttribute('aria-pressed', 'false'));
  fx.setColor(e.target.value, 0.3);
});

document.getElementById('tilt').onchange = e => fx.setTilt(e.target.checked);
document.getElementById('auto').onchange = e => fx.setAutoplay(e.target.checked ? 3 : 0);

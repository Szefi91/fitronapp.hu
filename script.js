document.getElementById('year').textContent = new Date().getFullYear();

const heroMain = document.getElementById('hero-main-screen');

// Vite build-safe: src-eket a DOM-ból olvassuk, így a hashed fájlnevek is működnek
const gallerySources = Array.from(document.querySelectorAll('.shot img'))
  .map((img) => img.getAttribute('src'))
  .filter(Boolean);

const screens = Array.from(new Set([
  heroMain?.getAttribute('src'),
  ...gallerySources
])).filter(Boolean);

let idx = 0;
let lock = false;

function swapScreen(next) {
  if (!heroMain || lock || !screens.length) return;
  lock = true;
  heroMain.classList.add('swap');
  setTimeout(() => {
    heroMain.src = screens[next];
    heroMain.classList.remove('swap');
    lock = false;
  }, 220);
}

window.addEventListener('scroll', () => {
  if (!screens.length) return;
  const max = document.body.scrollHeight - window.innerHeight;
  if (max <= 0) return;
  const ratio = window.scrollY / max;
  const next = Math.min(screens.length - 1, Math.floor(ratio * screens.length));
  if (next !== idx) {
    idx = next;
    swapScreen(idx);
  }
});

setInterval(() => {
  if (!screens.length) return;
  idx = (idx + 1) % screens.length;
  swapScreen(idx);
}, 3800);

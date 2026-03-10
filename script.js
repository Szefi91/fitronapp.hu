document.getElementById('year').textContent = new Date().getFullYear();

const heroMain = document.getElementById('hero-main-screen');
const screens = [
  './assets/screen-home.jpg',
  './assets/screen-workout.jpg',
  './assets/screen-community.jpg',
  './assets/screen-macros.jpg'
];

let idx = 0;
let lock = false;

function swapScreen(next) {
  if (!heroMain || lock) return;
  lock = true;
  heroMain.classList.add('swap');
  setTimeout(() => {
    heroMain.src = screens[next];
    heroMain.classList.remove('swap');
    lock = false;
  }, 220);
}

window.addEventListener('scroll', () => {
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
  if (!heroMain) return;
  idx = (idx + 1) % screens.length;
  swapScreen(idx);
}, 3800);

import * as THREE from 'three';

/* ---------- 3D hero: icon công nghệ bay vòng quanh + hạt, parallax theo chuột ---------- */
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const canvas = document.getElementById('bg3d');
const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
camera.position.z = 7;

/* vẽ icon dạng huy hiệu tròn + chữ lên canvas → texture sprite */
function iconTexture(label, color) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.beginPath(); g.arc(128, 128, 118, 0, Math.PI * 2);
  g.fillStyle = 'rgba(10, 25, 50, 0.92)'; g.fill();
  g.lineWidth = 10; g.strokeStyle = color; g.stroke();
  g.fillStyle = color;
  g.font = `600 ${label.length > 4 ? 52 : 72}px "JetBrains Mono", monospace`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(label, 128, 134);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const TECHS = [
  ['C++', '#659ad2'], ['Py', '#ffd43b'], ['JS', '#f7df1e'], ['TS', '#3178c6'],
  ['Node', '#8cc84b'], ['PHP', '#a0a8f0'], ['HTML', '#ff6b35'], ['CSS', '#53d8e8'],
  ['Git', '#f05033'], ['SQL', '#8fa5c9'], ['⚛', '#61dafb'], ['</>', '#eaf2ff']
];
const icons = TECHS.map(([label, color], i) => {
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({
    map: iconTexture(label, color), transparent: true, opacity: 0.9, depthWrite: false
  }));
  const s = 0.75 + Math.random() * 0.45;
  sp.scale.set(s, s, 1);
  sp.userData = {
    r: 2.6 + Math.random() * 2.4,          // bán kính quỹ đạo
    a: (i / TECHS.length) * Math.PI * 2,   // góc ban đầu
    sp: 0.00012 + Math.random() * 0.00018, // tốc độ quay
    y: (Math.random() - 0.5) * 3.4,        // độ cao
    bob: Math.random() * Math.PI * 2       // pha nhấp nhô
  };
  scene.add(sp);
  return sp;
});

const N = 500;
const pos = new Float32Array(N * 3);
for (let i = 0; i < N * 3; i++) pos[i] = (Math.random() - 0.5) * 22;
const pts = new THREE.Points(
  new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(pos, 3)),
  new THREE.PointsMaterial({ color: 0x8fa5c9, size: 0.035, transparent: true, opacity: 0.7 })
);
scene.add(pts);

let mx = 0, my = 0;
addEventListener('pointermove', e => {
  mx = (e.clientX / innerWidth - 0.5) * 2;
  my = (e.clientY / innerHeight - 0.5) * 2;
});

function resize() {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

function tick(t) {
  for (const sp of icons) {
    const u = sp.userData;
    const a = u.a + t * u.sp;
    sp.position.set(Math.cos(a) * u.r, u.y + Math.sin(t * 0.0006 + u.bob) * 0.35, Math.sin(a) * u.r * 0.55);
    sp.material.opacity = 0.55 + 0.35 * ((Math.sin(a) + 1) / 2); // icon phía sau mờ hơn
  }
  pts.rotation.y = t * 0.00003;
  camera.position.x += (mx * 0.6 - camera.position.x) * 0.04;
  camera.position.y += (-my * 0.4 - camera.position.y) * 0.04;
  camera.lookAt(0, 0, 0);
  renderer.render(scene, camera);
  if (!reduced) requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

/* ---------- dữ liệu (data.json do console admin cập nhật) ---------- */
const fmtSize = b => b > 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB';
const fmtDate = s => new Date(s).toLocaleDateString('vi-VN');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const data = await (await fetch('data.json?t=' + Date.now())).json();

document.title = data.settings.title;
document.getElementById('site-title').textContent = data.settings.title;
document.getElementById('site-tagline').textContent = data.settings.tagline;
document.getElementById('foot-note').textContent = '© ' + data.settings.title;

const totalFiles = data.folders.reduce((n, f) => n + f.files.length, 0);
document.getElementById('hero-stats').innerHTML =
  `<div><b>${data.folders.length}</b>mục</div><div><b>${totalFiles}</b>file</div>`;

const main = document.getElementById('folders');
if (!data.folders.length) {
  main.innerHTML = '<div class="empty">Chưa có mục nào. Đăng nhập console admin để tạo mục và tải file lên.</div>';
} else {
  main.innerHTML = data.folders.map((fo, i) => `
    <section class="folder">
      <div class="folder-head">
        <span class="idx">${String(i + 1).padStart(2, '0')}</span>
        <h2>${esc(fo.name)}</h2>
      </div>
      ${fo.description ? `<p class="folder-desc">${esc(fo.description)}</p>` : ''}
      <div class="files">
        ${fo.files.map(f => `
          <article class="file-card">
            <div class="file-top"><span class="ext">${esc(f.ext)}</span><h3>${esc(f.label)}</h3></div>
            ${f.description ? `<p class="file-desc">${esc(f.description)}</p>` : ''}
            <div class="file-meta">
              <span>${fmtSize(f.size)} · ${fmtDate(f.uploadedAt)}</span>
              <a class="dl" href="${esc(f.url)}" download>TẢI VỀ ↓</a>
            </div>
          </article>`).join('') || '<p class="folder-desc">Mục này chưa có file.</p>'}
      </div>
    </section>`).join('');
}

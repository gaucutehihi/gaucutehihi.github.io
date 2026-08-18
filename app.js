import * as THREE from 'three';

/* ---------- 3D hero: torus knot wireframe + hạt, parallax theo chuột ---------- */
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const canvas = document.getElementById('bg3d');
const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
camera.position.z = 7;

const knot = new THREE.Mesh(
  new THREE.TorusKnotGeometry(1.7, 0.5, 140, 18),
  new THREE.MeshBasicMaterial({ color: 0x53d8e8, wireframe: true, transparent: true, opacity: 0.28 })
);
knot.position.set(2.6, 0.4, 0);
scene.add(knot);

const inner = new THREE.Mesh(
  new THREE.IcosahedronGeometry(0.9, 1),
  new THREE.MeshBasicMaterial({ color: 0xff6b35, wireframe: true, transparent: true, opacity: 0.5 })
);
inner.position.copy(knot.position);
scene.add(inner);

const N = 700;
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
  knot.rotation.x = t * 0.00012;
  knot.rotation.y = t * 0.00018;
  inner.rotation.y = -t * 0.0003;
  inner.rotation.z = t * 0.0002;
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

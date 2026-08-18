import * as THREE from 'three';

/* ---------- 3D: logo công nghệ bay quanh + hệ mặt trời nhỏ, parallax chuột ---------- */
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const canvas = document.getElementById('bg3d');
const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
camera.position.z = 7;

/* --- logo thật (SVG simple-icons) → sprite; lỗi mạng fallback chữ --- */
function textTexture(label, color) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = color;
  g.font = `600 ${label.length > 4 ? 60 : 84}px "JetBrains Mono", monospace`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(label, 128, 132);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

async function logoTexture(slug, color) {
  try {
    const svg = await (await fetch(`https://cdn.jsdelivr.net/npm/simple-icons@11/icons/${slug}.svg`)).text();
    const tinted = svg.replace('<svg ', `<svg fill="${color}" `);
    const url = URL.createObjectURL(new Blob([tinted], { type: 'image/svg+xml' }));
    const img = await new Promise((res, rej) => {
      const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = url;
    });
    const c = document.createElement('canvas'); c.width = c.height = 256;
    c.getContext('2d').drawImage(img, 18, 18, 220, 220);
    URL.revokeObjectURL(url);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  } catch { return textTexture(slug.slice(0, 4).toUpperCase(), color); }
}

const TECHS = [
  ['cplusplus', '#659ad2'], ['python', '#ffd43b'], ['javascript', '#f7df1e'],
  ['typescript', '#3178c6'], ['nodedotjs', '#8cc84b'], ['php', '#a0a8f0'],
  ['html5', '#ff6b35'], ['css3', '#53d8e8'], ['git', '#f05033'],
  ['react', '#61dafb'], ['mysql', '#8fa5c9'], ['github', '#eaf2ff']
];
const icons = [];
for (const [slug, color] of TECHS) {
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, opacity: 0.9, depthWrite: false }));
  const s = 0.7 + Math.random() * 0.45;
  sp.scale.set(s, s, 1);
  sp.userData = {
    r: 3.4 + Math.random() * 2.2,
    a: (icons.length / TECHS.length) * Math.PI * 2,
    sp: 0.00012 + Math.random() * 0.00018,
    y: (Math.random() - 0.5) * 3.6,
    bob: Math.random() * Math.PI * 2
  };
  scene.add(sp);
  icons.push(sp);
  logoTexture(slug, color).then(tex => { sp.material.map = tex; sp.material.needsUpdate = true; });
}

/* --- hệ mặt trời nhỏ (góc phải hero) --- */
function glowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 4, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255, 200, 90, .9)');
  gr.addColorStop(0.4, 'rgba(255, 160, 60, .35)');
  gr.addColorStop(1, 'rgba(255, 140, 40, 0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

const solar = new THREE.Group();
solar.position.set(3.2, 0.7, 0);
solar.rotation.x = 0.35;
scene.add(solar);

const sun = new THREE.Mesh(
  new THREE.SphereGeometry(0.3, 24, 24),
  new THREE.MeshBasicMaterial({ color: 0xffc94d })
);
solar.add(sun);
const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), transparent: true, opacity: 0.85, depthWrite: false }));
glow.scale.set(1.7, 1.7, 1);
solar.add(glow);

const PLANETS = [
  { r: 0.58, s: 0.045, c: 0x9fb8d8, sp: 0.0011 },
  { r: 0.82, s: 0.065, c: 0x53d8e8, sp: 0.00075 },
  { r: 1.08, s: 0.055, c: 0xff8c5a, sp: 0.0005 },
  { r: 1.38, s: 0.085, c: 0xd8c39f, sp: 0.00034, ring: true }
];
const planets = PLANETS.map(p => {
  const m = new THREE.Mesh(new THREE.SphereGeometry(p.s, 16, 16), new THREE.MeshBasicMaterial({ color: p.c }));
  if (p.ring) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(p.s * 1.5, p.s * 2.3, 32),
      new THREE.MeshBasicMaterial({ color: 0xcbb98a, side: THREE.DoubleSide, transparent: true, opacity: 0.6 })
    );
    ring.rotation.x = Math.PI / 2.4;
    m.add(ring);
  }
  // quỹ đạo
  const orbitPts = [];
  for (let i = 0; i <= 64; i++) {
    const a = (i / 64) * Math.PI * 2;
    orbitPts.push(new THREE.Vector3(Math.cos(a) * p.r, 0, Math.sin(a) * p.r));
  }
  solar.add(new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(orbitPts),
    new THREE.LineBasicMaterial({ color: 0x8fa5c9, transparent: true, opacity: 0.18 })
  ));
  solar.add(m);
  return { mesh: m, ...p, a: Math.random() * Math.PI * 2 };
});

/* --- hạt sao --- */
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
    sp.material.opacity = 0.55 + 0.35 * ((Math.sin(a) + 1) / 2);
  }
  sun.rotation.y = t * 0.0002;
  for (const p of planets) {
    const a = p.a + t * p.sp;
    p.mesh.position.set(Math.cos(a) * p.r, 0, Math.sin(a) * p.r);
  }
  solar.rotation.y = t * 0.00004;
  pts.rotation.y = t * 0.00003;
  camera.position.x += (mx * 0.6 - camera.position.x) * 0.04;
  camera.position.y += (-my * 0.4 - camera.position.y) * 0.04;
  camera.lookAt(0, 0, 0);
  renderer.render(scene, camera);
  if (!reduced) requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

/* ---------- dữ liệu + routing ---------- */
const fmtSize = b => b > 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB';
const fmtDate = s => new Date(s).toLocaleDateString('vi-VN');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const slug = s => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase()
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'muc';

const data = await (await fetch('data.json?t=' + Date.now())).json();

document.title = data.settings.title;
document.getElementById('site-title').textContent = data.settings.title;
document.getElementById('site-tagline').textContent = data.settings.tagline;
document.getElementById('foot-note').textContent = '© ' + data.settings.title;

const totalFiles = data.folders.reduce((n, f) => n + f.files.length, 0);
document.getElementById('hero-stats').innerHTML =
  `<div><b>${data.folders.length}</b>mục</div><div><b>${totalFiles}</b>file</div>`;

const FOLDER_SVG = '<svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M3 7a2 2 0 0 1 2-2h4.2l2 2.4H19a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>';

const main = document.getElementById('folders');
const search = document.getElementById('search');
let term = '';

const fileRow = f => {
  const vers = f.versions || [];
  const oldVers = vers.slice(0, -1); // các bản cũ (bản cuối = bản chính)
  return `
  <article class="file-row">
    <div class="file-ico"><span>${esc(f.ext)}</span></div>
    <div class="file-body">
      <h3>${esc(f.label)} <span class="ver-badge">v${vers.length || 1}</span></h3>
      ${f.description ? `<p class="file-desc">${esc(f.description)}</p>` : ''}
      <p class="file-meta">${fmtSize(f.size)} · ${fmtDate(f.uploadedAt)}${vers.length > 1 ? ` · ${vers.length} phiên bản` : ''}</p>
      ${oldVers.length ? `
        <div class="old-vers">
          <label>Phiên bản cũ:</label>
          <select class="ver-select" data-main="${esc(f.url)}">
            <option value="">— chọn để tải —</option>
            ${oldVers.slice().reverse().map(v =>
              `<option value="${esc(v.url)}">v${v.v} · ${fmtSize(v.size)} · ${fmtDate(v.uploadedAt)}${v.note ? ' — ' + esc(v.note) : ''}</option>`).join('')}
          </select>
        </div>` : ''}
    </div>
    <div class="file-actions">
      <button class="report" data-fb="${f.id}" data-label="${esc(f.label)}">BÁO LỖI</button>
      <button class="copy" data-url="${esc(f.url)}">COPY LINK</button>
      <a class="dl" href="${esc(f.url)}" download>TẢI VỀ ↓</a>
    </div>
  </article>`;
};

function render() {
  const route = decodeURIComponent(location.hash.replace(/^#\//, ''));
  const fo = route ? data.folders.find(f => slug(f.name) === route) : null;

  if (route && !fo) {
    main.innerHTML = '<div class="empty">Không tìm thấy mục này. <a href="/">← Về trang chủ</a></div>';
    return;
  }

  if (fo) { /* ---- trang chi tiết mục ---- */
    document.title = fo.name + ' — ' + data.settings.title;
    search.placeholder = 'Tìm file trong mục này…';
    const files = fo.files.filter(f =>
      !term || (f.label + ' ' + (f.description || '')).toLowerCase().includes(term));
    main.innerHTML = `
      <nav class="crumb"><a href="./">← Trang chủ</a><span>/</span><b>${esc(fo.name)}</b></nav>
      <section class="folder-card">
        <div class="folder-tab">
          <span class="folder-ico">${FOLDER_SVG}</span>
          <h2>${esc(fo.name)}</h2>
          <span class="count">${fo.files.length} file</span>
        </div>
        ${fo.description ? `<p class="folder-desc">${esc(fo.description)}</p>` : ''}
        <div class="file-list">
          ${files.map(fileRow).join('') || '<p class="folder-desc">' + (term ? 'Không có file nào khớp.' : 'Mục này chưa có file.') + '</p>'}
        </div>
      </section>`;
  } else { /* ---- trang chủ: lưới folder ---- */
    document.title = data.settings.title;
    search.placeholder = 'Tìm mục…';
    const folders = data.folders.filter(f => !term || f.name.toLowerCase().includes(term));
    main.innerHTML = folders.length ? `
      <div class="folders-grid">
        ${folders.map(f => `
          <a class="folder-mini" href="${esc(slug(f.name))}">
            <span class="folder-ico">${FOLDER_SVG}</span>
            <span class="fm-name">${esc(f.name)}</span>
            <span class="count">${f.files.length} file</span>
          </a>`).join('')}
      </div>`
      : `<div class="empty">${term ? 'Không có mục nào khớp.' : 'Chưa có mục nào. Đăng nhập console admin để tạo mục và tải file lên.'}</div>`;
  }
}

/* copy link file + chọn phiên bản cũ */
main.addEventListener('click', async e => {
  const b = e.target.closest('.copy');
  if (!b) return;
  try {
    await navigator.clipboard.writeText(new URL(b.dataset.url, location.origin + location.pathname).href);
    b.textContent = 'ĐÃ COPY ✓';
    setTimeout(() => b.textContent = 'COPY LINK', 1500);
  } catch { prompt('Copy link này:', new URL(b.dataset.url, location.origin).href); }
});

main.addEventListener('change', e => {
  const sel = e.target.closest('.ver-select');
  if (!sel || !sel.value) return;
  const a = document.createElement('a');
  a.href = sel.value;
  a.download = '';
  a.click();
  sel.value = '';
});

search.addEventListener('input', () => { term = search.value.trim().toLowerCase(); render(); });
addEventListener('hashchange', render);
render();

/* ================= CHAT + BÁO LỖI (kvdb.io) ================= */
const BUCKET = data.settings.chatBucket;
const kv = p => `https://kvdb.io/${BUCKET}/${p}`;
const kvR = p => kv(p) + '?t=' + Date.now(); // GET phải kèm timestamp — kvdb bị browser cache 1 tháng
const chatKey = () => {
  const route = decodeURIComponent(location.hash.replace(/^#\//, ''));
  const fo = route ? data.folders.find(f => slug(f.name) === route) : null;
  return fo ? 'chat-' + fo.id : 'chat-main';
};
const chatTitle = () => {
  const route = decodeURIComponent(location.hash.replace(/^#\//, ''));
  const fo = route ? data.folders.find(f => slug(f.name) === route) : null;
  return fo ? 'Mục: ' + fo.name : 'Chung';
};

let chatName = localStorage.getItem('chat-name') || '';
let chatTimer = null;
let chatMsgs = [];      // cache tin nhắn phòng hiện tại
let lastChatJson = '';

function renderChat() {
  const box = document.getElementById('chat-box');
  const json = JSON.stringify(chatMsgs);
  if (json === lastChatJson) return; // không có gì mới → khỏi vẽ lại
  lastChatJson = json;
  const nearBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 80;
  box.innerHTML = chatMsgs.map(m => `
    <div class="chat-msg${m.admin ? ' admin' : ''}${m.pending ? ' pending' : ''}">
      <span class="chat-who">${esc(m.name)}${m.admin ? ' <em>ADMIN</em>' : ''} · ${new Date(m.t).toLocaleString('vi-VN')}</span>
      <span class="chat-text">${esc(m.text)}</span>
    </div>`).join('') || '<p class="chat-empty">Chưa có tin nhắn. Nhắn gì đó đi!</p>';
  if (nearBottom) box.scrollTop = box.scrollHeight;
}

async function loadChat() {
  if (!BUCKET) return;
  try {
    const msgs = await (await fetch(kvR(chatKey()))).json().catch(() => []);
    chatMsgs = Array.isArray(msgs) ? msgs : [];
    renderChat();
  } catch { /* mạng lỗi — bỏ qua */ }
}

async function sendChat() {
  const input = document.getElementById('chat-input');
  const text = input.value.trim();
  if (!text) return;
  if (!chatName) {
    chatName = (prompt('Bạn tên gì để hiện trong chat?') || '').trim() || 'Khách';
    localStorage.setItem('chat-name', chatName);
  }
  input.value = '';
  const m = { name: chatName.slice(0, 40), text: text.slice(0, 1000), t: Date.now(), admin: false, pending: true };
  chatMsgs.push(m);
  renderChat(); // hiện NGAY cho người gửi, không chờ server
  try {
    const msgs = await (await fetch(kvR(chatKey()))).json().catch(() => []);
    const list = (Array.isArray(msgs) ? msgs : []).concat([{ name: m.name, text: m.text, t: m.t, admin: false }]);
    await fetch(kv(chatKey()), { method: 'POST', body: JSON.stringify(list.slice(-200)) });
  } finally {
    m.pending = false;
    loadChat();
  }
}

/* báo lỗi file */
async function reportBug(fileId, label) {
  const text = prompt(`Báo lỗi / góp ý cho file "${label}"\nAdmin sẽ thấy trong console:`);
  if (!text || !text.trim()) return;
  const reports = await (await fetch(kvR('reports'))).json().catch(() => []);
  const list = Array.isArray(reports) ? reports : [];
  list.push({ fileId, label, text: text.trim().slice(0, 1000), t: Date.now(), done: false });
  await fetch(kv('reports'), { method: 'POST', body: JSON.stringify(list.slice(-200)) });
  alert('Đã gửi báo cáo cho admin. Cảm ơn bạn!');
}

/* widget chat */
const chatFab = document.createElement('button');
chatFab.id = 'chat-fab';
chatFab.textContent = '💬';
chatFab.title = 'Chat / góp ý';
document.body.appendChild(chatFab);

const chatPanel = document.createElement('div');
chatPanel.id = 'chat-panel';
chatPanel.hidden = true;
chatPanel.innerHTML = `
  <div class="chat-head"><b id="chat-title">Chat</b><button id="chat-close">✕</button></div>
  <div id="chat-box" class="chat-box"></div>
  <div class="chat-input"><input id="chat-input" maxlength="1000" placeholder="Nhắn tin…"><button id="chat-send">Gửi</button></div>`;
document.body.appendChild(chatPanel);

function openChat() {
  chatPanel.hidden = false;
  sessionStorage.setItem('chat-open', '1'); // nhớ trạng thái sau khi F5
  document.getElementById('chat-title').textContent = 'Chat — ' + chatTitle();
  lastChatJson = '';
  loadChat();
  clearInterval(chatTimer);
  chatTimer = setInterval(loadChat, 1500); // cập nhật nhanh mỗi 1.5s
}
function closeChat() {
  chatPanel.hidden = true;
  sessionStorage.setItem('chat-open', '0');
  clearInterval(chatTimer);
}
chatFab.onclick = () => chatPanel.hidden ? openChat() : closeChat();
document.getElementById('chat-close').onclick = closeChat;
document.getElementById('chat-send').onclick = sendChat;
document.getElementById('chat-input').addEventListener('keydown', e => { if (e.key === 'Enter') sendChat(); });

/* bấm nút BÁO LỖI */
main.addEventListener('click', e => {
  const b = e.target.closest('.report');
  if (b) reportBug(b.dataset.fb, b.dataset.label);
});

/* đổi trang → đổi kênh chat */
addEventListener('hashchange', () => {
  if (!chatPanel.hidden) {
    document.getElementById('chat-title').textContent = 'Chat — ' + chatTitle();
    lastChatJson = '';
    loadChat();
  }
});

/* F5 xong vẫn mở lại chat nếu trước đó đang mở */
if (sessionStorage.getItem('chat-open') === '1') openChat();

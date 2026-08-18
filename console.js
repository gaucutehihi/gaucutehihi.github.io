/* Console admin — dùng GitHub Contents API làm backend (miễn phí, không cần server). */
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtSize = b => b > 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB';
const msg = (el, text, ok = true) => { el.textContent = text; el.className = 'msg ' + (ok ? 'ok' : 'err'); };
const uid = () => crypto.randomUUID();

/* ---------- GitHub API ---------- */
const LS = 'kho-admin';
let auth = JSON.parse(localStorage.getItem(LS) || 'null'); // {token, repo, branch}

async function gh(path, opts = {}) {
  const r = await fetch(`https://api.github.com/repos/${auth.repo}/contents/${path}`, {
    ...opts,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: 'Bearer ' + auth.token,
      ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
      ...(opts.headers || {})
    }
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const m = j.message || ('HTTP ' + r.status);
    throw new Error(r.status === 401 ? 'Token sai hoặc hết hạn.' :
      r.status === 404 ? 'Không thấy repo (hoặc token thiếu quyền).' :
      r.status === 409 ? 'Xung đột phiên — thử lại.' : m);
  }
  return j;
}

const b64encode = str => { // utf-8 → base64 (chunked, tránh tràn stack)
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000)
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
};

async function getData() {
  try {
    const r = await gh('data.json');
    return { data: JSON.parse(decodeURIComponent(escape(atob(r.content.replace(/\n/g, ''))))), sha: r.sha };
  } catch (e) {
    if (/Không thấy/.test(e.message))
      return { data: { settings: { title: 'Kho Dự Án', tagline: '' }, folders: [] }, sha: null };
    throw e;
  }
}

async function putData(data, sha, message) {
  const body = { message, content: b64encode(JSON.stringify(data, null, 2)), branch: auth.branch };
  if (sha) body.sha = sha;
  return gh('data.json', { method: 'PUT', body: JSON.stringify(body) });
}

/* đọc → sửa → commit; retry 1 lần nếu xung đột sha */
async function mutate(message, fn) {
  for (let i = 0; i < 2; i++) {
    const { data, sha } = await getData();
    const result = await fn(data);
    try {
      await putData(data, sha, message);
      return result;
    } catch (e) {
      if (i === 0 && /Xung đột/.test(e.message)) continue;
      throw e;
    }
  }
}

const safeName = name => name.replace(/[^\w.\- ]+/g, '_').trim().slice(-80) || 'file';
const slug = s => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase()
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'muc';

/* ---------- UI ---------- */
let site = null;

async function refresh() {
  site = (await getData()).data;
  $('set-title').value = site.settings.title;
  $('set-tagline').value = site.settings.tagline;
  $('up-folder').innerHTML = site.folders.map(f => `<option value="${f.id}">${esc(f.name)}</option>`).join('')
    || '<option value="">— tạo mục trước —</option>';
  $('chat-room').innerHTML = '<option value="chat-main">Chung (trang chủ)</option>' +
    site.folders.map(f => `<option value="chat-${f.id}">Mục: ${esc(f.name)}</option>`).join('');
  renderManage();
  loadReports();
  loadAdminChat();
}

/* ---------- báo lỗi từ khách ---------- */
const BUCKET = () => site?.settings.chatBucket;
const kv = p => `https://kvdb.io/${BUCKET()}/${p}`;

async function loadReports() {
  if (!BUCKET()) return;
  try {
    const reports = await (await fetch(kv('reports'))).json().catch(() => []);
    const list = Array.isArray(reports) ? reports : [];
    $('report-list').innerHTML = list.length ? list.slice().reverse().map(r => `
      <div class="item-row">
        <div>
          <div class="name">${r.done ? '✅' : '🐞'} ${esc(r.label || 'file')}</div>
          <div class="meta">${esc(r.text)}</div>
          <div class="meta">${new Date(r.t).toLocaleString('vi-VN')}</div>
        </div>
        <div class="row">
          ${r.done ? '' : `<button class="small" data-done="${r.t}">Đã xử lý</button>`}
          <button class="danger" data-del-r="${r.t}">Xoá</button>
        </div>
      </div>`).join('') : '<p class="meta">Chưa có báo cáo nào.</p>';
  } catch { /* mạng lỗi */ }
}

$('report-list').addEventListener('click', async e => {
  const b = e.target.closest('button');
  if (!b) return;
  const reports = await (await fetch(kv('reports'))).json().catch(() => []);
  const list = Array.isArray(reports) ? reports : [];
  if (b.dataset.done) {
    const r = list.find(x => String(x.t) === b.dataset.done);
    if (r) r.done = true;
  } else if (b.dataset.delR) {
    const i = list.findIndex(x => String(x.t) === b.dataset.delR);
    if (i > -1) list.splice(i, 1);
  } else return;
  await fetch(kv('reports'), { method: 'POST', body: JSON.stringify(list) });
  loadReports();
});

/* ---------- chat admin ---------- */
async function loadAdminChat() {
  if (!BUCKET()) return;
  const key = $('chat-room').value || 'chat-main';
  try {
    const msgs = await (await fetch(kv(key))).json().catch(() => []);
    $('chat-box').innerHTML = (Array.isArray(msgs) ? msgs : []).map(m => `
      <div class="chat-msg${m.admin ? ' admin' : ''}">
        <span class="chat-who">${esc(m.name)}${m.admin ? ' <em>ADMIN</em>' : ''} · ${new Date(m.t).toLocaleString('vi-VN')}</span>
        <span class="chat-text">${esc(m.text)}</span>
      </div>`).join('') || '<p class="chat-empty">Chưa có tin nhắn.</p>';
    $('chat-box').scrollTop = $('chat-box').scrollHeight;
  } catch { /* mạng lỗi */ }
}

$('chat-room').addEventListener('change', loadAdminChat);
setInterval(() => { if (!$('admin-view').hidden) { loadAdminChat(); loadReports(); } }, 10000);

$('chat-send').onclick = async () => {
  const input = $('chat-input');
  const text = input.value.trim();
  if (!text) return;
  input.value = '';
  const key = $('chat-room').value || 'chat-main';
  const msgs = await (await fetch(kv(key))).json().catch(() => []);
  const list = Array.isArray(msgs) ? msgs : [];
  list.push({ name: 'Admin', text: text.slice(0, 1000), t: Date.now(), admin: true });
  await fetch(kv(key), { method: 'POST', body: JSON.stringify(list.slice(-200)) });
  loadAdminChat();
};
$('chat-input').addEventListener('keydown', e => { if (e.key === 'Enter') $('chat-send').click(); });

let editing = null; // id của mục/file đang mở form sửa

function renderManage() {
  $('manage-list').innerHTML = site.folders.map(fo => `
    <div class="item-row">
      <div><div class="name">📁 ${esc(fo.name)}</div>
        <div class="meta">${fo.files.length} file${fo.description ? ' · ' + esc(fo.description.slice(0, 80)) : ''}</div></div>
      <div class="row">
        <button class="small" data-copy-fo="${fo.id}">Copy link</button>
        <button class="small" data-edit-fo="${fo.id}">Sửa</button>
        <button class="danger" data-del-fo="${fo.id}">Xoá mục</button>
      </div>
    </div>
    ${editing === fo.id ? `
      <div class="edit-form">
        <label>Tên mục</label>
        <input type="text" id="ef-name" maxlength="120" value="${esc(fo.name)}">
        <label>Giới thiệu mục</label>
        <textarea id="ef-desc" maxlength="2000">${esc(fo.description || '')}</textarea>
        <div class="row" style="margin-top:12px">
          <button data-save-fo="${fo.id}">Lưu</button>
          <button class="ghost" data-cancel>Huỷ</button>
        </div>
      </div>` : ''}
    ${fo.files.map(f => `
      <div class="item-row" style="padding-left:26px">
        <div><div class="name">${esc(f.label)}</div>
          <div class="meta">${esc(f.ext)} · ${fmtSize(f.size)}${f.description ? ' · ' + esc(f.description.slice(0, 80)) : ''}</div></div>
        <div class="row">
          <button class="small" data-edit-f="${f.id}">Sửa</button>
          <button class="danger" data-del-f="${f.id}">Xoá</button>
        </div>
      </div>
      ${editing === f.id ? `
        <div class="edit-form" style="margin-left:26px">
          <label>Tên hiển thị</label>
          <input type="text" id="ef-name" maxlength="160" value="${esc(f.label)}">
          <label>Mô tả / ghi chú</label>
          <textarea id="ef-desc" maxlength="2000">${esc(f.description || '')}</textarea>
          <div class="row" style="margin-top:12px">
            <button data-save-f="${f.id}">Lưu</button>
            <button class="ghost" data-cancel>Huỷ</button>
          </div>
        </div>` : ''}`).join('')}`).join('') || '<p class="meta">Chưa có mục nào.</p>';
}

$('manage-list').addEventListener('click', async e => {
  const b = e.target.closest('button');
  if (!b) return;
  try {
    if (b.dataset.cancel) { editing = null; renderManage(); return; }
    if (b.dataset.editFo || b.dataset.editF) {
      editing = b.dataset.editFo || b.dataset.editF;
      renderManage();
      $('ef-name')?.focus();
      return;
    }
    if (b.dataset.saveFo) {
      const name = $('ef-name').value.trim();
      if (!name) return alert('Thiếu tên mục.');
      const description = $('ef-desc').value;
      await mutate(`Sửa mục: ${name}`, d => {
        const f = d.folders.find(x => x.id === b.dataset.saveFo);
        f.name = name.slice(0, 120); f.description = description.slice(0, 2000);
      });
      editing = null;
    } else if (b.dataset.saveF) {
      const label = $('ef-name').value.trim();
      if (!label) return alert('Thiếu tên hiển thị.');
      const description = $('ef-desc').value;
      await mutate(`Sửa file: ${label}`, d => {
        for (const fo of d.folders) for (const x of fo.files)
          if (x.id === b.dataset.saveF) { x.label = label.slice(0, 160); x.description = description.slice(0, 2000); }
      });
      editing = null;
    } else if (b.dataset.copyFo) {
      const fo = site.folders.find(f => f.id === b.dataset.copyFo);
      const url = new URL(slug(fo.name), location.href.replace(/console\.html.*$/, '')).href;
      try { await navigator.clipboard.writeText(url); } catch { prompt('Link của mục:', url); }
      b.textContent = 'Đã copy ✓'; setTimeout(() => b.textContent = 'Copy link', 1500);
      return;
    } else if (b.dataset.delFo) {
      const fo = site.folders.find(f => f.id === b.dataset.delFo);
      if (!confirm(`Xoá mục "${fo.name}" và ${fo.files.length} file bên trong? File trên repo sẽ xoá cùng lúc.`)) return;
      // xoá từng file trên repo (bỏ qua file đã mất)
      for (const f of fo.files) {
        try {
          const info = await gh(encodeURI(f.url));
          await gh(encodeURI(f.url), { method: 'DELETE', body: JSON.stringify({ message: `Xoá file: ${f.label}`, sha: info.sha, branch: auth.branch }) });
        } catch { /* đã xoá tay */ }
      }
      await mutate(`Xoá mục: ${fo.name}`, d => { d.folders = d.folders.filter(f => f.id !== fo.id); });
    } else if (b.dataset.delF) {
      const f = site.folders.flatMap(x => x.files).find(x => x.id === b.dataset.delF);
      if (!confirm(`Xoá file "${f.label}"?`)) return;
      try {
        const info = await gh(encodeURI(f.url));
        await gh(encodeURI(f.url), { method: 'DELETE', body: JSON.stringify({ message: `Xoá file: ${f.label}`, sha: info.sha, branch: auth.branch }) });
      } catch { /* đã xoá tay */ }
      await mutate(`Xoá file: ${f.label}`, d => {
        for (const fo of d.folders) fo.files = fo.files.filter(x => x.id !== f.id);
      });
    }
    await refresh();
  } catch (err) { alert(err.message); }
});

/* ---------- đăng nhập ---------- */
$('btn-login').onclick = async () => {
  const token = $('gh-token').value.trim();
  const repo = $('gh-repo').value.trim();
  const branch = $('gh-branch').value.trim() || 'main';
  if (!token || !/^[\w.-]+\/[\w.-]+$/.test(repo))
    return msg($('login-msg'), 'Cần token và repo dạng user/ten-repo.', false);
  auth = { token, repo, branch };
  try {
    await fetch(`https://api.github.com/repos/${repo}`, { headers: { Authorization: 'Bearer ' + token } })
      .then(r => { if (!r.ok) throw new Error(r.status === 401 ? 'Token sai hoặc hết hạn.' : 'Không thấy repo — kiểm tra tên và quyền token.'); });
    localStorage.setItem(LS, JSON.stringify(auth));
    showAdmin();
  } catch (err) { msg($('login-msg'), err.message, false); }
};

function showAdmin() {
  $('login-view').hidden = true;
  $('admin-view').hidden = false;
  $('repo-label').textContent = `Repo: ${auth.repo} @ ${auth.branch}`;
  refresh().catch(e => alert(e.message));
}

$('btn-logout').onclick = () => { localStorage.removeItem(LS); location.reload(); };

/* ---------- cài đặt ---------- */
$('btn-settings').onclick = async () => {
  try {
    await mutate('Cập nhật cài đặt trang', d => {
      d.settings.title = $('set-title').value.slice(0, 120) || d.settings.title;
      d.settings.tagline = $('set-tagline').value.slice(0, 300);
    });
    msg($('settings-msg'), 'Đã lưu.');
  } catch (err) { msg($('settings-msg'), err.message, false); }
};

/* ---------- folder ---------- */
$('btn-folder').onclick = async () => {
  const name = $('fo-name').value.trim();
  if (!name) return msg($('folder-msg'), 'Thiếu tên mục.', false);
  try {
    await mutate(`Tạo mục: ${name}`, d => {
      d.folders.push({ id: uid(), name: name.slice(0, 120), description: $('fo-desc').value.slice(0, 2000), files: [] });
    });
    $('fo-name').value = ''; $('fo-desc').value = '';
    msg($('folder-msg'), 'Đã tạo mục.');
    await refresh();
  } catch (err) { msg($('folder-msg'), err.message, false); }
};

/* ---------- upload ---------- */
$('btn-upload').onclick = async () => {
  const file = $('up-file').files[0];
  const folderId = $('up-folder').value;
  if (!folderId) return msg($('upload-msg'), 'Hãy tạo một mục trước.', false);
  if (!file) return msg($('upload-msg'), 'Hãy chọn file.', false);
  const btn = $('btn-upload');
  btn.disabled = true; btn.textContent = 'Đang tải…';
  try {
    const fname = safeName(file.name);
    const path = `uploads/${folderId}/${Date.now()}-${fname}`;
    const b64 = (await new Promise((res, rej) => {
      const fr = new FileReader();
      fr.onload = () => res(fr.result.split(',')[1]);
      fr.onerror = rej;
      fr.readAsDataURL(file);
    }));
    msg($('upload-msg'), 'Đang commit file lên GitHub…', true);
    await gh(encodeURI(path), { method: 'PUT', body: JSON.stringify({
      message: `Upload: ${file.name}`, content: b64, branch: auth.branch
    }) });
    const entry = {
      id: uid(), label: ($('up-label').value.trim() || file.name).slice(0, 160),
      description: $('up-desc').value.slice(0, 2000),
      ext: (file.name.split('.').pop() || 'file').toUpperCase().slice(0, 6),
      size: file.size, uploadedAt: new Date().toISOString(), url: path
    };
    await mutate(`Thêm file: ${entry.label}`, d => {
      d.folders.find(f => f.id === folderId).files.push(entry);
    });
    $('up-file').value = ''; $('up-label').value = ''; $('up-desc').value = '';
    msg($('upload-msg'), 'Đã tải lên: ' + file.name + ' (trang chủ cập nhật sau ~1 phút)');
    await refresh();
  } catch (err) { msg($('upload-msg'), err.message, false); }
  finally { btn.disabled = false; btn.textContent = 'Tải lên'; }
};

if (auth?.token) showAdmin();
else $('login-view').hidden = false;

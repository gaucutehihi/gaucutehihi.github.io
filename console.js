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
  renderManage();
}

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
    ${fo.files.map(f => `
      <div class="item-row" style="padding-left:26px">
        <div><div class="name">${esc(f.label)}</div>
          <div class="meta">${esc(f.ext)} · ${fmtSize(f.size)}${f.description ? ' · ' + esc(f.description.slice(0, 80)) : ''}</div></div>
        <div class="row">
          <button class="small" data-edit-f="${f.id}">Sửa</button>
          <button class="danger" data-del-f="${f.id}">Xoá</button>
        </div>
      </div>`).join('')}`).join('') || '<p class="meta">Chưa có mục nào.</p>';
}

$('manage-list').addEventListener('click', async e => {
  const b = e.target.closest('button');
  if (!b) return;
  try {
    if (b.dataset.copyFo) {
      const fo = site.folders.find(f => f.id === b.dataset.copyFo);
      const url = new URL(slug(fo.name), location.href.replace(/console\.html.*$/, '')).href;
      try { await navigator.clipboard.writeText(url); } catch { prompt('Link của mục:', url); }
      b.textContent = 'Đã copy ✓'; setTimeout(() => b.textContent = 'Copy link', 1500);
      return;
    }
    if (b.dataset.delFo) {
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
    } else if (b.dataset.editFo) {
      const fo = site.folders.find(f => f.id === b.dataset.editFo);
      const name = prompt('Tên mục:', fo.name); if (name === null) return;
      const description = prompt('Giới thiệu mục:', fo.description || ''); if (description === null) return;
      await mutate(`Sửa mục: ${name}`, d => {
        const f = d.folders.find(x => x.id === fo.id);
        f.name = name.slice(0, 120); f.description = description.slice(0, 2000);
      });
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
    } else if (b.dataset.editF) {
      const f = site.folders.flatMap(x => x.files).find(x => x.id === b.dataset.editF);
      const label = prompt('Tên hiển thị:', f.label); if (label === null) return;
      const description = prompt('Mô tả:', f.description || ''); if (description === null) return;
      await mutate(`Sửa file: ${label}`, d => {
        for (const fo of d.folders) for (const x of fo.files)
          if (x.id === f.id) { x.label = label.slice(0, 160); x.description = description.slice(0, 2000); }
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

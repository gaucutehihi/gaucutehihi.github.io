# Kho Dự Án — web tĩnh 100% miễn phí trên GitHub Pages

Trang trưng bày file dự án: khách xem folder + file + mô tả và tải về.
Chỉ bạn (admin) vào được console để tạo mục, upload file, viết ghi chú —
**console dùng chính GitHub API làm backend**, không cần server, không tốn tiền.

## Cách hoạt động
- Trang chủ (`index.html`) đọc `data.json` để hiển thị.
- Console (`admin-b7c97f.html`) đăng nhập bằng **GitHub token** của bạn, mỗi thao tác
  (tạo mục, upload, sửa, xoá) = 1 commit thẳng vào repo qua GitHub API.
- File upload nằm trong thư mục `uploads/` của repo, khách tải bằng link raw.

## Setup (làm 1 lần)

### 1. Tạo repo & bật GitHub Pages
1. Tạo repo mới trên GitHub (public), đẩy toàn bộ code này lên.
2. Repo → **Settings → Pages** → Source: **Deploy from a branch** → branch `main`, folder `/ (root)` → Save.
3. Đợi ~1 phút, trang của bạn ở `https://USERNAME.github.io/TEN-REPO/`.

### 2. Tạo token cho console
1. GitHub → **Settings → Developer settings → Personal access tokens → Fine-grained tokens** → Generate.
2. Repository access: **Only select repositories** → chọn repo này.
3. Permissions → Repository permissions → **Contents: Read and write** → Generate token.
4. Copy token (dạng `github_pat_…`).

### 3. Vào console admin
- Mở `https://USERNAME.github.io/TEN-REPO/admin-b7c97f.html`
  (đường dẫn này không có link trên trang chủ — chỉ mình bạn biết;
  muốn bí mật hơn thì đổi tên file `admin-b7c97f.html` thành tên khác, VD `abc123.html`).
- Dán token + `USERNAME/TEN-REPO` + branch `main` → Kết nối.
- Token chỉ lưu trong trình duyệt của bạn (localStorage).

## Dùng
- **Tạo mục** → đặt tên + giới thiệu.
- **Tải file lên** → chọn mục, chọn file (≤100MB), viết tên hiển thị + mô tả.
- **Quản lý** → sửa/xoá mục và file.
- Trang chủ cập nhật sau ~1 phút (GitHub Pages build lại).

## Cấu trúc
```
index.html     trang chủ (hero 3D three.js)
app.js         đọc data.json, vẽ danh sách
style.css      giao diện blueprint
admin-b7c97f.html   trang console admin (đường dẫn bí mật)
console.js     gọi GitHub API: commit data.json + uploads/
data.json      dữ liệu (console tự cập nhật — đừng sửa tay)
uploads/       file upload (console tự tạo)
```

## Lưu ý
- Token cho quyền ghi repo đó — đừng chia sẻ, đừng dán vào máy lạ.
- Repo phải **public** (GitHub Pages miễn phí chỉ chạy repo public).
- File >100MB không up được qua API (giới hạn GitHub).

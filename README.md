# Alwination — Pusat Laporan Bug

Pelacak bug interaktif untuk server Minecraft Alwination: komunitas melaporkan bug, admin memvalidasi dan memperbarui statusnya. Dikenal juga sebagai **Tracker Bug**.

## Ikhtisar

Tampilan depan adalah situs statis (HTML/CSS/JS tanpa bundler). Autentikasi memakai **Firebase Auth** (Google Sign-In). Seluruh data disimpan di **MongoDB** dan hanya diakses melalui API serverless **Vercel** (`api/*`) — browser tidak pernah menyentuh database. Setiap panggilan API menyertakan Firebase ID token yang diverifikasi server terlebih dahulu.

```
Browser (HTML + js/app.js)
   │  Firebase Auth (login Google) + panggilan fetch ke /api/*
   ▼
Vercel Serverless (api/*, Node ESM)
   │  firebase-admin: verifikasi ID token
   │  requireTrustedUser / requireAdmin: cek level akses
   ▼
MongoDB Atlas (koleksi: reports, comments, follows, access, notifications)
```

## Stack

| Lapisan  | Teknologi |
|----------|-----------|
| Frontend | HTML + CSS murni + ES Modules (Firebase Web SDK via CDN, lucide icons) |
| Backend  | Vercel Serverless Functions, Node.js ESM (`firebase-admin`, `mongodb`) |
| Database | MongoDB Atlas |
| Auth     | Firebase Authentication (Google Sign-In) |

## Struktur proyek

```
api/                    App backend (Vercel Serverless Functions)
  _lib/auth.js          Verifikasi token, level akses, username, owner email
  _lib/mongo.js         Koneksi MongoDB singleton + ensureIndexes()
  _lib/reports.js       Konstanta enum, validasi laporan, serializer
  access/index.js       POST/GET/DELETE manajemen akses (admin)
  me.js                 GET profil pengguna yang sedang login
  notifications/index.js  GET daftar notifikasi, POST tandai dibaca
  reports/index.js      GET daftar laporan, POST buat laporan
  reports/[id].js       GET detail, PATCH ubah status, DELETE hapus (admin)
  reports/[id]/follow.js   POST ikuti/berhenti ikuti
  reports/[id]/comments.js GET daftar & POST komentar
  css/style.css         Seluruh styling
  img/                  Aset
  js/                   Frontend (ES Modules, tanpa bundler)
    firebase-config.js  Konfigurasi Firebase publik (web API key)
    firebase-client.js  Inisialisasi app + auth
    auth.js             Alur login/logout, guard otentikasi per halaman
    app.js              Seluruh UI: shell, dashboard, detail, form, admin, server
  *.html                Halaman statis (index, lapor, laporan, admin, panduan, login)
  scripts/check.js      Verifikasi sintaks semua file JS (npm run check)
```

## Menjalankan lokal

1. `npm install`
2. Salin `.env.example` ke `.env.local` dan isi variabelnya (lihat tabel di bawah).
3. `npm run dev` (menjalankan `vercel dev`). Buka URL lokal yang dicetak.
4. Pastikan domain lokal (mis. `localhost`) ada di **Firebase Auth > Settings > Authorized domains**.

## Deploy ke Vercel

1. Impor repositori ini ke Vercel.
2. Atur Environment Variables berikut di **Project Settings > Environment Variables** (nilainya tak boleh di-commit):
   - `FIREBASE_SERVICE_ACCOUNT` — satu nilai JSON utuh dari Firebase service account.
   - `MONGODB_URI`, `MONGODB_DB` — URI koneksi dan nama database.
   - `TRUSTED_EMAILS`, `ADMIN_EMAILS` — daftar email dipisah koma.
3. Redeploy setelah mengubah variabel lingkungan.
4. Di Firebase Console: aktifkan Google Sign-In, lalu tambahkan domain Vercel ke **Authorized domains**.

> **Keamanan database:** batasi MongoDB Atlas Network Access ke metode koneksi Vercel. Jangan membuka database ke seluruh IP, dan jangan pernah menaruh URI / service account JSON di kode frontend atau Git.

## Variabel lingkungan

| Variabel | Deskripsi |
|----------|-----------|
| `FIREBASE_SERVICE_ACCOUNT` | JSON service account Firebase admin (server). Wajib. |
| `MONGODB_URI` | URI koneksi MongoDB. Wajib. |
| `MONGODB_DB` | Nama database (default `alwination_tracker`). |
| `TRUSTED_EMAILS` | Email (dipisah koma) berlevel `trusted`. |
| `ADMIN_EMAILS` | Email (dipisah koma) berlevel `admin`. |
| `OWNER_EMAIL` (hardcoded) | `azwarptk5@gmail.com` selalu `admin`, sumber kebenaran tertinggi. Lihat `api/_lib/auth.js`. |

**Prioritas level akses:** owner > env `ADMIN_EMAILS` > env `TRUSTED_EMAILS` > entri database (`access`). Akses tambahan/hapus lewat panel admin disimpan di koleksi `access`; peran untuk email yang dikelola env tidak bisa diubah dari panel (username-nya tetap bisa).

`js/firebase-config.js` hanya berisi konfigurasi Firebase publik dan **tidak** boleh berisi kunci akses server. Pendataan akses dilakukan murni di server.

## Model data (MongoDB)

Semua koleksi disimpan di satu database (`MONGODB_DB`). Index otomatis dibuat oleh `ensureIndexes()` di `api/_lib/mongo.js`.

| Koleksi | Contoh kolom | Catatan |
|---------|--------------|---------|
| `reports` | `title`, `category`, `priority`, `edition`, `version`, `platform`, `realm`, `description`, `steps`, `expected`, `actual`, `frequency`, `evidenceLink`, `coords`, `ticketId`, `author`, `authorEmail`, `status`, `comments`, `history[]`, `createdAt`, `updatedAt` | Setiap laporan punya `ticketId` `ALW-XXXXXXXX` dan riwayat status di `history`. |
| `comments` | `reportId`, `body`, `author`, `authorEmail`, `createdAt` | Dipisah dari `reports` agar mudah dibersihkan saat laporan dihapus. |
| `follows` | `email`, `reportId`, `createdAt` | Unik per `(email, reportId)`; dasar menu "Laporan diikuti". |
| `access` | `email`, `role` (`admin`/`trusted`), `username`, `createdAt` | Akses manual dari panel admin; `username` = nama Minecraft penulis. |
| `notifications` | `type`, `reportId`, `ticketId`, `title`, `author`, `read`, `createdAt` | Belum persis per-penerima; dipakai untuk umpan notifikasi global. |

Username (nama Minecraft) diisi admin saat menambah akses; dipakai sebagai `author` untuk laporan, komentar, dan riwayat status via `displayName()` (`api/_lib/auth.js`).

## Endpoint API

Semua endpoint memerlukan header `Authorization: Bearer <Firebase ID token>`. Server mengecek level akses per metode.

| Metode & Path | Akses | Deskripsi |
|---------------|-------|-----------|
| `GET /api/me` | trusted | Profil: email, `name`, `username`, `accessLevel`, `isAdmin`. |
| `GET /api/reports` | trusted | Daftar laporan (terbaru dulu) + flag `followed` per user. |
| `POST /api/reports` | trusted | Buat laporan. Body sesuai `validateReport()`. |
| `GET /api/reports/:id` | trusted | Detail laporan + `followed`. |
| `PATCH /api/reports/:id` | admin | Ubah status (append ke `history`). |
| `DELETE /api/reports/:id` | admin | Hapus laporan + komentarnya (transaksi). |
| `POST /api/reports/:id/follow` | trusted | Body `{ follow: boolean }` → ikuti/berhenti. |
| `GET /api/reports/:id/comments` | trusted | Daftar komentar (urut lama). |
| `POST /api/reports/:id/comments` | trusted | Tambah komentar. |
| `GET /api/notifications` | trusted | Daftar notifikasi + hitungan belum dibaca. |
| `POST /api/notifications` | trusted | Tandai semua dibaca. |
| `GET /api/access` | admin | Daftar akses (DB + env + owner) beserta `source`. |
| `POST /api/access` | admin | Tambah/ubah akses (wajib `username`). Role env jadi read-only. |
| `DELETE /api/access?email=…` | admin | Hapus akses manual (bukan env/owner). |

## Cara mengembangkan

### Menambah kategori / status / prioritas dll.
Enum dipertahankan di **dua tempat** yang harus sinkron:
1. `api/_lib/reports.js` — dipakai validasi server (sumber kebenaran).
2. `js/app.js` — dipakai UI (filter, formulir, statistik).

Tambahkan nilai baru di keduanya, lalu jalankan `npm run check`.

### Menambah route API baru
Buat file di `api/` mengikuti konvensi:
- Setiap file mengekspor `default async function handler(req, res)` (Vercel Node ESM).
- Semua endpoint dimulai dengan guard auth, contoh:
  ```js
  import { requireTrustedUser } from '../_lib/auth.js';
  export default async function handler(req, res) {
    const user = await requireTrustedUser(req, res);
    if (!user) return;
    // req.method === 'GET' | 'POST' | ...
  }
  ```
- Gunakan helper `serializeDocument` (ubah `_id` → `id`), `parseReportId`, dan `sendServerError` dari `api/_lib/reports.js`.
- Tambahkan baris di tabel endpoint README ini.

### Menambah halaman baru
1. Salin struktur halaman statis yang ada (mis. `lapor.html`): blok `<header id="topbar">`, `<aside id="sidebar">`, `<main>`, `<footer id="footer">` — semua diisi otomatis oleh `renderShell()` (`js/app.js`).
2. Beri tanda `data-nav="nama-halaman"` pada `<body>` untuk menandai menu aktif.
3. Adakan node element yang dibutuhkan lalu inisialisasi dari `DOMContentLoaded` di akhir `js/app.js` (pola `if ($('#target')) initX();`).

### Menambah koleksi MongoDB
Gunakan pola `getDatabase()` lalu `database.collection('nama')`. Tambahkan index yang relevan ke `ensureIndexes()` di `api/_lib/mongo.js`.

## Konvensi & fitur kunci UI

- **`renderShell()`** — satu sumber untuk topbar, sidebar, footer di semua halaman. Judul header di menu "Pelacak bug".
- **Gabung `Laporan saya` (#mine) & `Laporan diikuti` (#followed)** — filter tampilan lewat `location.hash` di `initDashboard()`, berbasis `authorEmail` / flag `followed`.
- **Widget status server** — `loadServerStatus()` memakai `api.mcstatus.io` (host/port di konstanta `SERVER`), polling 60 detik + saat tab fokus.
- **Draf laporan** — tersimpan otomatis di `localStorage` (`alwination-bug-draft`), dihapus setelah laporan sukses dikirim.
- **Sesi API** — `authReady()` menunggu sesi Firebase pulih sebelum panggilan API; `apiRequest()` otomatis retry sekali saat token kedaluwarsa (refresh token).
- **Akses panel admin** — sidebar hanya tampil untuk admin; halaman `admin.html` me-redirect non-admin yang sudah pasti.

## Script npm

| Perintah | Fungsi |
|----------|--------|
| `npm run dev` | Jalankan via `vercel dev` (perlu akun Vercel). |
| `npm run check` | Lint-tingkat-sintaks: `node --check` untuk semua `.js` di `js/` dan `api/` (tanpa dependensi tambahan). |

## Keamanan

- Browser tidak pernah menyimpan/berinteraksi langsung dengan MongoDB; semua akses lewat API yang memverifikasi token Firebase.
- Tidak ada kunci privat di repositori. `firebase-config.js` hanya berisi konfigurasi publik.
- Hapus data (laporan) serta kelola akses hanya untuk admin.
- Jika kredensial pernah bocor, rotasi segera (MongoDB URI, service account).
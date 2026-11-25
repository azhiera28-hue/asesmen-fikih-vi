# Asesmen Sumatif Akhir Semester

Aplikasi ujian daring anti curang untuk **MIN 5 Sukabumi · Fikih · Kelas VI · Guru: Ani Handayani**.

- Halaman siswa dan panel guru berjalan di **GitHub Pages** (gratis).
- Data soal, pengaturan, pelanggaran, dan nilai tersimpan di **Google Sheet** milik Ibu.
- Penghubungnya adalah **Google Apps Script** (gratis, ikut akun Google Ibu).

## Isi

| Fitur | Keterangan |
|---|---|
| Layar penuh wajib | Ujian dimulai dengan layar penuh. Keluar dari layar penuh ditutup layar penghalang dan dicatat. |
| Deteksi curang | Pindah tab, pindah jendela, keluar layar penuh, terlalu lama di luar halaman, klik kanan, salin/tempel, tombol F12/Ctrl+U/Ctrl+P, muat ulang halaman. |
| Poin pelanggaran | Tiap jenis pelanggaran punya poin sendiri yang bisa diatur guru. |
| Batas pelanggaran | Bila total poin mencapai batas, ujian siswa **dihentikan otomatis**. Jawaban yang sudah masuk tetap dinilai (atau diberi nilai 0, sesuai pengaturan). |
| Nilai otomatis | Setelah selesai, waktu habis, atau dihentikan, nilai langsung masuk sheet **Nilai**. |
| Jenis soal | Pilihan ganda, pilihan ganda kompleks, benar/salah, isian singkat, dan soal bergambar. |
| Impor soal | Excel (.xlsx/.csv), Word (.docx, gambar ikut terbawa), PDF berteks, teks (.txt), JSON. |
| Ekspor soal | Excel dan JSON (gambar ikut tersimpan di dalam JSON). |
| Panel guru | Buka/tutup ujian, token, pantau siswa langsung, hentikan atau beri kesempatan ulang, lihat hasil, unduh nilai. |

## Isi folder

```
index.html            halaman siswa
admin.html            panel guru
config.js             satu-satunya berkas yang harus Ibu ubah (URL Apps Script)
assets/               tampilan dan program (jangan diubah)
lib/                  pustaka untuk membaca Excel, Word, PDF (jangan diubah)
apps-script/Code.gs   kode untuk Google Apps Script
contoh/               contoh 17 soal Fikih kelas VI (xlsx dan txt)
test/                 pengujian otomatis (boleh diabaikan atau dihapus)
```

---

# TUTORIAL PEMASANGAN

Waktu yang dibutuhkan sekitar 30 menit. Kerjakan **berurutan**. Siapkan:

- Akun **Google** (Gmail) milik Ibu.
- Akun **GitHub**. Jika belum punya, daftar gratis di <https://github.com/signup>.
- Laptop atau PC dengan browser Chrome.
- Berkas aplikasi ini (hasil unduhan, sudah diekstrak dari ZIP).

## BAGIAN A. Google Sheet dan Apps Script

### Langkah 1. Buat Google Sheet

1. Buka <https://sheets.google.com> dan masuk dengan akun Google Ibu.
2. Klik **Kosong** (Blank spreadsheet).
3. Klik judul "Spreadsheet tanpa judul", ganti dengan: `Asesmen Fikih VI - MIN 5 Sukabumi`.

> **Penting:** jangan bagikan (share) sheet ini kepada siswa. Sheet berisi kunci jawaban dan password guru. Siswa tidak perlu mengakses sheet; mereka hanya membuka halaman ujian.

### Langkah 2. Pasang kode Apps Script

1. Di Google Sheet, klik menu **Ekstensi → Apps Script**. Tab baru akan terbuka.
2. Di sisi kiri ada berkas bernama `Code.gs` yang berisi `function myFunction() {}`. **Hapus semua isinya.**
3. Buka berkas `apps-script/Code.gs` dari folder aplikasi (pakai Notepad atau aplikasi teks), tekan **Ctrl+A** lalu **Ctrl+C**.
4. Kembali ke Apps Script, klik di area kode, tekan **Ctrl+V**.
5. Klik ikon disket (**Simpan**) atau tekan **Ctrl+S**. Beri nama proyek: `Asesmen Fikih VI`.

*(Opsional)* Agar zona waktu pasti WIB: klik ikon roda gigi **Setelan proyek**, centang **Tampilkan file manifes "appsscript.json" di editor**, buka `appsscript.json` dan samakan isinya dengan `apps-script/appsscript.json` dari folder aplikasi.

### Langkah 3. Jalankan `setup` dan beri izin

1. Di bagian atas editor ada kotak pilihan fungsi. Pilih **`setup`**.
2. Klik **Jalankan** (Run).
3. Akan muncul **"Perlu otorisasi"**. Klik **Tinjau izin**, pilih akun Google Ibu.
4. Akan muncul layar peringatan **"Google belum memverifikasi aplikasi ini"**. Ini normal karena aplikasi dibuat sendiri oleh Ibu. Klik **Lanjutan (Advanced)** lalu **Buka Asesmen Fikih VI (tidak aman)**, kemudian klik **Izinkan**.
5. Tunggu sampai tulisan **"Eksekusi selesai"** muncul di log.
6. Kembali ke tab Google Sheet. Di bagian bawah sudah ada sheet baru: **Pengaturan, Soal, Siswa, Sesi, Pelanggaran, Nilai**. Di sheet Soal sudah ada 5 soal contoh.

> Izin Drive dipakai hanya untuk menyimpan **gambar soal** di folder Drive Ibu. Izin Sheet dipakai untuk membaca soal dan menulis nilai.

### Langkah 4. Atur sheet "Pengaturan"

Buka sheet **Pengaturan**. Kolom A adalah nama pengaturan, kolom B adalah nilainya (yang diubah), kolom C adalah penjelasan.

**WAJIB diganti sebelum ujian:**

| Baris | Ganti dengan |
|---|---|
| `password_guru` | Password rahasia Ibu (minimal 6 karakter) untuk masuk ke panel guru. **Tulisan `GANTI-PASSWORD-INI` akan ditolak oleh sistem.** |

**Pengaturan lain yang sudah terisi sesuai permintaan Ibu** (bisa diubah kapan saja, juga lewat panel guru):

| Pengaturan | Isi awal |
|---|---|
| `judul_aplikasi` | Asesmen Sumatif Akhir Semester |
| `nama_sekolah` | MIN 5 Sukabumi |
| `mapel` / `kelas` / `guru` | Fikih / VI / Ani Handayani |
| `tahun_ajaran` / `semester` | 2026/2027 / Ganjil. Ubah sesuai kenyataan (misalnya Genap). |
| `durasi_menit` | 60 |
| `kkm` | 75 |
| `maks_poin_pelanggaran` | 5 (ujian dihentikan bila total poin ≥ 5) |
| `poin_pindah_tab` | 2 |
| `poin_keluar_layar_penuh` | 2 |
| `poin_pindah_jendela` | 1 |
| `poin_lama_di_luar` + `interval_detik_di_luar` | +1 poin tiap 30 detik di luar halaman |
| `poin_klik_kanan`, `poin_salin_tempel`, `poin_shortcut` | 1 |
| `poin_muat_ulang` | 2 |
| `status_ujian` | DITUTUP (dibuka saat ujian dimulai) |

**Contoh mengatur ketegasan:**

- Ingin ujian langsung dihentikan pada pelanggaran pertama? Isi `maks_poin_pelanggaran` = 1 dan `poin_pindah_tab` = 1.
- Ingin hanya mencatat tanpa menghentikan? Isi `maks_poin_pelanggaran` = 0.
- Ingin pelanggaran tertentu tidak dihitung? Isi poinnya 0.

> Sheet menyimpan angka sebagai teks. Itu normal, jangan khawatir.

### Langkah 5. Terapkan sebagai Aplikasi Web (Deploy)

1. Kembali ke tab **Apps Script**.
2. Klik **Terapkan (Deploy)** di kanan atas → **Deployment baru (New deployment)**.
3. Klik ikon roda gigi di samping "Pilih jenis" → pilih **Aplikasi web (Web app)**.
4. Isi:
   - **Deskripsi:** `versi 1`
   - **Jalankan sebagai (Execute as):** **Saya (email Ibu)**
   - **Yang memiliki akses (Who has access):** **Siapa saja (Anyone)**
5. Klik **Terapkan (Deploy)**. Jika diminta izin lagi, ikuti lagi langkah izin seperti tadi.
6. Salin **URL aplikasi web**. Bentuknya:

   ```
   https://script.google.com/macros/s/AKfycb.........................../exec
   ```

   **Simpan URL ini di Notepad.** Pastikan berakhiran `/exec`.

> Pilihan "Siapa saja" hanya berarti halaman ujian bisa menghubungi skrip. Isi sheet tetap tidak bisa dibuka siapa pun. Panel guru dikunci password, dan kunci jawaban tidak pernah dikirim ke browser siswa.

**Cek cepat:** tempel URL `/exec` di browser. Jika muncul tulisan seperti `{"ok":true,"app":"Asesmen Sumatif",...}`, berarti benar. Jika muncul halaman login Google atau error, ulangi pilihan "Siapa saja" di langkah 4.

---

## BAGIAN B. GitHub dan GitHub Pages

### Langkah 6. Isi `config.js`

1. Buka berkas `config.js` di folder aplikasi dengan Notepad.
2. Ganti tulisan `GANTI_DENGAN_URL_APPS_SCRIPT_ANDA` dengan URL `/exec` dari langkah 5. Hasilnya:

   ```js
   window.APP_CONFIG = {
     API_URL: "https://script.google.com/macros/s/AKfycb.../exec"
   };
   ```

3. Simpan. Jangan hapus tanda kutip.

### Langkah 7. Buat repositori GitHub

1. Masuk ke <https://github.com>, klik tanda **+** di kanan atas → **New repository**.
2. Isi:
   - **Repository name:** `asesmen-fikih-vi`
   - **Public** (wajib Public agar GitHub Pages gratis).
   - Jangan centang "Add a README".
3. Klik **Create repository**.

### Langkah 8. Unggah berkas (tanpa instal apa pun)

1. Di halaman repositori yang baru dibuat, klik tautan **uploading an existing file**.
2. Buka folder aplikasi di komputer. Pilih **semua isi di dalamnya** (`index.html`, `admin.html`, `config.js`, `README.md`, folder `assets`, `lib`, `apps-script`, `contoh`, dan file lainnya), lalu **seret ke halaman GitHub**.

   > Seret **isi** folder, bukan folder induknya. `index.html` harus berada di tingkat paling atas repositori.
   > Folder `test` tidak wajib diunggah.

3. Tunggu semua berkas selesai diunggah (garis kemajuan penuh).
4. Pada kotak **Commit changes**, klik tombol hijau **Commit changes**.
5. Periksa: halaman repositori harus menampilkan `index.html`, `admin.html`, `config.js`, `assets`, `lib` di daftar berkas.

> Jika folder `lib` atau `assets` gagal terunggah karena banyak berkas, unggah ulang folder itu sendiri dengan cara yang sama.

### Langkah 9. Aktifkan GitHub Pages

1. Di repositori, klik **Settings** (roda gigi) → menu kiri **Pages**.
2. Di bagian **Build and deployment**, pada **Source** pilih **Deploy from a branch**.
3. Pada **Branch** pilih **main**, folder **/ (root)**, klik **Save**.
4. Tunggu 1 sampai 3 menit, lalu muat ulang halaman Pages. Akan muncul tulisan:

   > Your site is live at `https://NAMA-GITHUB-ANDA.github.io/asesmen-fikih-vi/`

   Ini adalah **alamat ujian untuk siswa**. Panel guru ada di alamat yang sama dengan tambahan `admin.html`:

   - Siswa: `https://NAMA-GITHUB-ANDA.github.io/asesmen-fikih-vi/`
   - Guru: `https://NAMA-GITHUB-ANDA.github.io/asesmen-fikih-vi/admin.html`

> Untuk memendekkan alamat bagi siswa, gunakan pemendek tautan atau buat kode QR agar mudah dipindai.

---

## BAGIAN C. Mencoba dan Menggunakan

### Langkah 10. Masuk ke Panel Guru

1. Buka alamat `.../admin.html`.
2. Masukkan **password_guru** yang Ibu isi di sheet.
3. Jika berhasil, tampil panel dengan tab: **Pantau ujian, Bank soal, Pengaturan, Daftar siswa, Hasil & nilai, Log pelanggaran**.

Jika muncul pesan *"Alamat server belum diatur"*, berarti `config.js` belum benar (kembali ke langkah 6, lalu unggah ulang `config.js` ke GitHub: buka berkasnya → ikon pensil → ganti → Commit). Perubahan di GitHub Pages butuh 1 sampai 2 menit untuk aktif.

### Langkah 11. Masukkan soal Ibu

Di tab **Bank soal**:

- **Impor soal dari file** → pilih berkas Excel, Word, PDF, teks, atau JSON (boleh beberapa berkas sekaligus).
- Akan muncul **pratinjau**. Periksa tipe, pertanyaan, dan kunci. Soal bertanda merah perlu diperbaiki.
- Klik **Masukkan ke bank soal**, lalu klik **Simpan soal** (tombol kuning di atas) agar tersimpan ke Google Sheet.
- Untuk mengubah satu soal, klik **Ubah**. Di sana Ibu juga bisa memilih gambar dari komputer atau menempel alamat gambar.

#### Format yang dibaca dengan baik

**1. Excel / CSV.** Gunakan judul kolom seperti di tombol **Unduh template Excel**:

| No | Tipe | Pertanyaan | Opsi A | Opsi B | Opsi C | Opsi D | Opsi E | Kunci | Bobot | Gambar (URL) |
|---|---|---|---|---|---|---|---|---|---|---|

- **Tipe:** `PG` (pilihan ganda), `PGK` (pilihan ganda kompleks), `BS` (benar/salah), `ISIAN` (isian singkat).
- **Kunci:** PG = satu huruf (`B`); PGK = huruf dipisah koma (`A,C,D`); BS = `BENAR` atau `SALAH`; ISIAN = jawaban yang diterima dipisah `|` (`wudu|wudhu`).
- **Bobot:** kosong dianggap 1.

**2. Word (.docx), PDF berteks, Teks (.txt).** Tulis dengan pola:

```
1. Zakat yang dikeluarkan pada bulan Ramadan disebut zakat ....
A. mal
B. fitrah
C. profesi
D. perdagangan
Kunci: B

2. Berikut yang termasuk penerima zakat adalah ....
A. fakir
B. miskin
C. orang kaya
D. amil
Kunci: A,B,D

3. Zakat fitrah hanya wajib bagi orang dewasa.
Kunci: Salah

4. Bersuci dari hadas kecil disebut ....
Kunci: wudu | wudhu
```

- Nomor soal harus berawalan `1.` atau `1)`. Pilihan berawalan `A.` atau `A)`.
- Tipe dikenali otomatis: ada pilihan → PG; kunci lebih dari satu huruf → PGK; kunci Benar/Salah tanpa pilihan → BS; sisanya → isian.
- Boleh juga memakai **daftar kunci di akhir dokumen**:

  ```
  KUNCI JAWABAN
  1. B   2. A   3. C
  ```

- **Word dengan gambar:** gambar yang ada di soal ikut terbawa. Saat soal disimpan, gambar diperkecil dan diunggah otomatis ke folder Drive Ibu.
- **PDF:** hanya PDF yang berisi teks yang bisa dibaca (bukan hasil pindai/foto). PDF tidak membawa gambar. Tambahkan gambar lewat tombol **Ubah**.

**3. JSON.** Hasil dari tombol **Ekspor JSON + gambar**. Berguna untuk memindahkan bank soal bergambar ke sheet lain atau ke Ibu guru lain. Gambar ikut dalam berkas dan diunggah ulang saat diimpor.

#### Soal bergambar

- Dari komputer: **Ubah soal → Gambar → pilih berkas**.
- Dari Word: gambar ikut otomatis.
- Dari internet/Drive: tempel alamat gambar. Gambar harus bisa dibuka tanpa login (untuk Drive: Bagikan → Siapa saja yang memiliki link).

### Langkah 12. Uji coba sebelum hari ujian (wajib)

1. Di tab **Pengaturan**, atur durasi singkat bila perlu, lalu di tab **Pantau ujian** klik **Buka ujian**. Klik **Buat token baru** bila ingin memakai token.
2. Dari **HP atau laptop lain**, buka alamat siswa, isi data, dan mulai ujian.
3. Coba: pindah tab, tekan Esc, klik kanan. Pastikan poin bertambah dan ujian berhenti saat mencapai batas.
4. Selesaikan satu ujian dan buka sheet **Nilai** untuk memastikan nilai masuk.
5. Setelah yakin: tab **Hasil & nilai** → **Hapus semua data uji coba** (ketik `HAPUS`). Soal dan pengaturan tidak terhapus.

### Langkah 13. Hari pelaksanaan

1. Pastikan `password_guru` sudah diganti dan soal sudah disimpan.
2. Siswa memakai **laptop/Chromebook/tablet atau HP Android dengan Chrome**. Siswa **iPhone belum didukung** karena iPhone tidak menyediakan layar penuh untuk halaman web.
3. Bagikan alamat siswa (atau kode QR) dan **token** yang tampil di tab Pantau ujian.
4. Klik **Buka ujian**. Pantau siswa secara langsung. Kolom **Poin** menunjukkan pelanggaran tiap siswa.
5. Bila ada siswa yang terputus (baterai habis, HP mati), siswa bisa masuk lagi dengan nama dan nomor yang sama: ujian **dilanjutkan** dari jawaban terakhir dan waktu tetap berjalan. Masuk ulang dicatat sebagai pelanggaran (poinnya diatur di `poin_muat_ulang`).
6. Bila siswa mengalami gangguan teknis yang bukan kesalahannya, klik **Beri kesempatan ulang** pada baris siswa itu. Nilainya dihapus dan siswa bisa mengerjakan dari awal.
7. Setelah semua selesai, klik **Tutup ujian**, lalu buka tab **Hasil & nilai** → **Unduh nilai (Excel)**. Nilai juga ada di sheet **Nilai**.

---

## Cara kerja aturan anti curang

1. Siswa mengisi nama, nomor, dan token, menyetujui tata tertib, lalu menekan **Mulai**. Browser masuk ke layar penuh.
2. Selama ujian, aplikasi memantau layar penuh, tab aktif, dan fokus jendela. Bila siswa keluar, layar ditutup penghalang **"Kembali ke layar penuh"** dan pelanggaran dikirim ke server.
3. Server menambah poin sesuai pengaturan, mencatat di sheet **Pelanggaran**, dan menghitung total. Penghitungan dilakukan **di server**, bukan di browser siswa, sehingga tidak bisa dimanipulasi dari sisi siswa.
4. Bila total poin ≥ batas, server mengakhiri ujian, menilai jawaban yang sudah masuk, dan menulis ke sheet **Nilai**.
5. Waktu ujian dihitung oleh server. Mengubah jam di perangkat tidak berpengaruh.
6. Soal dan opsi diacak per siswa (bisa dimatikan). Kunci jawaban tidak pernah dikirim ke browser siswa.

### Batasan yang perlu Ibu ketahui

Aplikasi berbasis web **tidak bisa menjamin 100% bebas curang**. Aplikasi ini efektif untuk mencegah dan mencatat kecurangan yang umum, namun:

- Siswa yang memakai **perangkat lain** (HP kedua, buku, teman) tidak terdeteksi. Pengawasan guru di kelas tetap diperlukan.
- Beberapa **pintasan sistem** (misalnya Alt+Tab atau tombol Windows) hanya bisa dideteksi setelah halaman kehilangan fokus. Pelanggarannya tetap tercatat, tetapi tidak bisa dicegah sebelum terjadi.
- Layar penuh dikendalikan browser. Siswa bisa keluar dengan tombol Esc, dan itu dicatat sebagai pelanggaran.
- **iPhone** tidak mendukung layar penuh di web. iPad belum diuji.
- Deteksi "pindah jendela" dapat salah pada beberapa perangkat (misalnya notifikasi sistem merebut fokus). Karena itu, kedipan fokus yang sangat singkat tidak dihitung, dan Ibu dapat mengatur poin `poin_pindah_jendela` menjadi 0 bila banyak kasus keliru. Periksa **Log pelanggaran** sebelum memutuskan sanksi.

Saran: umumkan aturan di awal, pakai token yang dibagikan saat ujian dimulai, dan tetap awasi kelas.

---

## Mengubah kode setelah deploy

Bila Ibu mengubah `Code.gs` di kemudian hari, perubahan **tidak otomatis aktif**:

1. Di Apps Script: **Terapkan → Kelola deployment**.
2. Klik ikon pensil pada deployment yang aktif.
3. Pada **Versi** pilih **Versi baru**, lalu klik **Terapkan**.

URL tetap sama, jadi `config.js` tidak perlu diubah. Jangan memakai "Deployment baru" karena itu menghasilkan URL baru.

## Batas penggunaan Google (kuota)

- Apps Script gratis dapat menangani sekitar **30 permintaan bersamaan**. Untuk kelas hingga sekitar 30 sampai 40 siswa ini aman, karena aplikasi mengirim data hanya tiap 20 detik dan saat ada kejadian.
- Agar lancar, **jangan semua siswa menekan Mulai pada detik yang sama**. Beri aba-aba bertahap, atau bagikan token bergiliran per baris bangku.
- Kuota harian akun Google gratis sangat longgar untuk satu kelas, tetapi bila ujian dipakai satu angkatan sekaligus, bagi menjadi beberapa sesi.

## Menyimpan cadangan

- Soal: **Ekspor Excel** dan **Ekspor JSON + gambar** dari tab Bank soal.
- Nilai: **Unduh nilai (Excel)** setelah ujian.
- Atau di Google Sheet: **File → Buat salinan**.

---

## Pemecahan masalah

| Gejala | Penyebab dan solusi |
|---|---|
| "Alamat server belum diatur" | `config.js` belum diisi atau belum diunggah ulang ke GitHub. Ulangi langkah 6. |
| "Server tidak memberi jawaban yang valid" | Deploy belum diatur **Siapa saja**, atau URL bukan yang berakhiran `/exec`. Ulangi langkah 5. |
| "Sheet ... belum ada" | Fungsi `setup` belum dijalankan. Jalankan di langkah 3. |
| "Password guru masih bawaan" | Ganti nilai `password_guru` di sheet Pengaturan. |
| "Ujian belum dibuka" | Klik **Buka ujian** di tab Pantau ujian. |
| "Token ujian salah" | Gunakan token yang tampil di tab Pantau ujian (huruf besar/kecil tidak berpengaruh). |
| Siswa tidak bisa memulai (layar penuh ditolak) | Gunakan Chrome di laptop/Android. Pastikan tidak membuka lewat aplikasi lain (misalnya dari dalam WhatsApp); salin tautan lalu buka di Chrome. |
| Gambar soal tidak tampil | Pastikan gambar dapat dibuka tanpa login. Gambar yang diunggah lewat panel guru diatur otomatis menjadi "siapa saja yang memiliki link". Bila akun sekolah (Google Workspace) melarang berbagi publik, gunakan alamat gambar dari tempat lain. |
| Perubahan di GitHub belum terlihat | Tunggu 1 sampai 3 menit, lalu tekan **Ctrl+F5**. |
| Soal tidak bisa disimpan: "ada siswa yang sedang mengerjakan" | Tunggu ujian selesai atau tutup ujian lebih dulu. Hal ini mencegah soal berubah di tengah ujian. |
| Hasil impor Word berantakan | Pastikan penomoran tertulis sebagai teks (`1.`, `A.`) atau memakai daftar bernomor Word. Gunakan pratinjau untuk memeriksa, atau gunakan template Excel. |
| PDF "tampaknya hasil pindai" | PDF berupa foto. Ketik ulang di Word/Excel, atau gunakan PDF yang teksnya bisa diblok. |
| Lupa password guru | Buka Google Sheet → sheet Pengaturan → lihat nilai `password_guru` atau ganti. |
| Ingin mengulang dari awal | Panel guru → Hasil & nilai → **Hapus semua data uji coba**. Atau menu **Asesmen → Hapus data hasil uji coba** di Google Sheet. |

## Keamanan dan privasi

- **Jangan bagikan Google Sheet** kepada siswa.
- Jangan membagikan alamat `admin.html` dan password guru.
- Repositori GitHub bersifat Public, jadi **jangan menaruh soal atau kunci jawaban di berkas repositori**. Soal hanya disimpan di Google Sheet. Folder `contoh` hanya berisi soal contoh.
- Data siswa yang diminta hanya nama, nomor absen/NISN, dan kelas.
- Aplikasi tidak memakai kamera atau mikrofon dan tidak merekam layar.

## Struktur sheet (untuk yang ingin tahu)

| Sheet | Isi |
|---|---|
| Pengaturan | Semua pengaturan (dapat diedit langsung). |
| Soal | Bank soal. Dapat diedit langsung. Setelah mengedit, tunggu sekitar 1 menit agar siswa memperoleh data terbaru. |
| Siswa | Daftar siswa terdaftar (dipakai bila "hanya siswa terdaftar" = YA). |
| Sesi | Satu baris per siswa: status, poin, jawaban. |
| Pelanggaran | Catatan setiap pelanggaran: waktu, siswa, jenis, poin. |
| Nilai | Hasil akhir: benar, salah, kosong, nilai, status, ketuntasan. **Ini sheet yang dipakai untuk rekap.** |

**Rumus nilai:** nilai = (jumlah bobot soal yang benar ÷ total bobot semua soal) × 100.

## Pengujian otomatis (opsional)

Folder `test` berisi pengujian untuk pengembang. Dijalankan dengan Node.js:

```
node test/test-backend.js
node test/test-parser.js
node test/test-sample.js
```

---

Dibuat untuk MIN 5 Sukabumi. Semoga bermanfaat dan barakallahu fiik.

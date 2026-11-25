/**
 * =====================================================================
 *  ASESMEN SUMATIF AKHIR SEMESTER — Backend (Google Apps Script)
 *  MIN 5 Sukabumi · Fikih · Kelas VI · Guru: Ani Handayani
 * =====================================================================
 *  Cara pakai singkat:
 *   1. Buka Google Sheet > Ekstensi > Apps Script, hapus isi lama, tempel seluruh kode ini.
 *   2. Jalankan fungsi  setup  (sekali saja) lalu izinkan akses.
 *   3. Terapkan > Deployment baru > Aplikasi web (Akses: Siapa saja).
 *   4. Salin URL berakhiran /exec ke file config.js di GitHub.
 *  Panduan lengkap: lihat README.md
 */

var APP = { VERSION: '1.0.0' };
var SH = { SET: 'Pengaturan', SOAL: 'Soal', SISWA: 'Siswa', SESI: 'Sesi', PEL: 'Pelanggaran', NILAI: 'Nilai' };
var DEFAULT_PASSWORD = 'GANTI-PASSWORD-INI';
var GRACE_MS = 25000; // toleransi keterlambatan kirim jawaban akhir

// Kolom sheet "Sesi"
var C = { SID: 1, NISN: 2, NAMA: 3, KELAS: 4, MULAI: 5, BATAS: 6, POIN: 7, STATUS: 8, JAWAB: 9, AKTIF: 10, URUTAN: 11, LOGIN: 12, UA: 13, MULAIMS: 14, HASIL: 15 };

var SESI_HEADER = ['SesiID', 'NISN / No. Absen', 'Nama', 'Kelas', 'Mulai', 'Batas Waktu (ms)', 'Poin Pelanggaran', 'Status', 'Jawaban (JSON)', 'Terakhir Aktif', 'Urutan Soal (JSON)', 'Login Ke-', 'Perangkat', 'Mulai (ms)', 'Hasil (JSON)'];
var NILAI_HEADER = ['Waktu Selesai', 'NISN / No. Absen', 'Nama', 'Kelas', 'Benar', 'Salah', 'Kosong', 'Nilai', 'Status', 'Poin Pelanggaran', 'Durasi (menit)', 'Ketuntasan', 'SesiID'];
var PEL_HEADER = ['Waktu', 'SesiID', 'NISN / No. Absen', 'Nama', 'Jenis Pelanggaran', 'Poin', 'Total Poin', 'Keterangan'];
var SOAL_HEADER = ['No', 'Tipe', 'Pertanyaan', 'Opsi A', 'Opsi B', 'Opsi C', 'Opsi D', 'Opsi E', 'Kunci', 'Bobot', 'Gambar (URL)'];
var SISWA_HEADER = ['NISN / No. Absen', 'Nama', 'Kelas', 'PIN (opsional)'];

var SET_DEFAULTS = [
  ['judul_aplikasi', 'Asesmen Sumatif Akhir Semester', 'Judul yang tampil di halaman siswa'],
  ['nama_sekolah', 'MIN 5 Sukabumi', 'Nama sekolah / madrasah'],
  ['mapel', 'Fikih', 'Mata pelajaran'],
  ['kelas', 'VI', 'Kelas'],
  ['guru', 'Ani Handayani', 'Nama guru'],
  ['tahun_ajaran', '2026/2027', 'Tahun ajaran'],
  ['semester', 'Ganjil', 'Ganjil atau Genap'],
  ['password_guru', DEFAULT_PASSWORD, 'WAJIB DIGANTI. Password untuk membuka halaman guru (admin.html)'],
  ['status_ujian', 'DITUTUP', 'DIBUKA = siswa bisa masuk; DITUTUP = siswa tidak bisa masuk'],
  ['token_ujian', '', 'Kode yang dibagikan guru saat ujian. Kosongkan bila tidak perlu token'],
  ['durasi_menit', '60', 'Lama ujian (menit)'],
  ['kkm', '75', 'Kriteria Ketuntasan Minimal'],
  ['acak_soal', 'YA', 'YA / TIDAK: urutan soal diacak untuk tiap siswa'],
  ['acak_opsi', 'YA', 'YA / TIDAK: urutan pilihan diacak. Pilih TIDAK bila ada opsi seperti "semua benar"'],
  ['tampilkan_nilai_ke_siswa', 'TIDAK', 'YA = nilai langsung tampil di layar siswa setelah selesai'],
  ['hanya_siswa_terdaftar', 'TIDAK', 'YA = hanya siswa yang ada di sheet "Siswa" yang boleh masuk'],
  ['maks_poin_pelanggaran', '5', 'Jika total poin >= angka ini, ujian otomatis dihentikan. 0 = tidak dibatasi (hanya dicatat)'],
  ['poin_pindah_tab', '2', 'Poin: membuka tab lain / menyembunyikan halaman ujian'],
  ['poin_keluar_layar_penuh', '2', 'Poin: keluar dari mode layar penuh'],
  ['poin_pindah_jendela', '1', 'Poin: pindah ke aplikasi / jendela lain'],
  ['poin_lama_di_luar', '1', 'Poin tambahan untuk setiap interval waktu siswa berada di luar halaman ujian'],
  ['interval_detik_di_luar', '30', 'Interval (detik) untuk poin_lama_di_luar. 0 = nonaktif'],
  ['poin_klik_kanan', '1', 'Poin: klik kanan'],
  ['poin_salin_tempel', '1', 'Poin: salin / tempel / potong'],
  ['poin_shortcut', '1', 'Poin: tombol terlarang (F12, Ctrl+U, Ctrl+P, dst.)'],
  ['poin_muat_ulang', '2', 'Poin: memuat ulang halaman / login ulang saat ujian berjalan'],
  ['nilai_saat_dihentikan', 'TERSIMPAN', 'TERSIMPAN = nilai dihitung dari jawaban yang sudah masuk; NOL = nilai 0'],
  ['catatan_guru', 'Berdoalah sebelum mengerjakan. Kerjakan dengan jujur dan teliti.', 'Pesan yang tampil sebelum ujian dimulai']
];

var VIOL = {
  PINDAH_TAB: 'poin_pindah_tab',
  KELUAR_LAYAR_PENUH: 'poin_keluar_layar_penuh',
  PINDAH_JENDELA: 'poin_pindah_jendela',
  LAMA_DI_LUAR: 'poin_lama_di_luar',
  KLIK_KANAN: 'poin_klik_kanan',
  SALIN_TEMPEL: 'poin_salin_tempel',
  SHORTCUT_TERLARANG: 'poin_shortcut',
  MUAT_ULANG: 'poin_muat_ulang'
};

/* ===================== MENU & SETUP ===================== */

function onOpen() {
  try {
    SpreadsheetApp.getUi().createMenu('Asesmen')
      .addItem('Siapkan / perbaiki sheet', 'setup')
      .addItem('Buka ujian', 'bukaUjian')
      .addItem('Tutup ujian', 'tutupUjian')
      .addSeparator()
      .addItem('Hapus data hasil uji coba', 'hapusDataUjian')
      .addToUi();
  } catch (e) {}
}

function bukaUjian() { setSetting_('status_ujian', 'DIBUKA'); toast_('Ujian DIBUKA'); }
function tutupUjian() { setSetting_('status_ujian', 'DITUTUP'); toast_('Ujian DITUTUP'); }

function hapusDataUjian() {
  var ui = SpreadsheetApp.getUi();
  var r = ui.alert('Hapus semua data sesi, pelanggaran, dan nilai?', 'Soal dan pengaturan tidak ikut terhapus. Tindakan ini tidak bisa dibatalkan.', ui.ButtonSet.YES_NO);
  if (r === ui.Button.YES) { clearData_(); toast_('Data ujian dihapus'); }
}

function toast_(m) { try { ss_().toast(m); } catch (e) {} Logger.log(m); }

function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('Skrip harus dibuka lewat Google Sheet: menu Ekstensi > Apps Script.');
  PropertiesService.getScriptProperties().setProperty('SS_ID', ss.getId());
  try { ss.setSpreadsheetTimeZone('Asia/Jakarta'); } catch (e) {}

  var set = ensureSheet_(ss, SH.SET, ['Kunci', 'Nilai', 'Keterangan']);
  var soalBaru = !ss.getSheetByName(SH.SOAL);
  var soal = ensureSheet_(ss, SH.SOAL, SOAL_HEADER);
  ensureSheet_(ss, SH.SISWA, SISWA_HEADER);
  ensureSheet_(ss, SH.SESI, SESI_HEADER);
  ensureSheet_(ss, SH.PEL, PEL_HEADER);
  ensureSheet_(ss, SH.NILAI, NILAI_HEADER);

  // isi pengaturan bawaan yang belum ada
  var existing = {};
  var rows = set.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) existing[String(rows[i][0]).trim()] = true;
  var add = [];
  SET_DEFAULTS.forEach(function (d) { if (!existing[d[0]]) add.push([d[0], d[1], d[2]]); });
  if (add.length) {
    var start = set.getLastRow() + 1;
    set.getRange(start, 1, add.length, 3).setNumberFormat('@').setValues(add);
  }
  safe_(function () {
    set.getRange('B:B').setNumberFormat('@');
    set.setColumnWidth(1, 220); set.setColumnWidth(2, 260); set.setColumnWidth(3, 520);
  });

  // format teks agar rumus / angka tidak diubah otomatis
  safe_(function () {
    soal.getRange('B2:I1000').setNumberFormat('@');
    soal.getRange('K2:K1000').setNumberFormat('@');
    soal.setColumnWidth(3, 420);
    ss.getSheetByName(SH.SESI).getRange('B:E').setNumberFormat('@');
    ss.getSheetByName(SH.SESI).getRange('J:J').setNumberFormat('@');
    ss.getSheetByName(SH.NILAI).getRange('A:D').setNumberFormat('@');
    ss.getSheetByName(SH.NILAI).getRange('I:I').setNumberFormat('@');
    ss.getSheetByName(SH.NILAI).getRange('L:L').setNumberFormat('@');
    ss.getSheetByName(SH.PEL).getRange('A:A').setNumberFormat('@');
    ss.getSheetByName(SH.PEL).getRange('C:D').setNumberFormat('@');
    ss.getSheetByName(SH.SISWA).getRange('A:D').setNumberFormat('@');
    var dv = SpreadsheetApp.newDataValidation().requireValueInList(['PG', 'PGK', 'BS', 'ISIAN'], true).build();
    soal.getRange('B2:B1000').setDataValidation(dv);
  });

  if (soalBaru) seedSoal_(soal);
  cacheClear_();
  toast_('Setup selesai. Lanjutkan ke langkah Deploy.');
  return 'OK';
}

function ensureSheet_(ss, name, header) {
  var sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  if (sh.getLastRow() < 1) {
    sh.getRange(1, 1, 1, header.length).setValues([header]);
  }
  safe_(function () {
    sh.getRange(1, 1, 1, header.length).setFontWeight('bold').setBackground('#0e4a43').setFontColor('#ffffff');
    sh.setFrozenRows(1);
  });
  return sh;
}

function safe_(fn) { try { fn(); } catch (e) {} }

function seedSoal_(sh) {
  var rows = [
    [1, 'PG', 'Zakat yang wajib dikeluarkan pada bulan Ramadan sebelum salat Idulfitri disebut zakat ....', 'mal', 'fitrah', 'profesi', 'perdagangan', '', 'B', 1, ''],
    [2, 'PG', 'Rukun Islam yang kelima adalah ....', 'salat', 'puasa', 'zakat', 'haji', '', 'D', 1, ''],
    [3, 'BS', 'Zakat fitrah hanya wajib dikeluarkan oleh orang dewasa.', '', '', '', '', '', 'SALAH', 1, ''],
    [4, 'PGK', 'Yang termasuk golongan penerima zakat (mustahik) adalah ... (pilih semua yang benar)', 'fakir', 'miskin', 'orang kaya', 'amil', '', 'A,B,D', 2, ''],
    [5, 'ISIAN', 'Bersuci dengan air untuk menghilangkan hadas kecil disebut ....', '', '', '', '', '', 'wudu|wudhu|berwudu|berwudhu', 1, '']
  ];
  sh.getRange(2, 1, rows.length, 11).setValues(rows);
}

/* ===================== AKSES SPREADSHEET ===================== */

var _ss = null;
function ss_() {
  if (_ss) return _ss;
  var id = PropertiesService.getScriptProperties().getProperty('SS_ID');
  if (id) _ss = SpreadsheetApp.openById(id);
  else _ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!_ss) throw new Error('Skrip belum terhubung ke Google Sheet. Jalankan fungsi setup terlebih dulu.');
  return _ss;
}
function sh_(name) {
  var s = ss_().getSheetByName(name);
  if (!s) throw new Error('Sheet "' + name + '" belum ada. Jalankan fungsi setup di Apps Script.');
  return s;
}
function tz_() { return ss_().getSpreadsheetTimeZone() || 'Asia/Jakarta'; }
function nowStr_(ms) { return Utilities.formatDate(new Date(ms || Date.now()), tz_(), 'yyyy-MM-dd HH:mm:ss'); }

/* ===================== UTIL ===================== */

function yes_(v) { v = String(v == null ? '' : v).trim().toUpperCase(); return v === 'YA' || v === 'Y' || v === 'TRUE' || v === '1' || v === 'YES'; }
function num_(v, d) {
  var t = String(v == null ? '' : v).trim().replace(',', '.');
  if (t === '') return d;
  var n = Number(t);
  return isFinite(n) ? n : d;
}
function clean_(v, max) {
  v = String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
  v = v.replace(/^[=+\-@]+/, '').trim();
  return v.slice(0, max || 60);
}
function shuffle_(a) {
  for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
  return a;
}
function fail_(msg) { var e = new Error(msg); e.user = true; return e; }
function safeJson_(s, d) { try { var o = JSON.parse(s); return (o && typeof o === 'object') ? o : d; } catch (e) { return d; } }
function withLock_(fn) {
  var lock = LockService.getScriptLock();
  try { lock.waitLock(25000); } catch (e) { throw fail_('Server sedang sibuk. Coba lagi sebentar.'); }
  try { return fn(); } finally { lock.releaseLock(); }
}
function cacheClear_() {
  var c = CacheService.getScriptCache();
  c.remove('settings'); c.remove('questions');
}

/* ===================== PENGATURAN ===================== */

function getSettings_(fresh) {
  var cache = CacheService.getScriptCache();
  if (!fresh) { var c = cache.get('settings'); if (c) return JSON.parse(c); }
  var rows = sh_(SH.SET).getDataRange().getValues();
  var o = {};
  for (var i = 1; i < rows.length; i++) { var k = String(rows[i][0]).trim(); if (k) o[k] = rows[i][1] == null ? '' : String(rows[i][1]); }
  SET_DEFAULTS.forEach(function (d) { if (!(d[0] in o)) o[d[0]] = d[1]; });
  try { cache.put('settings', JSON.stringify(o), 30); } catch (e) {}
  return o;
}

function setSetting_(key, val) {
  var sh = sh_(SH.SET);
  var rows = sh.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][0]).trim() === key) { sh.getRange(i + 1, 2).setNumberFormat('@').setValue(String(val)); cacheClear_(); return; }
  }
  var d = null;
  SET_DEFAULTS.forEach(function (x) { if (x[0] === key) d = x; });
  sh.appendRow([key, String(val), d ? d[2] : '']);
  cacheClear_();
}

function maxPoin_(s) { return Math.max(0, num_(s.maks_poin_pelanggaran, 5)); }

function publicInfo_() {
  var s = getSettings_();
  var poin = {};
  Object.keys(VIOL).forEach(function (k) { poin[k] = Math.max(0, num_(s[VIOL[k]], 0)); });
  return {
    judul: s.judul_aplikasi, sekolah: s.nama_sekolah, mapel: s.mapel, kelas: s.kelas, guru: s.guru,
    tahunAjaran: s.tahun_ajaran, semester: s.semester,
    status: String(s.status_ujian).trim().toUpperCase(),
    butuhToken: !!String(s.token_ujian || '').trim(),
    hanyaTerdaftar: yes_(s.hanya_siswa_terdaftar),
    durasi: Math.max(1, num_(s.durasi_menit, 60)),
    jumlahSoal: getQuestions_().length,
    maks: maxPoin_(s), poin: poin,
    intervalLuar: Math.max(0, num_(s.interval_detik_di_luar, 30)),
    catatan: s.catatan_guru, tampilNilai: yes_(s.tampilkan_nilai_ke_siswa)
  };
}

/* ===================== SOAL ===================== */

function normTipe_(v) {
  v = String(v || '').trim().toUpperCase().replace(/[\s_\-]+/g, '');
  if (v === 'PGK' || v === 'PGKOMPLEKS' || v === 'PILIHANGANDAKOMPLEKS' || v === 'KOMPLEKS') return 'PGK';
  if (v === 'BS' || v === 'BENARSALAH' || v === 'BENARATAUSALAH') return 'BS';
  if (v === 'ISIAN' || v === 'ISIANSINGKAT' || v === 'IS') return 'ISIAN';
  return 'PG';
}

function normKunci_(tipe, k) {
  k = String(k == null ? '' : k).trim();
  if (tipe === 'PG') return (k.toUpperCase().replace(/[^A-E]/g, '').charAt(0)) || '';
  if (tipe === 'PGK') {
    var m = k.toUpperCase().match(/[A-E]/g) || [], u = [];
    m.forEach(function (x) { if (u.indexOf(x) < 0) u.push(x); });
    u.sort();
    return u.join(',');
  }
  if (tipe === 'BS') {
    var x = k.toUpperCase().replace(/[^A-Z]/g, '');
    if (x === 'B' || x === 'BENAR' || x === 'TRUE' || x === 'YA') return 'BENAR';
    if (x === 'S' || x === 'SALAH' || x === 'FALSE' || x === 'TIDAK') return 'SALAH';
    return '';
  }
  return k;
}

function normText_(t) {
  return String(t == null ? '' : t).toLowerCase().replace(/[^a-z0-9؀-ۿ\s]/g, '').replace(/\s+/g, ' ').trim();
}

/** Baca semua baris sheet Soal apa adanya (untuk panel guru). */
function readRawQuestions_() {
  var rows = sh_(SH.SOAL).getDataRange().getValues();
  var list = [];
  for (var i = 1; i < rows.length; i++) {
    var r = rows[i];
    var teks = String(r[2] == null ? '' : r[2]).trim();
    var gambar = String(r[10] == null ? '' : r[10]).trim();
    if (!teks && !gambar) continue;
    var tipe = normTipe_(r[1]);
    list.push({
      no: String(r[0] == null ? '' : r[0]).trim() || String(list.length + 1),
      tipe: tipe, teks: teks,
      A: String(r[3] == null ? '' : r[3]).trim(), B: String(r[4] == null ? '' : r[4]).trim(),
      C: String(r[5] == null ? '' : r[5]).trim(), D: String(r[6] == null ? '' : r[6]).trim(), E: String(r[7] == null ? '' : r[7]).trim(),
      kunci: normKunci_(tipe, r[8]), bobot: num_(r[9], 1) > 0 ? num_(r[9], 1) : 1, gambar: gambar
    });
  }
  return list;
}

function qError_(q) {
  var keys = ['A', 'B', 'C', 'D', 'E'].filter(function (k) { return q[k]; });
  if (q.tipe === 'PG') {
    if (keys.length < 2) return 'Minimal 2 pilihan';
    if (!q.kunci || keys.indexOf(q.kunci) < 0) return 'Kunci tidak cocok dengan pilihan';
  } else if (q.tipe === 'PGK') {
    if (keys.length < 2) return 'Minimal 2 pilihan';
    var ks = q.kunci ? q.kunci.split(',') : [];
    if (!ks.length) return 'Kunci kosong';
    for (var i = 0; i < ks.length; i++) if (keys.indexOf(ks[i]) < 0) return 'Kunci tidak cocok dengan pilihan';
  } else if (q.tipe === 'BS') {
    if (!q.kunci) return 'Kunci harus BENAR atau SALAH';
  } else if (q.tipe === 'ISIAN') {
    if (!String(q.kunci).trim()) return 'Kunci isian kosong';
  }
  return '';
}

/** Soal valid yang dipakai ujian (lengkap dengan kunci, hanya untuk server). */
function getQuestions_() {
  var cache = CacheService.getScriptCache();
  var c = cache.get('questions');
  if (c) return JSON.parse(c);
  var seen = {}, out = [];
  readRawQuestions_().forEach(function (q) {
    if (qError_(q)) return;
    var id = q.no; if (seen[id]) id = id + '_' + (out.length + 1); seen[id] = true;
    var opsi = [];
    if (q.tipe === 'PG' || q.tipe === 'PGK') {
      ['A', 'B', 'C', 'D', 'E'].forEach(function (k) { if (q[k]) opsi.push({ k: k, t: q[k] }); });
    } else if (q.tipe === 'BS') {
      opsi = [{ k: 'BENAR', t: 'Benar' }, { k: 'SALAH', t: 'Salah' }];
    }
    var kunci = q.kunci;
    if (q.tipe === 'ISIAN') kunci = String(q.kunci).split('|').map(function (x) { return normText_(x); }).filter(Boolean);
    out.push({ id: id, tipe: q.tipe, teks: q.teks, gambar: q.gambar, opsi: opsi, kunci: kunci, bobot: q.bobot });
  });
  try { cache.put('questions', JSON.stringify(out), 60); } catch (e) {}
  return out;
}

function makeOrder_(s, qs) {
  var ids = qs.map(function (q) { return q.id; });
  if (yes_(s.acak_soal)) shuffle_(ids);
  var o = {};
  if (yes_(s.acak_opsi)) {
    qs.forEach(function (q) {
      if (q.tipe === 'PG' || q.tipe === 'PGK') o[q.id] = shuffle_(q.opsi.map(function (x) { return x.k; }));
    });
  }
  return { q: ids, o: o };
}

function buildExam_(order, qs) {
  var map = {};
  qs.forEach(function (q) { map[q.id] = q; });
  var out = [];
  (order.q || []).forEach(function (id) {
    var q = map[id]; if (!q) return;
    var opsi = q.opsi;
    var ordKeys = order.o && order.o[id];
    if (ordKeys) {
      var m = {}; opsi.forEach(function (x) { m[x.k] = x; });
      opsi = ordKeys.map(function (k) { return m[k]; }).filter(Boolean);
    }
    out.push({ id: q.id, tipe: q.tipe, teks: q.teks, gambar: q.gambar, opsi: opsi });
  });
  return out;
}

function cleanAnswers_(raw, qs) {
  var out = {};
  if (!raw || typeof raw !== 'object') return out;
  qs.forEach(function (q) {
    var v = raw[q.id];
    if (v == null) return;
    v = String(v);
    var keys = q.opsi.map(function (o) { return o.k; });
    if (q.tipe === 'PG' || q.tipe === 'BS') {
      v = v.trim().toUpperCase();
      if (keys.indexOf(v) >= 0) out[q.id] = v;
    } else if (q.tipe === 'PGK') {
      var arr = v.toUpperCase().split(/[,;\s]+/).filter(function (x) { return keys.indexOf(x) >= 0; });
      var u = []; arr.forEach(function (x) { if (u.indexOf(x) < 0) u.push(x); }); u.sort();
      if (u.length) out[q.id] = u.join(',');
    } else {
      v = v.replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 200);
      if (v) out[q.id] = v;
    }
  });
  return out;
}

function isCorrect_(q, a) {
  a = String(a);
  if (q.tipe === 'PG' || q.tipe === 'BS' || q.tipe === 'PGK') return a.toUpperCase().trim() === q.kunci;
  var na = normText_(a);
  return !!na && q.kunci.indexOf(na) >= 0;
}

function grade_(qs, ans) {
  var benar = 0, salah = 0, kosong = 0, bb = 0, bt = 0;
  qs.forEach(function (q) {
    bt += q.bobot;
    var a = ans[q.id];
    if (a == null || String(a).trim() === '') { kosong++; return; }
    if (isCorrect_(q, a)) { benar++; bb += q.bobot; } else salah++;
  });
  return { benar: benar, salah: salah, kosong: kosong, total: qs.length, nilai: bt > 0 ? Math.round(bb / bt * 10000) / 100 : 0 };
}

/* ===================== SESI ===================== */

function rowOf_(sheet, sid) {
  var cache = CacheService.getScriptCache();
  var c = cache.get('r_' + sid);
  if (c) { var r = Number(c); if (r >= 2 && String(sheet.getRange(r, 1).getValue()) === sid) return r; }
  var last = sheet.getLastRow();
  if (last < 2) return 0;
  var col = sheet.getRange(2, 1, last - 1, 1).getValues();
  for (var i = col.length - 1; i >= 0; i--) {
    if (String(col[i][0]) === sid) { cache.put('r_' + sid, String(i + 2), 21600); return i + 2; }
  }
  return 0;
}

function getSession_(sid) {
  sid = String(sid || '');
  if (!/^[a-f0-9]{20}$/.test(sid)) throw fail_('Sesi tidak valid. Silakan masuk kembali.');
  var sheet = sh_(SH.SESI);
  var row = rowOf_(sheet, sid);
  if (!row) throw fail_('Sesi tidak ditemukan. Silakan masuk kembali.');
  var v = sheet.getRange(row, 1, 1, 15).getValues()[0];
  return {
    row: row, sid: String(v[0]), nisn: String(v[1]), nama: String(v[2]), kelas: String(v[3]), mulai: String(v[4]),
    batas: Number(v[5]) || 0, poin: Number(v[6]) || 0, status: String(v[7]), jawaban: safeJson_(v[8], {}),
    aktif: String(v[9]), urutan: String(v[10]), login: Number(v[11]) || 1, ua: String(v[12]),
    mulaiMs: Number(v[13]) || 0, hasil: String(v[14])
  };
}

function findSessionByNisn_(nisn) {
  var sheet = sh_(SH.SESI);
  var last = sheet.getLastRow();
  if (last < 2) return null;
  var v = sheet.getRange(2, 1, last - 1, 8).getValues();
  var want = String(nisn).toUpperCase();
  for (var i = v.length - 1; i >= 0; i--) {
    if (String(v[i][1]).toUpperCase() === want && String(v[i][7]) !== 'DIRESET') return getSession_(String(v[i][0]));
  }
  return null;
}

function findStudent_(nisn) {
  var rows = sh_(SH.SISWA).getDataRange().getValues();
  var want = String(nisn).toUpperCase();
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][0]).trim().toUpperCase() === want) {
      return { nisn: String(rows[i][0]).trim(), nama: String(rows[i][1]), kelas: String(rows[i][2]), pin: String(rows[i][3] == null ? '' : rows[i][3]).trim() };
    }
  }
  return null;
}

var STATUS_LABEL = { SELESAI: 'Selesai', WAKTU_HABIS: 'Waktu Habis', DIHENTIKAN: 'Dihentikan (Pelanggaran)', DIHENTIKAN_GURU: 'Dihentikan Guru' };

function finalize_(S, status, s, answersIn) {
  var qs = getQuestions_();
  var ans = answersIn ? cleanAnswers_(answersIn, qs) : cleanAnswers_(S.jawaban, qs);
  var g = grade_(qs, ans);
  var nilai = g.nilai;
  if (status === 'DIHENTIKAN' && String(s.nilai_saat_dihentikan).trim().toUpperCase() === 'NOL') nilai = 0;
  var now = Date.now();
  var durasi = Math.max(0, Math.round((Math.min(now, S.batas) - S.mulaiMs) / 6000) / 10);
  var kkm = num_(s.kkm, 75);
  var result = { nilai: nilai, benar: g.benar, salah: g.salah, kosong: g.kosong, total: g.total, status: status, poin: S.poin, kkm: kkm, tuntas: nilai >= kkm };
  var sheet = sh_(SH.SESI);
  sheet.getRange(S.row, C.STATUS).setValue(status);
  sheet.getRange(S.row, C.JAWAB, 1, 2).setValues([[JSON.stringify(ans), nowStr_(now)]]);
  sheet.getRange(S.row, C.HASIL).setValue(JSON.stringify(result));
  sh_(SH.NILAI).appendRow([nowStr_(now), S.nisn, S.nama, S.kelas, g.benar, g.salah, g.kosong, nilai, STATUS_LABEL[status] || status, S.poin, durasi, nilai >= kkm ? 'Tuntas' : 'Belum Tuntas', S.sid]);
  return result;
}

function studentResult_(r, s) {
  if (!r) return { status: 'SELESAI', tampil: false };
  var tampil = yes_(s.tampilkan_nilai_ke_siswa);
  var o = { status: r.status, poin: r.poin, tampil: tampil, total: r.total };
  if (tampil) { o.nilai = r.nilai; o.benar = r.benar; o.salah = r.salah; o.kosong = r.kosong; o.tuntas = r.tuntas; o.kkm = r.kkm; }
  return o;
}

function stateResp_(S, s) {
  if (S.status === 'DIRESET') return { ok: true, done: true, reset: true, status: 'DIRESET' };
  return { ok: true, done: true, status: S.status, result: studentResult_(safeJson_(S.hasil, null), s) };
}

function examResponse_(S, s, qs, resumed) {
  var order = safeJson_(S.urutan, { q: [], o: {} });
  return {
    ok: true, done: false, sid: S.sid, resumed: !!resumed,
    peserta: { nama: S.nama, kelas: S.kelas, nisn: S.nisn },
    soal: buildExam_(order, qs), jawaban: S.jawaban, batas: S.batas, serverNow: Date.now(),
    poin: S.poin, maks: maxPoin_(s)
  };
}

function applyViolation_(S, jenis, detail, s) {
  var pts = VIOL[jenis] ? Math.max(0, num_(s[VIOL[jenis]], 0)) : 0;
  var total = S.poin + pts;
  sh_(SH.SESI).getRange(S.row, C.POIN).setValue(total);
  S.poin = total;
  sh_(SH.PEL).appendRow([nowStr_(), S.sid, S.nisn, S.nama, jenis, pts, total, detail || '']);
  var max = maxPoin_(s);
  if (max > 0 && total >= max) {
    var result = finalize_(S, 'DIHENTIKAN', s);
    return { stopped: true, result: result, poin: total, tambah: pts };
  }
  return { stopped: false, poin: total, tambah: pts };
}

/* ===================== AKSI SISWA ===================== */

function login_(req) {
  var s = getSettings_();
  if (String(s.status_ujian).trim().toUpperCase() !== 'DIBUKA') throw fail_('Ujian belum dibuka atau sudah ditutup oleh guru.');
  var qs = getQuestions_();
  if (!qs.length) throw fail_('Soal belum tersedia. Hubungi guru.');
  var nisn = String(req.nisn || '').trim().replace(/[^A-Za-z0-9._\-]/g, '').slice(0, 20);
  var nama = clean_(req.nama, 60), kelas = clean_(req.kelas, 20);
  if (!nisn) throw fail_('Nomor absen / NISN wajib diisi.');
  var tok = String(s.token_ujian == null ? '' : s.token_ujian).trim();
  if (tok && String(req.token || '').trim().toUpperCase() !== tok.toUpperCase()) throw fail_('Token ujian salah.');
  if (yes_(s.hanya_siswa_terdaftar)) {
    var st = findStudent_(nisn);
    if (!st) throw fail_('NISN / No. absen belum terdaftar. Hubungi guru.');
    if (st.pin && String(req.pin || '').trim() !== st.pin) throw fail_('PIN salah.');
    nama = clean_(st.nama, 60); kelas = clean_(st.kelas, 20);
  } else if (!nama) throw fail_('Nama wajib diisi.');

  return withLock_(function () {
    var now = Date.now();
    var ex = findSessionByNisn_(nisn);
    if (ex) {
      if (ex.status !== 'BERLANGSUNG') return stateResp_(ex, s);
      if (now > ex.batas + GRACE_MS) { finalize_(ex, 'WAKTU_HABIS', s); return stateResp_(getSession_(ex.sid), s); }
      var vr = applyViolation_(ex, 'MUAT_ULANG', 'Login ulang / muat ulang halaman', s);
      var sheet = sh_(SH.SESI);
      if (vr.stopped) return stateResp_(getSession_(ex.sid), s);
      sheet.getRange(ex.row, C.LOGIN).setValue(ex.login + 1);
      sheet.getRange(ex.row, C.AKTIF).setValue(nowStr_(now));
      ex.login += 1;
      return examResponse_(ex, s, qs, true);
    }
    var sid = Utilities.getUuid().replace(/-/g, '').slice(0, 20);
    var order = makeOrder_(s, qs);
    var batas = now + Math.max(1, num_(s.durasi_menit, 60)) * 60000;
    var sh = sh_(SH.SESI);
    sh.appendRow([sid, nisn, nama, kelas, nowStr_(now), batas, 0, 'BERLANGSUNG', '{}', nowStr_(now), JSON.stringify(order), 1, clean_(req.ua, 120), now, '']);
    CacheService.getScriptCache().put('r_' + sid, String(sh.getLastRow()), 21600);
    return examResponse_(getSession_(sid), s, qs, false);
  });
}

function sync_(req) {
  var s = getSettings_();
  var S = getSession_(req.sid);
  if (S.status !== 'BERLANGSUNG') return stateResp_(S, s);
  var now = Date.now();
  if (now > S.batas + GRACE_MS) {
    return withLock_(function () {
      var X = getSession_(req.sid);
      if (X.status === 'BERLANGSUNG') finalize_(X, 'WAKTU_HABIS', s);
      return stateResp_(getSession_(req.sid), s);
    });
  }
  if (req.jawaban) {
    var ans = cleanAnswers_(req.jawaban, getQuestions_());
    sh_(SH.SESI).getRange(S.row, C.JAWAB, 1, 2).setValues([[JSON.stringify(ans), nowStr_(now)]]);
  }
  return { ok: true, done: false, status: 'BERLANGSUNG', poin: S.poin, maks: maxPoin_(s), batas: S.batas, serverNow: now };
}

function violation_(req) {
  var jenis = String(req.jenis || '').toUpperCase();
  if (!VIOL[jenis]) jenis = 'LAINNYA';
  var s = getSettings_();
  return withLock_(function () {
    var S = getSession_(req.sid);
    if (S.status !== 'BERLANGSUNG') return stateResp_(S, s);
    var now = Date.now();
    if (now > S.batas + GRACE_MS) { finalize_(S, 'WAKTU_HABIS', s); return stateResp_(getSession_(S.sid), s); }
    var cache = CacheService.getScriptCache();
    var key = 'v_' + S.sid + '_' + jenis;
    if (cache.get(key)) return { ok: true, done: false, poin: S.poin, maks: maxPoin_(s), tambah: 0, dup: true };
    cache.put(key, '1', 2);
    var r = applyViolation_(S, jenis, clean_(req.detail, 100), s);
    if (r.stopped) return stateResp_(getSession_(S.sid), s);
    return { ok: true, done: false, poin: r.poin, maks: maxPoin_(s), tambah: r.tambah };
  });
}

function finish_(req) {
  var s = getSettings_();
  return withLock_(function () {
    var S = getSession_(req.sid);
    if (S.status !== 'BERLANGSUNG') return stateResp_(S, s);
    var now = Date.now();
    var late = now > S.batas + GRACE_MS;
    var status = now >= S.batas - 3000 ? 'WAKTU_HABIS' : 'SELESAI';
    finalize_(S, status, s, late ? null : req.jawaban);
    return stateResp_(getSession_(S.sid), s);
  });
}

/* ===================== AKSI GURU ===================== */

function requireAdmin_(req) {
  var cache = CacheService.getScriptCache();
  var fails = Number(cache.get('adm_fail') || 0);
  if (fails >= 30) throw fail_('Terlalu banyak percobaan password salah. Coba lagi 10 menit lagi.');
  var pw = String(getSettings_(true).password_guru || '');
  if (!pw || pw === DEFAULT_PASSWORD) throw fail_('Password guru masih bawaan. Buka sheet "Pengaturan", ganti nilai password_guru, lalu coba lagi.');
  if (String(req.password || '') !== pw) {
    cache.put('adm_fail', String(fails + 1), 600);
    Utilities.sleep(1200);
    throw fail_('Password salah.');
  }
}

function adminSettings_() {
  var s = getSettings_(true);
  var o = {};
  Object.keys(s).forEach(function (k) { if (k !== 'password_guru') o[k] = s[k]; });
  return o;
}

function activeCount_() {
  var sheet = sh_(SH.SESI), last = sheet.getLastRow();
  if (last < 2) return 0;
  var v = sheet.getRange(2, 8, last - 1, 1).getValues(), n = 0;
  v.forEach(function (r) { if (String(r[0]) === 'BERLANGSUNG') n++; });
  return n;
}

function clearData_() {
  [SH.SESI, SH.PEL, SH.NILAI].forEach(function (n) {
    var sh = sh_(n), last = sh.getLastRow();
    if (last > 1) sh.getRange(2, 1, last - 1, sh.getLastColumn()).clearContent();
  });
  CacheService.getScriptCache().removeAll([]);
  cacheClear_();
}

function imageFolder_() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('IMG_FOLDER');
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) {} }
  var f = DriveApp.createFolder('Gambar Soal - Asesmen ' + ss_().getName());
  props.setProperty('IMG_FOLDER', f.getId());
  return f;
}

function adminRoute_(a, req) {
  var sheet;
  switch (a) {
    case 'a_login':
      return { ok: true, settings: adminSettings_(), sheetUrl: ss_().getUrl(), jumlahSoal: getQuestions_().length, serverNow: Date.now() };

    case 'a_saveSettings': {
      var vals = req.values || {}, allowed = {};
      SET_DEFAULTS.forEach(function (d) { allowed[d[0]] = true; });
      Object.keys(vals).forEach(function (k) {
        if (!allowed[k]) return;
        var v = String(vals[k] == null ? '' : vals[k]).slice(0, 600);
        if (k === 'password_guru') {
          if (!v) return;
          if (v.length < 6 || v === DEFAULT_PASSWORD) throw fail_('Password baru minimal 6 karakter dan tidak boleh sama dengan bawaan.');
        }
        setSetting_(k, v);
      });
      cacheClear_();
      return { ok: true, settings: adminSettings_() };
    }

    case 'a_getQuestions': {
      var raw = readRawQuestions_();
      raw.forEach(function (q) { q.error = qError_(q); });
      return { ok: true, questions: raw };
    }

    case 'a_saveQuestions': {
      if (activeCount_() > 0 && !req.force) throw fail_('Ada siswa yang sedang mengerjakan ujian. Soal tidak bisa diubah sekarang.');
      var list = req.questions;
      if (!Array.isArray(list)) throw fail_('Data soal tidak valid.');
      if (list.length > 300) throw fail_('Maksimal 300 soal.');
      var out = list.map(function (q, i) {
        var tipe = normTipe_(q.tipe);
        return [i + 1, tipe, String(q.teks || '').slice(0, 4000), String(q.A || '').slice(0, 1000), String(q.B || '').slice(0, 1000), String(q.C || '').slice(0, 1000), String(q.D || '').slice(0, 1000), String(q.E || '').slice(0, 1000),
          normKunci_(tipe, q.kunci), num_(q.bobot, 1) > 0 ? num_(q.bobot, 1) : 1, String(q.gambar || '').slice(0, 1000)];
      });
      withLock_(function () {
        sheet = sh_(SH.SOAL);
        var last = sheet.getLastRow();
        if (last > 1) sheet.getRange(2, 1, last - 1, 11).clearContent();
        if (out.length) {
          sheet.getRange(2, 2, Math.max(out.length, 1), 8).setNumberFormat('@');
          sheet.getRange(2, 11, out.length, 1).setNumberFormat('@');
          sheet.getRange(2, 1, out.length, 11).setValues(out);
        }
        cacheClear_();
      });
      return { ok: true, jumlah: out.length, valid: getQuestions_().length };
    }

    case 'a_uploadImage': {
      var data = String(req.data || '');
      if (data.length > 2500000) throw fail_('Ukuran gambar terlalu besar (maks. sekitar 1,8 MB).');
      var mime = /^image\/(png|jpeg|gif|webp)$/.test(String(req.mime)) ? String(req.mime) : 'image/jpeg';
      var ext = mime.split('/')[1].replace('jpeg', 'jpg');
      var blob = Utilities.newBlob(Utilities.base64Decode(data), mime, 'soal-' + Date.now() + '.' + ext);
      var file = imageFolder_().createFile(blob);
      var shared = true;
      try { file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) { shared = false; }
      return { ok: true, id: file.getId(), shared: shared, url: 'https://drive.google.com/thumbnail?id=' + file.getId() + '&sz=w1000' };
    }

    case 'a_getImage': {
      var fid = String(req.id || '').replace(/[^A-Za-z0-9_\-]/g, '');
      var f = DriveApp.getFileById(fid);
      var b = f.getBlob();
      return { ok: true, mime: b.getContentType(), data: Utilities.base64Encode(b.getBytes()) };
    }

    case 'a_monitor': {
      sheet = sh_(SH.SESI);
      var last = sheet.getLastRow(), sesi = [];
      var total = getQuestions_().length;
      if (last > 1) {
        sheet.getRange(2, 1, last - 1, 12).getValues().forEach(function (v) {
          if (String(v[7]) === 'DIRESET') return;
          var ans = safeJson_(v[8], {});
          sesi.push({ sid: String(v[0]), nisn: String(v[1]), nama: String(v[2]), kelas: String(v[3]), mulai: String(v[4]), poin: Number(v[6]) || 0, status: String(v[7]), terjawab: Object.keys(ans).length, aktif: String(v[9]), login: Number(v[11]) || 1 });
        });
      }
      var s = getSettings_(true);
      return { ok: true, sesi: sesi, totalSoal: total, status: String(s.status_ujian).trim().toUpperCase(), token: s.token_ujian, maks: maxPoin_(s), serverNow: Date.now() };
    }

    case 'a_stop': {
      var s2 = getSettings_(true);
      withLock_(function () {
        var S = getSession_(req.sid);
        if (S.status === 'BERLANGSUNG') finalize_(S, 'DIHENTIKAN_GURU', s2);
      });
      return { ok: true };
    }

    case 'a_reset': {
      withLock_(function () {
        var S = getSession_(req.sid);
        sh_(SH.SESI).getRange(S.row, C.STATUS).setValue('DIRESET');
        var nl = sh_(SH.NILAI), lastN = nl.getLastRow();
        if (lastN > 1) {
          var col = nl.getRange(2, 13, lastN - 1, 1).getValues();
          for (var i = col.length - 1; i >= 0; i--) if (String(col[i][0]) === S.sid) nl.deleteRow(i + 2);
        }
      });
      return { ok: true };
    }

    case 'a_results': {
      var nl2 = sh_(SH.NILAI), lastR = nl2.getLastRow(), rows = [];
      if (lastR > 1) {
        nl2.getRange(2, 1, lastR - 1, 13).getValues().forEach(function (v) {
          rows.push({ waktu: String(v[0]), nisn: String(v[1]), nama: String(v[2]), kelas: String(v[3]), benar: v[4], salah: v[5], kosong: v[6], nilai: Number(v[7]), status: String(v[8]), poin: v[9], durasi: v[10], tuntas: String(v[11]), sid: String(v[12]) });
        });
      }
      return { ok: true, rows: rows, kkm: num_(getSettings_(true).kkm, 75) };
    }

    case 'a_violations': {
      var pl = sh_(SH.PEL), lastP = pl.getLastRow(), pr = [];
      if (lastP > 1) {
        var from = Math.max(2, lastP - 199);
        pl.getRange(from, 1, lastP - from + 1, 8).getValues().forEach(function (v) {
          pr.push({ waktu: String(v[0]), sid: String(v[1]), nisn: String(v[2]), nama: String(v[3]), jenis: String(v[4]), poin: v[5], total: v[6], ket: String(v[7]) });
        });
      }
      return { ok: true, rows: pr.reverse() };
    }

    case 'a_getStudents': {
      var rs = sh_(SH.SISWA).getDataRange().getValues(), st = [];
      for (var i = 1; i < rs.length; i++) if (String(rs[i][0]).trim()) st.push({ nisn: String(rs[i][0]), nama: String(rs[i][1]), kelas: String(rs[i][2]), pin: String(rs[i][3] == null ? '' : rs[i][3]) });
      return { ok: true, students: st };
    }

    case 'a_saveStudents': {
      var arr = Array.isArray(req.students) ? req.students : [];
      if (arr.length > 1000) throw fail_('Maksimal 1000 siswa.');
      var vals2 = arr.map(function (x) { return [clean_(x.nisn, 20), clean_(x.nama, 60), clean_(x.kelas, 20), clean_(x.pin, 20)]; }).filter(function (x) { return x[0]; });
      withLock_(function () {
        var sw = sh_(SH.SISWA), lw = sw.getLastRow();
        if (lw > 1) sw.getRange(2, 1, lw - 1, 4).clearContent();
        if (vals2.length) { sw.getRange(2, 1, vals2.length, 4).setNumberFormat('@'); sw.getRange(2, 1, vals2.length, 4).setValues(vals2); }
      });
      return { ok: true, jumlah: vals2.length };
    }

    case 'a_clearData':
      if (String(req.konfirmasi) !== 'HAPUS') throw fail_('Konfirmasi tidak sesuai.');
      withLock_(function () { clearData_(); });
      return { ok: true };

    default:
      throw new Error('Aksi tidak dikenal: ' + a);
  }
}

/* ===================== PINTU MASUK WEB APP ===================== */

function route_(req) {
  var a = String(req.action || '');
  switch (a) {
    case 'ping': return { ok: true, versi: APP.VERSION };
    case 'info': return { ok: true, info: publicInfo_() };
    case 'login': return login_(req);
    case 'sync': return sync_(req);
    case 'violation': return violation_(req);
    case 'finish': return finish_(req);
    default:
      if (a.indexOf('a_') === 0) { requireAdmin_(req); return adminRoute_(a, req); }
      throw new Error('Aksi tidak dikenal: ' + a);
  }
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  var out;
  try {
    var req = JSON.parse(e.postData.contents);
    out = route_(req);
  } catch (err) {
    out = { ok: false, error: String((err && err.message) || err) };
  }
  return json_(out);
}

function doGet() {
  try { return json_({ ok: true, app: 'Asesmen Sumatif', versi: APP.VERSION, info: publicInfo_() }); }
  catch (err) { return json_({ ok: false, error: String((err && err.message) || err) }); }
}

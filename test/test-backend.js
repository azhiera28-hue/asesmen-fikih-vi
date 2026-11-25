const assert = require('assert');
const { createEnv } = require('./mock-gas');
const env = createEnv();
const { ctx, sheets, call } = env;
let n = 0; const ok = (m) => console.log('  ✓', m, ++n >= 0 ? '' : '');

ctx.setup();
assert(sheets['Soal'] && sheets['Nilai'] && sheets['Pengaturan'], 'sheet dibuat');
ok('setup membuat semua sheet + soal contoh');

// ujian ditutup secara bawaan
let r = call({ action: 'login', nisn: '1', nama: 'Budi', kelas: 'VI-A' });
assert(!r.ok && /belum dibuka/.test(r.error)); ok('login ditolak saat ujian ditutup');

// admin: password bawaan ditolak
r = call({ action: 'a_login', password: 'GANTI-PASSWORD-INI' });
assert(!r.ok && /bawaan/.test(r.error)); ok('password bawaan diblokir');

// guru ganti password di sheet lalu login
ctx.setSetting_('password_guru', 'rahasia123');
r = call({ action: 'a_login', password: 'salah' }); assert(!r.ok && /salah/.test(r.error)); ok('password salah ditolak');
r = call({ action: 'a_login', password: 'rahasia123' }); assert(r.ok && r.jumlahSoal === 5); ok('login guru OK, 5 soal valid');
assert(r.settings.password_guru === undefined); ok('password tidak dikirim balik ke browser');

// buka ujian + token
r = call({ action: 'a_saveSettings', password: 'rahasia123', values: { status_ujian: 'DIBUKA', token_ujian: 'ABC12', maks_poin_pelanggaran: '5', tampilkan_nilai_ke_siswa: 'YA', acak_soal: 'YA', acak_opsi: 'YA' } });
assert(r.ok); ok('guru buka ujian & set token');
r = call({ action: 'login', nisn: '1', nama: 'Budi', kelas: 'VI-A', token: 'xx' });
assert(!r.ok && /Token/.test(r.error)); ok('token salah ditolak');

// siswa A: login, jawab semua benar
r = call({ action: 'login', nisn: '1', nama: '=HYPERLINK("x")Budi', kelas: 'VI-A', token: 'abc12', ua: 'test' });
assert(r.ok && !r.done && r.soal.length === 5, JSON.stringify(r).slice(0, 200));
assert(r.soal.every(q => q.kunci === undefined), 'kunci tidak bocor'); ok('login siswa OK, kunci tidak dikirim ke browser');
assert(!/HYPERLINK\("x"\)Budi/.test(sheets['Sesi'].get(2, 3)) || sheets['Sesi'].get(2, 3)[0] !== '='); ok('nama berawalan "=" dibersihkan: ' + sheets['Sesi'].get(2, 3));
const sidA = r.sid;
const key = { 1: 'B', 2: 'D', 3: 'SALAH', 4: 'A,B,D', 5: 'Wudhu' };
// map jawaban benar per id (id=no)
const ans = {}; r.soal.forEach(q => { ans[q.id] = key[q.id]; });
let s = call({ action: 'sync', sid: sidA, jawaban: ans }); assert(s.ok && s.status === 'BERLANGSUNG'); ok('sync menyimpan jawaban');

// pelanggaran: pindah tab (2) lalu dedupe
let v = call({ action: 'violation', sid: sidA, jenis: 'PINDAH_TAB', detail: 'tes' });
assert(v.ok && v.poin === 2 && v.tambah === 2); ok('pindah tab = +2 poin');
v = call({ action: 'violation', sid: sidA, jenis: 'PINDAH_TAB' });
assert(v.dup && v.poin === 2); ok('pelanggaran ganda dalam 2 detik diabaikan');
v = call({ action: 'violation', sid: sidA, jenis: 'KLIK_KANAN' }); assert(v.poin === 3); ok('klik kanan +1 => 3');

// finish normal
let f = call({ action: 'finish', sid: sidA, jawaban: ans });
assert(f.ok && f.done && f.result.nilai === 100 && f.result.benar === 5, JSON.stringify(f)); ok('nilai 100, tampil ke siswa (setting YA)');
let nilai = sheets['Nilai']; assert(nilai.getLastRow() === 2 && nilai.get(2, 8) === 100 && nilai.get(2, 9) === 'Selesai'); ok('nilai masuk otomatis ke sheet Nilai');
// login ulang setelah selesai tidak boleh
r = call({ action: 'login', nisn: '1', nama: 'Budi', kelas: 'VI-A', token: 'ABC12' });
assert(r.ok && r.done && r.status === 'SELESAI'); ok('siswa yang sudah selesai tidak bisa mengulang');

// siswa B: dihentikan karena pelanggaran
r = call({ action: 'login', nisn: '2', nama: 'Sari', kelas: 'VI-A', token: 'ABC12' });
const sidB = r.sid; const ansB = {}; ansB[r.soal[0].id] = key[r.soal[0].id];
call({ action: 'sync', sid: sidB, jawaban: ansB });
v = call({ action: 'violation', sid: sidB, jenis: 'PINDAH_TAB' }); assert(v.poin === 2 && !v.done);
v = call({ action: 'violation', sid: sidB, jenis: 'KELUAR_LAYAR_PENUH' }); assert(v.poin === 4 && !v.done);
v = call({ action: 'violation', sid: sidB, jenis: 'LAMA_DI_LUAR' }); assert(v.result.poin === 5 && v.done && v.status === 'DIHENTIKAN', JSON.stringify(v)); ok('poin 5/5 => ujian dihentikan otomatis');
assert(nilai.getLastRow() === 3 && /Dihentikan/.test(nilai.get(3, 9)) && nilai.get(3, 8) === (ansB[4] ? 33.33 : 16.67)); ok('nilai dari jawaban tersimpan (bobot ikut dihitung) masuk sheet: ' + nilai.get(3, 8));
s = call({ action: 'sync', sid: sidB, jawaban: {} }); assert(s.done && s.status === 'DIHENTIKAN'); ok('sync setelah dihentikan => klien diberi tahu');

// mode nilai NOL
ctx.setSetting_('nilai_saat_dihentikan', 'NOL');
r = call({ action: 'login', nisn: '3', nama: 'Dedi', kelas: 'VI-B', token: 'ABC12' });
call({ action: 'violation', sid: r.sid, jenis: 'PINDAH_TAB' }); call({ action: 'violation', sid: r.sid, jenis: 'KELUAR_LAYAR_PENUH' });
ctx.CacheService.getScriptCache().removeAll();
v = call({ action: 'violation', sid: r.sid, jenis: 'MUAT_ULANG' }); assert(v.done); assert(nilai.get(4, 8) === 0); ok('mode NOL => nilai 0 saat dihentikan');

// resume + penalti muat ulang
ctx.setSetting_('nilai_saat_dihentikan', 'TERSIMPAN');
r = call({ action: 'login', nisn: '4', nama: 'Eka', kelas: 'VI-B', token: 'ABC12' });
const sid4 = r.sid; call({ action: 'sync', sid: sid4, jawaban: { [r.soal[0].id]: 'A' } });
r = call({ action: 'login', nisn: '4', nama: 'Eka', kelas: 'VI-B', token: 'ABC12' });
assert(r.ok && r.resumed && r.sid === sid4 && r.poin === 2 && Object.keys(r.jawaban).length === 1); ok('login ulang melanjutkan sesi, +2 poin muat ulang, jawaban & urutan soal sama');

// waktu habis
const row = ctx.getSession_(sid4).row;
sheets['Sesi'].set(row, 6, Date.now() - 60000);
s = call({ action: 'sync', sid: sid4, jawaban: {} }); assert(s.done && s.status === 'WAKTU_HABIS'); ok('waktu habis => dinilai otomatis');

// admin: monitor, reset, hasil, simpan soal, siswa
r = call({ action: 'a_monitor', password: 'rahasia123' }); assert(r.ok && r.sesi.length === 4); ok('monitor guru menampilkan 4 sesi');
r = call({ action: 'a_reset', password: 'rahasia123', sid: sidA }); assert(r.ok);
r = call({ action: 'a_results', password: 'rahasia123' }); assert(r.rows.length === 3 && !r.rows.some(x => x.sid === sidA)); ok('reset menghapus nilai & mengizinkan ulang');
r = call({ action: 'login', nisn: '1', nama: 'Budi', kelas: 'VI-A', token: 'ABC12' }); assert(r.ok && !r.done && !r.resumed); ok('siswa yang direset bisa mengerjakan lagi');
r = call({ action: 'a_saveQuestions', password: 'rahasia123', questions: [] }); assert(!r.ok && /sedang mengerjakan/.test(r.error)); ok('soal tidak bisa diubah saat ada yang mengerjakan');
r = call({ action: 'a_clearData', password: 'rahasia123', konfirmasi: 'HAPUS' }); assert(r.ok && sheets['Nilai'].getLastRow() === 1); ok('hapus data uji coba');
r = call({ action: 'a_saveQuestions', password: 'rahasia123', questions: [
  { tipe: 'PG', teks: '=1+1 soal', A: 'a', B: 'b', kunci: 'B', bobot: 2, gambar: 'https://x/y.png' },
  { tipe: 'PG', teks: 'tanpa kunci', A: 'a', B: 'b', kunci: '' }] });
assert(r.ok && r.jumlah === 2 && r.valid === 1); ok('simpan soal: 1 valid, 1 tanpa kunci diabaikan dari ujian');
r = call({ action: 'a_getQuestions', password: 'rahasia123' }); assert(r.questions[1].error); ok('panel guru diberi tahu soal bermasalah');
r = call({ action: 'a_saveStudents', password: 'rahasia123', students: [{ nisn: '10', nama: 'Ali', kelas: 'VI-A', pin: '99' }] }); assert(r.jumlah === 1);
ctx.setSetting_('hanya_siswa_terdaftar', 'YA');
r = call({ action: 'login', nisn: '77', nama: 'x', token: 'ABC12' }); assert(!r.ok && /terdaftar/.test(r.error));
r = call({ action: 'login', nisn: '10', token: 'ABC12', pin: '1' }); assert(!r.ok && /PIN/.test(r.error));
r = call({ action: 'login', nisn: '10', token: 'ABC12', pin: '99', nama: 'palsu' }); assert(r.ok && r.peserta.nama === 'Ali'); ok('mode siswa terdaftar + PIN berfungsi, nama diambil dari sheet');
r = call({ action: 'a_uploadImage', password: 'rahasia123', mime: 'image/png', data: 'YWJj' }); assert(r.ok && /thumbnail\?id=FILE1/.test(r.url)); ok('unggah gambar → URL Drive');
r = call({ action: 'ping' }); assert(r.ok);
console.log('\nSEMUA TES BACKEND LULUS (' + n + ' pemeriksaan)');

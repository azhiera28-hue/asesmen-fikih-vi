const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const { createEnv } = require('./mock-gas');
const ROOT = path.join(__dirname, '..'), SHOTS = process.env.SHOTS || '/tmp/shots';
fs.mkdirSync(SHOTS, { recursive: true });
const API = 'https://script.google.com/macros/s/TEST/exec';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
let n = 0; const ok = m => console.log('  ✓', m, ++n && '');
const assert = (c, m) => { if (!c) throw new Error('GAGAL: ' + m); };

(async () => {
  const env = createEnv(); env.ctx.setup();
  env.ctx.setSetting_('password_guru', 'rahasia123'); env.ctx.setSetting_('status_ujian', 'DIBUKA'); env.ctx.setSetting_('token_ujian', 'ABC12');
  env.ctx.setSetting_('tampilkan_nilai_ke_siswa', 'YA'); env.ctx.setSetting_('acak_soal', 'TIDAK'); env.ctx.setSetting_('acak_opsi', 'TIDAK');
  const srv = http.createServer((q, s) => { let p = decodeURIComponent(q.url.split('?')[0]); if (p === '/') p = '/index.html'; const f = path.join(ROOT, p);
    if (!f.startsWith(ROOT) || !fs.existsSync(f)) { s.writeHead(404); return s.end(); }
    s.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); s.end(fs.readFileSync(f)); }).listen(0);
  const base = 'http://localhost:' + srv.address().port;
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  await ctx.route('**/config.js', r => r.fulfill({ contentType: 'text/javascript', body: 'window.APP_CONFIG={API_URL:"' + API + '"};' }));
  await ctx.route(API, async r => {
    const req = r.request(); if (req.method() === 'GET') return r.fulfill({ contentType: 'application/json', body: '{}' });
    const res = env.call(JSON.parse(req.postData())); r.fulfill({ contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(res) });
  });

  /* ===== siswa ===== */
  const pg = await ctx.newPage(); pg.on('pageerror', e => errors.push(e.message)); pg.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await pg.goto(base + '/index.html'); await pg.waitForSelector('#gRules li');
  assert((await pg.textContent('#gTitle')).includes('Asesmen Sumatif'), 'judul'); ok('halaman masuk tampil, judul & tata tertib dari sheet');
  assert((await pg.textContent('#gLimit')).includes('5'), 'batas poin tampil'); ok('batas poin pelanggaran tampil');
  await pg.screenshot({ path: SHOTS + '/1-gate.png' });
  assert(await pg.isDisabled('#btnStart'), 'tombol nonaktif'); ok('tombol mulai nonaktif sebelum setuju tata tertib');
  await pg.fill('#inNama', 'Budi Santoso'); await pg.fill('#inNisn', '12'); await pg.fill('#inKelas', 'VI-A'); await pg.fill('#inToken', 'abc12'); await pg.check('#inAgree');
  await pg.click('#btnStart'); await pg.waitForSelector('#screenExam:not(.hidden)');
  const fs1 = await pg.evaluate(() => !!document.fullscreenElement); ok('ujian dimulai; layar penuh aktif = ' + fs1);
  assert((await pg.textContent('#qcard')).includes('Zakat yang wajib'), 'soal 1'); ok('soal 1 tampil');
  await pg.click('.opt >> nth=1'); await pg.click('text=Berikutnya ›'); await pg.click('.opt >> nth=3');
  await pg.click('text=Berikutnya ›'); await pg.click('.opt >> nth=1'); // BS: Salah
  await pg.click('text=Berikutnya ›'); await pg.click('.opt >> nth=0'); await pg.click('.opt >> nth=1'); await pg.click('.opt >> nth=3');
  await pg.click('text=Berikutnya ›'); await pg.fill('.isian', 'Wudhu');
  await pg.screenshot({ path: SHOTS + '/2-exam.png' }); ok('semua jenis soal (PG, PGK, BS, isian) bisa dijawab');
  await pg.waitForTimeout(1800);
  const sesi = env.sheets['Sesi']; assert(Object.keys(JSON.parse(sesi.get(2, 9) || '{}')).length === 5, 'jawaban tersimpan otomatis ke sheet'); ok('jawaban tersimpan otomatis ke sheet Sesi');

  // simulasi pindah tab (setelah masa tenggang awal 2,5 detik)
  await pg.waitForTimeout(1200);
  await pg.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
  await pg.waitForSelector('#block', { timeout: 5000 }); ok('pindah tab → layar penghalang muncul');
  await pg.waitForFunction(() => document.querySelector('.toast'), null, { timeout: 5000 });
  assert(/\+2 poin/.test(await pg.textContent('.toast')), 'toast poin'); ok('peringatan "+2 poin" tampil');
  assert(env.sheets['Pelanggaran'].getLastRow() === 2 && /PINDAH_TAB/.test(env.sheets['Pelanggaran'].get(2, 5)), 'dicatat'); ok('pelanggaran tercatat di sheet Pelanggaran');
  await pg.screenshot({ path: SHOTS + '/3-violation.png' });
  await pg.evaluate(() => { delete document.hidden; document.dispatchEvent(new Event('visibilitychange')); });
  await pg.waitForTimeout(700);
  // klik kanan & shortcut
  await pg.evaluate(() => { document.dispatchEvent(new Event('contextmenu', { cancelable: true, bubbles: true })); });
  await pg.waitForTimeout(600);
  // dua pelanggaran lagi sampai batas 5: tab (2)+klik kanan (1)=3; tambah copy(1) + shortcut(1)
  await pg.evaluate(() => document.dispatchEvent(new ClipboardEvent('copy', { cancelable: true, bubbles: true })));
  await pg.waitForTimeout(500);
  await pg.keyboard.press('F12'); await pg.waitForSelector('#screenDone:not(.hidden)', { timeout: 8000 });
  const txt = await pg.textContent('#doneCard'); assert(/dihentikan/i.test(txt), 'layar dihentikan'); ok('total 5 poin → ujian dihentikan otomatis, siswa diberi tahu');
  await pg.screenshot({ path: SHOTS + '/4-stopped.png' });
  const nl = env.sheets['Nilai']; assert(nl.getLastRow() === 2 && nl.get(2, 8) === 100 && /Dihentikan/.test(nl.get(2, 9)), 'nilai ke sheet ' + nl.get(2, 8)); ok('nilai dari jawaban yang sudah masuk (100) otomatis ke sheet Nilai');
  assert(!(await pg.evaluate(() => !!document.fullscreenElement)), 'keluar fullscreen'); ok('layar penuh dilepas setelah ujian berakhir');

  // siswa 2 selesai normal
  const pg2 = await ctx.newPage(); pg2.on('pageerror', e => errors.push(e.message));
  await pg2.goto(base + '/index.html'); await pg2.waitForSelector('#gRules li');
  await pg2.fill('#inNama', 'Sari'); await pg2.fill('#inNisn', '13'); await pg2.fill('#inToken', 'ABC12'); await pg2.check('#inAgree'); await pg2.click('#btnStart');
  await pg2.waitForSelector('#screenExam:not(.hidden)'); await pg2.click('.opt >> nth=1');
  await pg2.click('#btnFinish'); await pg2.click('text=Ya, kumpulkan sekarang'); await pg2.waitForSelector('#screenDone:not(.hidden)');
  assert(/Jawaban sudah terkirim/.test(await pg2.textContent('#doneCard')), 'selesai'); ok('siswa 2 kumpulkan manual → nilai tampil');
  await pg2.screenshot({ path: SHOTS + '/5-done.png' });
  assert(env.sheets['Nilai'].getLastRow() === 3 && env.sheets['Nilai'].get(3, 9) === 'Selesai', 'nilai 2'); ok('nilai siswa 2 masuk sheet');

  // mobile
  const mob = await browser.newContext({ viewport: { width: 390, height: 780 }, deviceScaleFactor: 2 });
  await mob.route('**/config.js', r => r.fulfill({ contentType: 'text/javascript', body: 'window.APP_CONFIG={API_URL:"' + API + '"};' }));
  await mob.route(API, async r => { const res = env.call(JSON.parse(r.request().postData() || '{"action":"info"}')); r.fulfill({ contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(res) }); });
  const pm = await mob.newPage(); await pm.goto(base + '/index.html'); await pm.waitForSelector('#gRules li');
  const ov = await pm.evaluate(() => document.documentElement.scrollWidth > innerWidth); assert(!ov, 'tidak ada scroll horizontal'); ok('layout HP tanpa scroll horizontal');
  await pm.screenshot({ path: SHOTS + '/6-mobile.png' });

  /* ===== guru ===== */
  const ad = await ctx.newPage(); ad.on('pageerror', e => errors.push('ADMIN ' + e.message)); ad.on('console', m => { if (m.type() === 'error') errors.push('ADMIN ' + m.text()); });
  await ad.goto(base + '/admin.html'); await ad.fill('#pw', 'salah'); await ad.click('text=Masuk');
  await ad.waitForSelector('.toast'); ok('password salah ditolak di panel');
  await ad.fill('#pw', 'rahasia123'); await ad.click('button:has-text("Masuk")'); await ad.waitForSelector('.admin-shell');
  await ad.waitForSelector('table.t'); assert((await ad.textContent('table.t')).includes('Budi Santoso'), 'monitor'); ok('panel guru: pantau ujian menampilkan siswa');
  await ad.screenshot({ path: SHOTS + '/7-admin-monitor.png' });
  await ad.click('button[role=tab]:has-text("Bank soal")'); await ad.waitForSelector('table.t');
  assert((await ad.locator('table.t tbody tr').count()) === 5, '5 soal'); ok('bank soal menampilkan 5 soal');
  await ad.screenshot({ path: SHOTS + '/8-admin-soal.png' });
  // impor teks
  fs.writeFileSync('/tmp/impor.txt', '1. Hukum salat fardu adalah ....\nA. sunah\nB. wajib\nC. mubah\nKunci: B\n\n2. Benar atau salah: wudu membatalkan puasa.\nKunci: Salah\n');
  await ad.setInputFiles('input[type=file] >> nth=0', '/tmp/impor.txt'); await ad.waitForSelector('.modal');
  assert((await ad.textContent('.modal')).includes('2 soal'), 'pratinjau'); ok('impor .txt → pratinjau 2 soal');
  await ad.screenshot({ path: SHOTS + '/9-admin-import.png' });
  await ad.click('button:has-text("Masukkan ke bank soal")'); await ad.waitForSelector('#saveBar:not(.hidden)');
  await ad.click('button:has-text("Simpan soal")'); await ad.waitForFunction(() => document.querySelectorAll('table.t tbody tr').length === 7, null, { timeout: 8000 });
  assert(env.ctx.getQuestions_().length === 7, '7 soal valid di sheet'); ok('simpan soal hasil impor → tersimpan ke sheet Soal (7 soal)');
  // impor xlsx hasil template
  const dl = ad.waitForEvent('download'); await ad.click('button:has-text("Unduh template Excel")'); const tpl = await dl; await tpl.saveAs('/tmp/template-soal.xlsx');
  await ad.setInputFiles('input[type=file] >> nth=0', '/tmp/template-soal.xlsx'); await ad.waitForSelector('.modal');
  assert((await ad.textContent('.modal')).includes('5 soal'), 'impor template xlsx'); ok('template Excel dapat diunduh dan diimpor kembali (5 soal)');
  await ad.click('button:has-text("Batal")');
  // ekspor json
  const dj = ad.waitForEvent('download'); await ad.click('button:has-text("Ekspor JSON")'); const jf = await dj; await jf.saveAs('/tmp/ekspor.json');
  assert(JSON.parse(fs.readFileSync('/tmp/ekspor.json', 'utf8')).soal.length === 7, 'json'); ok('ekspor JSON berisi 7 soal');
  // pengaturan
  await ad.click('button[role=tab]:has-text("Pengaturan")'); await ad.waitForSelector('.settings-group');
  await ad.screenshot({ path: SHOTS + '/10-admin-setelan.png', fullPage: true });
  await ad.click('button:has-text("Simpan pengaturan")'); await ad.waitForSelector('.toast');
  assert(env.ctx.getSettings_(true).password_guru === 'rahasia123', 'password tidak berubah bila kosong'); ok('simpan pengaturan tidak mengubah password bila dikosongkan');
  await ad.click('button[role=tab]:has-text("Hasil")'); await ad.waitForSelector('table.t');
  assert((await ad.textContent('table.t')).includes('Sari'), 'hasil'); ok('tab hasil menampilkan nilai siswa');
  await ad.screenshot({ path: SHOTS + '/11-admin-hasil.png' });
  const dx = ad.waitForEvent('download'); await ad.click('button:has-text("Unduh nilai")'); assert((await dx).suggestedFilename().endsWith('.xlsx'), 'xlsx'); ok('unduh nilai Excel berfungsi');

  console.log('\nerror konsol browser:', errors.length ? errors : 'tidak ada');
  await browser.close(); srv.close();
  if (errors.length) process.exit(1);
  console.log('SEMUA TES E2E LULUS (' + n + ')');
})().catch(e => { console.error(e); process.exit(1); });

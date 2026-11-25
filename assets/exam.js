/* Halaman siswa: login, ujian layar penuh, deteksi pelanggaran, pengiriman jawaban */
(function () {
  'use strict';
  const { API, h, $, fmtTime } = AppCommon;

  const LABEL = {
    PINDAH_TAB: 'Berpindah tab / menyembunyikan halaman', KELUAR_LAYAR_PENUH: 'Keluar dari layar penuh',
    PINDAH_JENDELA: 'Berpindah jendela / aplikasi', LAMA_DI_LUAR: 'Terlalu lama di luar halaman ujian',
    KLIK_KANAN: 'Klik kanan', SALIN_TEMPEL: 'Salin / tempel / potong', SHORTCUT_TERLARANG: 'Menekan tombol terlarang',
    MUAT_ULANG: 'Memuat ulang halaman'
  };
  const TIPE = { PG: 'Pilihan ganda', PGK: 'Pilihan ganda kompleks', BS: 'Benar / Salah', ISIAN: 'Isian singkat' };

  const S = {
    info: null, sid: null, soal: [], jawaban: {}, ragu: {}, idx: 0, batas: 0, offset: 0, poin: 0, maks: 0,
    active: false, ending: false, queue: [], dirty: false, syncing: false, guardFrom: 0, episode: null,
    awaySince: 0, lastAwayPen: 0, lastMsg: '', rate: {}, wake: null, syncTimer: null, peserta: null
  };

  /* ---------- util layar ---------- */
  function show(id) { ['screenGate', 'screenExam', 'screenDone'].forEach(x => $('#' + x).classList.toggle('hidden', x !== id)); window.scrollTo(0, 0); }
  function layer(node) { $('#layer').replaceChildren(node || ''); }
  function isFs() { return !!(document.fullscreenElement || document.webkitFullscreenElement); }
  function enterFs() {
    const el = document.documentElement;
    const fn = el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen;
    if (!fn) return Promise.reject(new Error('unsupported'));
    return Promise.resolve(fn.call(el));
  }
  function exitFs() {
    try { const fn = document.exitFullscreen || document.webkitExitFullscreen; if (fn && isFs()) Promise.resolve(fn.call(document)).catch(() => {}); } catch (_) {}
  }
  function compliant() { return isFs() && !document.hidden && document.hasFocus(); }
  const serverNow = () => Date.now() + S.offset;

  /* ---------- layar masuk ---------- */
  async function boot() {
    const alertBox = $('#gAlert');
    try {
      const r = await API.call('info');
      S.info = r.info; renderGate();
    } catch (e) {
      alertBox.replaceChildren(h('div', { class: 'alert err', text: e.message }));
      $('#gTitle').textContent = 'Asesmen Sumatif Akhir Semester';
    }
  }

  function renderGate() {
    const i = S.info;
    document.title = i.judul + ' - ' + i.mapel + ' ' + i.kelas;
    $('#gSchool').textContent = i.sekolah;
    $('#gTitle').textContent = i.judul;
    $('#gMeta').replaceChildren(
      h('span', { class: 'chip', text: i.mapel }), h('span', { class: 'chip', text: 'Kelas ' + i.kelas }),
      h('span', { class: 'chip', text: i.semester + ' ' + i.tahunAjaran }), h('span', { class: 'chip', text: i.durasi + ' menit' }),
      h('span', { class: 'chip', text: i.jumlahSoal + ' soal' }), h('span', { class: 'chip', text: 'Guru: ' + i.guru }));
    $('#gCatatan').textContent = i.catatan || '';
    $('#fToken').classList.toggle('hidden', !i.butuhToken);
    $('#fPin').classList.toggle('hidden', !i.hanyaTerdaftar);
    $('#fNama').classList.toggle('hidden', i.hanyaTerdaftar);
    $('#fKelas').classList.toggle('hidden', i.hanyaTerdaftar);
    if (i.hanyaTerdaftar) $('#lblNisn').textContent = 'NISN / nomor absen terdaftar';

    const rules = [];
    rules.push(['', 'Ujian berjalan di layar penuh. Jangan keluar dari layar penuh sampai selesai.']);
    const p = i.poin;
    const add = (k, t) => rules.push([p[k], t]);
    add('PINDAH_TAB', 'Membuka tab lain atau menyembunyikan halaman ujian');
    add('KELUAR_LAYAR_PENUH', 'Keluar dari layar penuh (tombol Esc / F11)');
    add('PINDAH_JENDELA', 'Pindah ke aplikasi atau jendela lain');
    if (i.intervalLuar > 0) rules.push([p.LAMA_DI_LUAR, 'Tambahan setiap ' + i.intervalLuar + ' detik berada di luar halaman ujian']);
    add('KLIK_KANAN', 'Klik kanan');
    add('SALIN_TEMPEL', 'Menyalin, menempel, atau memotong teks');
    add('SHORTCUT_TERLARANG', 'Menekan F12, Ctrl+U, Ctrl+P, Ctrl+S, dan sejenisnya');
    add('MUAT_ULANG', 'Memuat ulang halaman atau masuk ulang saat ujian berjalan');
    $('#gRules').replaceChildren(...rules.map(([pt, t]) => h('li', null,
      pt === '' ? h('span', { class: 'pt zero', text: '!' }) : h('span', { class: 'pt' + (pt === 0 ? ' zero' : ''), text: '+' + pt }), h('span', { text: t }))));
    $('#gLimit').textContent = i.maks > 0
      ? 'Jika total poin pelanggaran mencapai ' + i.maks + ', ujian dihentikan otomatis dan dilaporkan ke guru.'
      : 'Semua pelanggaran dicatat dan dilaporkan ke guru.';

    const alertBox = $('#gAlert'), btn = $('#btnStart');
    alertBox.replaceChildren();
    if (i.status !== 'DIBUKA') alertBox.append(h('div', { class: 'alert info', text: 'Ujian belum dibuka. Tunggu aba-aba dari guru, lalu muat ulang halaman ini.' }));
    else if (!i.jumlahSoal) alertBox.append(h('div', { class: 'alert err', text: 'Soal belum tersedia. Hubungi guru.' }));
    const supported = !!(document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen);
    if (!supported) alertBox.append(h('div', { class: 'alert err', text: 'Browser ini tidak mendukung layar penuh (misalnya iPhone). Gunakan laptop, tablet, atau HP Android dengan Chrome.' }));
    const refresh = () => { btn.disabled = !($('#inAgree').checked && i.status === 'DIBUKA' && i.jumlahSoal > 0 && supported); };
    $('#inAgree').addEventListener('change', refresh); refresh();
    try { const sv = JSON.parse(localStorage.getItem('asesmen_ident') || '{}'); if (sv.nama) $('#inNama').value = sv.nama; if (sv.nisn) $('#inNisn').value = sv.nisn; if (sv.kelas) $('#inKelas').value = sv.kelas; } catch (_) {}
  }

  async function onStart(ev) {
    ev.preventDefault();
    const i = S.info, btn = $('#btnStart'), alertBox = $('#gAlert');
    const nama = $('#inNama').value.trim(), nisn = $('#inNisn').value.trim(), kelas = $('#inKelas').value.trim();
    const err = m => { alertBox.replaceChildren(h('div', { class: 'alert err', text: m })); btn.disabled = false; btn.textContent = 'Mulai ujian (layar penuh)'; };
    if (!i.hanyaTerdaftar && !nama) return err('Nama wajib diisi.');
    if (!nisn) return err('Nomor absen / NISN wajib diisi.');
    if (i.butuhToken && !$('#inToken').value.trim()) return err('Token ujian wajib diisi.');
    btn.disabled = true; btn.replaceChildren(h('span', { class: 'spinner' }), ' Memeriksa…');
    alertBox.replaceChildren();
    try { await enterFs(); } catch (e) { return err('Layar penuh ditolak oleh browser. Izinkan layar penuh lalu coba lagi, atau gunakan Chrome di laptop/Android.'); }
    try {
      try { localStorage.setItem('asesmen_ident', JSON.stringify({ nama, nisn, kelas })); } catch (_) {}
      const r = await API.call('login', { nama, nisn, kelas, token: $('#inToken').value.trim(), pin: $('#inPin').value.trim(), ua: navigator.userAgent.slice(0, 120) });
      if (r.done) { exitFs(); return endExam(r); }
      beginExam(r);
    } catch (e) { exitFs(); err(e.message); }
  }

  /* ---------- mulai ujian ---------- */
  function beginExam(r) {
    S.sid = r.sid; S.soal = r.soal; S.peserta = r.peserta; S.batas = r.batas; S.offset = r.serverNow - Date.now();
    S.poin = r.poin; S.maks = r.maks; S.idx = 0; S.ending = false; S.queue = []; S.awaySince = 0; S.episode = null;
    S.jawaban = Object.assign({}, r.jawaban || {}); S.ragu = {};
    try { const loc = JSON.parse(localStorage.getItem('asesmen_ans_' + S.sid) || 'null'); if (loc) { S.jawaban = Object.assign({}, S.jawaban, loc.jawaban || {}); S.ragu = loc.ragu || {}; } } catch (_) {}
    S.active = true; S.guardFrom = Date.now() + 2500;
    $('#xWho').textContent = S.peserta.nama; $('#xSub').textContent = 'Kelas ' + (S.peserta.kelas || '-') + ' · ' + S.info.mapel;
    show('screenExam'); layer(); renderStrikes(); renderQ();
    if (r.resumed) showToast('Anda masuk kembali. Pelanggaran "memuat ulang halaman" dicatat.');
    try { if (navigator.wakeLock) navigator.wakeLock.request('screen').then(w => { S.wake = w; }).catch(() => {}); } catch (_) {}
    clearInterval(S.tick); S.tick = setInterval(tick, 500);
    clearInterval(S.syncTimer); S.syncTimer = setInterval(() => flush(), 20000);
    if (S.noBind !== true) { bindGuards(); S.noBind = true; }
    tick();
  }

  /* ---------- tampilan soal ---------- */
  function renderStrikes() {
    const box = $('#xStrikes'); box.replaceChildren();
    box.classList.toggle('danger', S.maks > 0 && S.maks - S.poin <= 1);
    if (S.maks > 0 && S.maks <= 10) {
      box.append(h('span', { text: 'Pelanggaran ' }));
      for (let k = 1; k <= S.maks; k++) box.append(h('span', { class: 'pip' + (k <= S.poin ? ' on' : '') }));
    } else box.append(h('span', { text: 'Poin pelanggaran: ' + S.poin + (S.maks > 0 ? '/' + S.maks : '') }));
  }

  function answered(q) { const a = S.jawaban[q.id]; return a != null && String(a).trim() !== ''; }

  function renderGrid() {
    const g = $('#qgrid'); g.replaceChildren();
    S.soal.forEach((q, k) => g.append(h('button', {
      type: 'button', class: (answered(q) ? 'ans ' : '') + (S.ragu[q.id] ? 'flag ' : '') + (k === S.idx ? 'cur' : ''),
      'aria-label': 'Soal ' + (k + 1), text: String(k + 1), onclick: () => { S.idx = k; renderQ(); $('#sidebar').classList.remove('open'); }
    })));
  }

  function setAnswer(q, val) {
    if (val == null || val === '') delete S.jawaban[q.id]; else S.jawaban[q.id] = val;
    S.dirty = true; saveLocal(); renderGrid();
    clearTimeout(S.debounce); S.debounce = setTimeout(() => flush(), 1500);
  }
  function saveLocal() { try { localStorage.setItem('asesmen_ans_' + S.sid, JSON.stringify({ jawaban: S.jawaban, ragu: S.ragu })); } catch (_) {} }

  function renderQ() {
    const q = S.soal[S.idx], card = $('#qcard'); card.replaceChildren();
    card.append(h('div', { class: 'qhead' }, h('span', { text: 'Soal ' + (S.idx + 1) + ' dari ' + S.soal.length }), h('span', { class: 'tag', text: TIPE[q.tipe] })));
    if (q.gambar) {
      const img = h('img', { class: 'q-img', src: q.gambar, alt: 'Gambar soal ' + (S.idx + 1), referrerpolicy: 'no-referrer' });
      img.addEventListener('click', () => layer(h('div', { class: 'lightbox', onclick: () => layer() }, h('img', { src: q.gambar, alt: '' }))));
      img.addEventListener('error', () => { if (!img.dataset.retry) { img.dataset.retry = 1; setTimeout(() => { img.src = q.gambar + (q.gambar.includes('?') ? '&' : '?') + 'r=' + Date.now(); }, 1500); } else img.replaceWith(h('p', { class: 'alert err', text: 'Gambar gagal dimuat. Muat ulang tidak diperlukan; beri tahu pengawas.' })); });
      card.append(img);
    }
    if (q.teks) card.append(h('p', { class: 'q-text', dir: 'auto', text: q.teks }));

    if (q.tipe === 'PG' || q.tipe === 'BS') {
      const wrap = h('div', { class: 'opts' + (q.tipe === 'BS' ? ' bs' : ''), role: 'radiogroup' });
      q.opsi.forEach((o, k) => {
        const sel = S.jawaban[q.id] === o.k;
        wrap.append(h('button', { type: 'button', class: 'opt' + (sel ? ' sel' : ''), role: 'radio', 'aria-checked': sel, onclick: () => { setAnswer(q, o.k); renderQ(); } },
          q.tipe === 'PG' ? h('span', { class: 'badge', text: String.fromCharCode(65 + k) }) : null, h('span', { class: 't', dir: 'auto', text: o.t })));
      });
      card.append(wrap);
    } else if (q.tipe === 'PGK') {
      card.append(h('p', { class: 'hint', text: 'Pilih semua jawaban yang benar.' }));
      const cur = String(S.jawaban[q.id] || '').split(',').filter(Boolean);
      const wrap = h('div', { class: 'opts' });
      q.opsi.forEach((o, k) => {
        const sel = cur.includes(o.k);
        wrap.append(h('button', { type: 'button', class: 'opt sq' + (sel ? ' sel' : ''), role: 'checkbox', 'aria-checked': sel, onclick: () => {
          const set = new Set(cur); set.has(o.k) ? set.delete(o.k) : set.add(o.k);
          setAnswer(q, Array.from(set).sort().join(',')); renderQ();
        } }, h('span', { class: 'badge', text: String.fromCharCode(65 + k) }), h('span', { class: 't', dir: 'auto', text: o.t })));
      });
      card.append(wrap);
    } else {
      const inp = h('input', { type: 'text', class: 'isian', maxlength: 200, placeholder: 'Ketik jawaban Anda di sini', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', value: S.jawaban[q.id] || '' });
      inp.addEventListener('input', () => setAnswer(q, inp.value));
      card.append(inp);
    }
    if (answered(q)) card.append(h('button', { type: 'button', class: 'clear', text: 'Hapus jawaban', onclick: () => { setAnswer(q, ''); renderQ(); } }));

    card.append(h('div', { class: 'qnav' },
      h('button', { class: 'btn', type: 'button', disabled: S.idx === 0, text: '‹ Sebelumnya', onclick: () => { S.idx--; renderQ(); } }),
      h('button', { class: 'btn ' + (S.ragu[q.id] ? 'gold' : ''), type: 'button', text: S.ragu[q.id] ? 'Ragu-ragu ✓' : 'Tandai ragu-ragu', onclick: () => { S.ragu[q.id] = !S.ragu[q.id]; saveLocal(); renderQ(); } }),
      h('button', { class: 'btn mobile-only', type: 'button', text: 'Daftar soal', onclick: () => $('#sidebar').classList.add('open') }),
      S.idx < S.soal.length - 1
        ? h('button', { class: 'btn primary', type: 'button', text: 'Berikutnya ›', onclick: () => { S.idx++; renderQ(); } })
        : h('button', { class: 'btn gold', type: 'button', text: 'Selesai & kumpulkan', onclick: confirmFinish })));
    renderGrid(); window.scrollTo(0, 0);
  }

  /* ---------- timer ---------- */
  function tick() {
    if (!S.active) return;
    const left = (S.batas - serverNow()) / 1000, t = $('#xTimer');
    t.textContent = fmtTime(left);
    t.className = 'timer' + (left <= 60 ? ' crit' : left <= 300 ? ' warn' : '');
    const now = Date.now();
    if (S.awaySince && S.info.intervalLuar > 0 && now - S.lastAwayPen >= S.info.intervalLuar * 1000) {
      S.lastAwayPen = now; report('LAMA_DI_LUAR', 'di luar ' + Math.round((now - S.awaySince) / 1000) + ' detik');
    }
    if (!compliant()) evaluate();
    updateBlock();
    if (left <= 0 && !S.ending) doFinish(true);
  }

  /* ---------- sinkron ke server ---------- */
  async function flush() {
    if (!S.active || S.syncing || S.ending) return;
    S.syncing = true;
    try {
      while (S.queue.length) { const v = S.queue[0]; const r = await API.call('violation', { sid: S.sid, jenis: v.jenis, detail: v.detail }); S.queue.shift(); if (applyServer(r)) return; }
      const r = await API.call('sync', { sid: S.sid, jawaban: S.jawaban });
      S.dirty = false; netOk(true);
      if (r.serverNow) S.offset = r.serverNow - Date.now();
      applyServer(r);
    } catch (e) { netOk(false); if (e.server && /Sesi/.test(e.message)) { endExam({ status: 'DIRESET', reset: true }); } }
    finally { S.syncing = false; }
  }
  function netOk(ok) { $('#conn').classList.toggle('hidden', ok); }
  function applyServer(r) {
    if (r.done) { endExam(r); return true; }
    if (typeof r.poin === 'number') { S.poin = r.poin; if (r.maks != null) S.maks = r.maks; renderStrikes(); }
    return false;
  }

  /* ---------- pelanggaran ---------- */
  async function report(jenis, detail) {
    if (!S.active || S.ending) return;
    try {
      const r = await API.call('violation', { sid: S.sid, jenis, detail });
      if (r.dup) return;
      if (applyServer(r)) return;
      if (r.tambah > 0) {
        const sisa = S.maks > 0 ? S.maks - S.poin : null;
        S.lastMsg = 'Pelanggaran tercatat: ' + LABEL[jenis] + ' (+' + r.tambah + ' poin). Total ' + S.poin + (S.maks > 0 ? ' dari ' + S.maks : '') + '.' + (sisa != null && sisa <= 2 ? ' Sedikit lagi, ujian akan dihentikan!' : '');
        showToast(S.lastMsg);
      }
    } catch (e) {
      if (!e.server) { S.queue.push({ jenis, detail }); netOk(false); }
    }
  }
  function rated(jenis, detail) { const n = Date.now(); if (S.rate[jenis] && n - S.rate[jenis] < 1500) return; S.rate[jenis] = n; if (Date.now() >= S.guardFrom) report(jenis, detail); }

  function note(type) {
    if (!S.active || Date.now() < S.guardFrom) return;
    if (!S.episode) { S.episode = { types: new Set() }; setTimeout(flushEpisode, 500); }
    S.episode.types.add(type);
  }
  function flushEpisode() {
    const ep = S.episode; S.episode = null;
    if (!ep || !S.active) return;
    const t = ep.types;
    if (t.size === 1 && t.has('PINDAH_JENDELA') && compliant()) return; // kedipan fokus singkat
    const jenis = t.has('PINDAH_TAB') ? 'PINDAH_TAB' : t.has('KELUAR_LAYAR_PENUH') ? 'KELUAR_LAYAR_PENUH' : 'PINDAH_JENDELA';
    report(jenis, Array.from(t).join('+'));
  }
  function evaluate() {
    if (!S.active) return;
    if (compliant()) { if (S.awaySince) { S.awaySince = 0; layer(); } return; }
    if (Date.now() < S.guardFrom) return;
    if (!S.awaySince) { S.awaySince = Date.now(); S.lastAwayPen = S.awaySince; }
    showBlock();
  }
  function showBlock() {
    if ($('#block')) return;
    const msg = h('p', { id: 'blockMsg' });
    layer(h('div', { class: 'overlay', id: 'block', role: 'alertdialog', 'aria-modal': 'true' }, h('div', { class: 'box' },
      h('h2', { class: 'title-serif', text: 'Kembali ke layar penuh' }), msg,
      h('button', { class: 'btn primary block', type: 'button', text: 'Lanjutkan ujian', onclick: () => { enterFs().catch(() => {}); window.focus(); setTimeout(evaluate, 300); } }))));
    updateBlock();
  }
  function updateBlock() {
    const m = $('#blockMsg'); if (!m) return;
    const base = !isFs() ? 'Anda keluar dari layar penuh.' : 'Halaman ujian tidak aktif.';
    m.textContent = base + ' Waktu tetap berjalan' + (S.lastMsg ? '. ' + S.lastMsg : '.');
  }
  function showToast(text) {
    const t = h('div', { class: 'toast', role: 'alert', text });
    document.body.append(t); setTimeout(() => t.remove(), 6500);
  }

  function bindGuards() {
    ['fullscreenchange', 'webkitfullscreenchange'].forEach(ev => document.addEventListener(ev, () => { if (!isFs()) note('KELUAR_LAYAR_PENUH'); evaluate(); }));
    document.addEventListener('visibilitychange', () => { if (document.hidden) note('PINDAH_TAB'); evaluate(); });
    window.addEventListener('blur', () => { note('PINDAH_JENDELA'); setTimeout(evaluate, 100); });
    window.addEventListener('focus', evaluate);
    document.addEventListener('contextmenu', e => { if (!S.active) return; e.preventDefault(); rated('KLIK_KANAN'); });
    ['copy', 'cut', 'paste'].forEach(ev => document.addEventListener(ev, e => { if (!S.active) return; e.preventDefault(); rated('SALIN_TEMPEL'); }));
    document.addEventListener('dragstart', e => { if (S.active) e.preventDefault(); });
    document.addEventListener('selectstart', e => { if (S.active && !(e.target && e.target.tagName === 'INPUT')) e.preventDefault(); });
    document.addEventListener('keydown', e => {
      if (!S.active) return;
      const low = String(e.key).toLowerCase(), ctrl = e.ctrlKey || e.metaKey;
      if (ctrl && ['c', 'x', 'v'].includes(low)) { e.preventDefault(); rated('SALIN_TEMPEL'); return; }
      if (ctrl && low === 'a') { e.preventDefault(); return; }
      if (e.key === 'F12' || e.key === 'F5' || (ctrl && e.shiftKey && ['i', 'j', 'c', 'k'].includes(low)) || (ctrl && ['u', 's', 'p', 'r', 'f', 'g'].includes(low))) { e.preventDefault(); rated('SHORTCUT_TERLARANG', e.key); }
    }, true);
    document.addEventListener('keyup', e => { if (S.active && e.key === 'PrintScreen') { try { navigator.clipboard.writeText(''); } catch (_) {} rated('SHORTCUT_TERLARANG', 'PrintScreen'); } });
    window.addEventListener('beforeunload', e => { if (S.active && !S.ending) { e.preventDefault(); e.returnValue = ''; } });
    window.addEventListener('pagehide', () => {
      if (S.active && S.sid && navigator.sendBeacon) { try { navigator.sendBeacon(window.APP_CONFIG.API_URL, JSON.stringify({ action: 'sync', sid: S.sid, jawaban: S.jawaban })); } catch (_) {} }
    });
    window.addEventListener('online', () => flush());
  }

  /* ---------- kumpulkan ---------- */
  function confirmFinish() {
    const n = S.soal.length, done = S.soal.filter(answered).length, flag = S.soal.filter(q => S.ragu[q.id]).length;
    layer(h('div', { class: 'overlay soft', role: 'dialog', 'aria-modal': 'true' }, h('div', { class: 'box' },
      h('h2', { class: 'title-serif', text: 'Kumpulkan jawaban?' }),
      h('p', { text: 'Terjawab ' + done + ' dari ' + n + ' soal' + (n - done ? ', ' + (n - done) + ' soal masih kosong' : '') + (flag ? ', ' + flag + ' soal ditandai ragu-ragu' : '') + '. Setelah dikumpulkan, jawaban tidak bisa diubah.' }),
      h('div', { style: 'display:grid;gap:.6rem' },
        h('button', { class: 'btn primary', type: 'button', text: 'Ya, kumpulkan sekarang', onclick: () => doFinish(false) }),
        h('button', { class: 'btn', type: 'button', text: 'Periksa lagi', onclick: () => layer() })))));
  }

  async function doFinish(auto) {
    if (S.ending) return; S.ending = true; clearTimeout(S.debounce);
    layer(h('div', { class: 'overlay soft' }, h('div', { class: 'box' }, h('h2', { class: 'title-serif', text: auto ? 'Waktu habis' : 'Mengirim jawaban' }), h('p', { id: 'sendMsg', text: 'Mohon tunggu, jawaban sedang dikirim…' }))));
    for (let attempt = 0; ; attempt++) {
      try {
        const r = await API.call('finish', { sid: S.sid, jawaban: S.jawaban });
        return endExam(r);
      } catch (e) {
        if (e.server) { const m = $('#sendMsg'); if (m) m.textContent = e.message; return; }
        const m = $('#sendMsg'); if (m) m.textContent = 'Koneksi bermasalah, mencoba lagi… (' + (attempt + 1) + '). Jangan tutup halaman ini.';
        await new Promise(r => setTimeout(r, 3000));
      }
    }
  }

  /* ---------- layar akhir ---------- */
  function endExam(r) {
    S.active = false; S.ending = true; clearInterval(S.tick); clearInterval(S.syncTimer);
    try { if (S.wake) S.wake.release(); } catch (_) {}
    try { localStorage.removeItem('asesmen_ans_' + S.sid); } catch (_) {}
    exitFs(); layer();
    const res = r.result || {}, st = r.status, box = $('#doneCard'); box.replaceChildren();
    let judul = 'Jawaban sudah terkirim', pesan = 'Terima kasih, ' + (S.peserta ? S.peserta.nama : '') + '. Jawaban Anda sudah tercatat otomatis.', bad = false;
    if (st === 'DIHENTIKAN') { judul = 'Ujian dihentikan'; pesan = 'Total poin pelanggaran mencapai batas (' + (res.poin != null ? res.poin : '') + '). Jawaban yang sudah masuk tetap tercatat. Lapor kepada guru.'; bad = true; }
    else if (st === 'DIHENTIKAN_GURU') { judul = 'Ujian dihentikan guru'; pesan = 'Guru menghentikan ujian Anda. Jawaban yang sudah masuk tetap tercatat.'; bad = true; }
    else if (st === 'WAKTU_HABIS') { judul = 'Waktu habis'; pesan = 'Jawaban Anda dikumpulkan otomatis.'; }
    else if (st === 'DIRESET' || r.reset) { judul = 'Sesi diatur ulang guru'; pesan = 'Silakan masuk kembali untuk mengerjakan dari awal.'; }
    else if (res.status === 'SELESAI' && !S.peserta) { judul = 'Anda sudah mengerjakan ujian ini'; pesan = 'Setiap siswa hanya dapat mengerjakan satu kali. Hubungi guru bila ada kendala.'; }
    box.append(h('h2', { class: 'title-serif', text: judul }), h('p', { class: 'muted', text: pesan }));
    if (res.tampil && res.nilai != null) {
      box.append(h('div', { class: 'score ' + (res.tuntas ? 'ok' : 'bad'), text: String(res.nilai) }),
        h('div', { class: 'stats' }, h('div', null, h('b', { text: res.benar }), 'benar'), h('div', null, h('b', { text: res.salah }), 'salah'), h('div', null, h('b', { text: res.kosong }), 'kosong')),
        h('p', { class: 'muted', text: res.tuntas ? 'Tuntas (KKM ' + res.kkm + ')' : 'Belum tuntas (KKM ' + res.kkm + ')' }));
    } else if (!bad && !(st === 'DIRESET' || r.reset)) box.append(h('p', { class: 'muted', text: 'Nilai akan diumumkan oleh guru.' }));
    if (st === 'DIRESET' || r.reset) box.append(h('button', { class: 'btn primary', text: 'Masuk kembali', onclick: () => location.reload() }));
    else box.append(h('p', { class: 'note', text: 'Anda boleh menutup halaman ini.' }));
    show('screenDone');
  }

  document.addEventListener('DOMContentLoaded', () => {
    $('#formMasuk').addEventListener('submit', onStart);
    $('#btnFinish').addEventListener('click', confirmFinish);
    $('#btnCloseSide').addEventListener('click', () => $('#sidebar').classList.remove('open'));
    boot();
  });
})();

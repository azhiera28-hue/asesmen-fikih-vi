/* Panel guru: monitor, pengaturan, bank soal (impor/ekspor), siswa, hasil */
(function () {
  'use strict';
  const { API, h, $, fmtTime } = AppCommon;
  const P = SoalParser;
  const app = document.getElementById('app'), modalRoot = document.getElementById('modalRoot');

  const A = { pw: '', settings: {}, tab: 'monitor', questions: [], qDirty: false, students: [], monTimer: null, sheetUrl: '', serverOff: 0 };

  const call = (action, data) => API.call(action, Object.assign({ password: A.pw }, data || {}));
  const TIPE = { PG: 'Pilihan ganda', PGK: 'Pilihan ganda kompleks', BS: 'Benar/Salah', ISIAN: 'Isian singkat' };

  const GROUPS = [
    { t: 'Identitas ujian', f: [
      ['judul_aplikasi', 'Judul aplikasi', 'text'], ['nama_sekolah', 'Nama sekolah / madrasah', 'text'], ['mapel', 'Mata pelajaran', 'text'],
      ['kelas', 'Kelas', 'text'], ['guru', 'Nama guru', 'text'], ['tahun_ajaran', 'Tahun ajaran', 'text'], ['semester', 'Semester', 'select', ['Ganjil', 'Genap']],
      ['catatan_guru', 'Pesan untuk siswa (tampil sebelum ujian)', 'textarea'] ] },
    { t: 'Pelaksanaan', f: [
      ['durasi_menit', 'Lama ujian (menit)', 'number'], ['kkm', 'KKM', 'number'], ['acak_soal', 'Acak urutan soal', 'yn'], ['acak_opsi', 'Acak urutan pilihan jawaban', 'yn'],
      ['tampilkan_nilai_ke_siswa', 'Tampilkan nilai ke siswa setelah selesai', 'yn'], ['hanya_siswa_terdaftar', 'Hanya siswa terdaftar (sheet "Siswa") yang boleh masuk', 'yn'],
      ['nilai_saat_dihentikan', 'Nilai bila ujian dihentikan karena pelanggaran', 'select', ['TERSIMPAN', 'NOL']] ] },
    { t: 'Aturan anti curang', f: [
      ['maks_poin_pelanggaran', 'Batas poin: ujian dihentikan bila total poin mencapai', 'number', null, '0 = tidak dihentikan, hanya dicatat'],
      ['poin_pindah_tab', 'Poin: membuka tab lain / halaman tersembunyi', 'number'], ['poin_keluar_layar_penuh', 'Poin: keluar dari layar penuh', 'number'],
      ['poin_pindah_jendela', 'Poin: pindah jendela / aplikasi', 'number'], ['poin_lama_di_luar', 'Poin tambahan per interval di luar halaman', 'number'],
      ['interval_detik_di_luar', 'Interval waktu di luar (detik)', 'number', null, '0 = nonaktif'], ['poin_klik_kanan', 'Poin: klik kanan', 'number'],
      ['poin_salin_tempel', 'Poin: salin / tempel', 'number'], ['poin_shortcut', 'Poin: tombol terlarang (F12, Ctrl+U, dst.)', 'number'],
      ['poin_muat_ulang', 'Poin: muat ulang halaman / login ulang', 'number'] ] },
    { t: 'Keamanan', f: [['password_guru', 'Ganti password guru', 'password', null, 'Kosongkan bila tidak ingin mengganti. Minimal 6 karakter.']] }
  ];

  /* ---------- util ---------- */
  function toast(msg, bad) {
    const t = h('div', { class: 'toast', style: bad ? '' : 'background:var(--teal)', role: 'status', text: msg });
    document.body.append(t); setTimeout(() => t.remove(), 4500);
  }
  function openModal(title, body, actions) {
    const close = () => modalRoot.replaceChildren();
    modalRoot.replaceChildren(h('div', { class: 'modal', onclick: e => { if (e.target.classList.contains('modal')) close(); } },
      h('div', { class: 'panel', role: 'dialog', 'aria-modal': 'true' }, h('h2', { class: 'title-serif', text: title }), body, h('div', { class: 'actions' }, actions(close)))));
    return close;
  }
  async function busy(btn, fn) {
    const old = btn ? btn.textContent : ''; if (btn) { btn.disabled = true; btn.textContent = 'Memproses…'; }
    try { return await fn(); } catch (e) { toast(e.message, true); } finally { if (btn) { btn.disabled = false; btn.textContent = old; } }
  }
  function download(name, blob) { const a = h('a', { href: URL.createObjectURL(blob), download: name }); document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }
  const tstamp = () => new Date().toISOString().slice(0, 10);
  const slug = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  /* ---------- login ---------- */
  function renderLogin(msg) {
    clearInterval(A.monTimer);
    const pw = h('input', { type: 'password', id: 'pw', autocomplete: 'current-password' });
    const form = h('form', { class: 'card', style: 'max-width:420px;margin:12vh auto 0', onsubmit: async ev => {
      ev.preventDefault(); const b = form.querySelector('button');
      await busy(b, async () => {
        A.pw = pw.value; const r = await call('a_login');
        A.settings = r.settings; A.sheetUrl = r.sheetUrl; try { sessionStorage.setItem('adm_pw', A.pw); } catch (_) {}
        renderShell();
      });
    } },
      h('h1', { class: 'title-serif', style: 'font-size:1.4rem;margin-bottom:.4rem', text: 'Panel Guru' }),
      h('p', { class: 'muted', style: 'margin:0 0 1rem', text: 'Asesmen Sumatif Akhir Semester' }),
      msg ? h('div', { class: 'alert err', text: msg }) : null,
      h('label', { class: 'field' }, h('span', { text: 'Password guru' }), pw,
        h('small', { text: 'Password diatur pada sheet "Pengaturan", baris password_guru.' })),
      h('button', { class: 'btn primary block', type: 'submit', text: 'Masuk' }));
    app.replaceChildren(form); pw.focus();
  }

  /* ---------- kerangka ---------- */
  function renderShell() {
    const s = A.settings, tabs = [['monitor', 'Pantau ujian'], ['soal', 'Bank soal'], ['setelan', 'Pengaturan'], ['siswa', 'Daftar siswa'], ['hasil', 'Hasil & nilai'], ['log', 'Log pelanggaran']];
    app.replaceChildren(h('div', { class: 'admin-shell' },
      h('header', { class: 'masthead admin-head', style: 'border-radius:14px' },
        h('div', null, h('h1', { class: 'title-serif', text: s.judul_aplikasi }), h('small', { text: s.nama_sekolah + ' · ' + s.mapel + ' ' + s.kelas + ' · ' + s.guru })),
        h('div', { style: 'display:flex;gap:.5rem;flex-wrap:wrap' },
          h('a', { class: 'btn sm', href: A.sheetUrl, target: '_blank', rel: 'noopener', text: 'Buka Google Sheet' }),
          h('a', { class: 'btn sm', href: 'index.html', target: '_blank', rel: 'noopener', text: 'Halaman siswa' }),
          h('button', { class: 'btn sm', onclick: () => { try { sessionStorage.removeItem('adm_pw'); } catch (_) {} A.pw = ''; renderLogin(); }, text: 'Keluar' }))),
      h('nav', { class: 'tabs', role: 'tablist' }, tabs.map(([k, l]) => h('button', { role: 'tab', 'aria-selected': A.tab === k, class: A.tab === k ? 'on' : '', text: l, onclick: () => { if (A.tab === 'soal' && A.qDirty && !confirm('Perubahan soal belum disimpan. Tinggalkan halaman ini?')) return; A.tab = k; renderShell(); } }))),
      h('div', { id: 'view' })));
    clearInterval(A.monTimer);
    ({ monitor: viewMonitor, soal: viewSoal, setelan: viewSetelan, siswa: viewSiswa, hasil: viewHasil, log: viewLog })[A.tab]();
  }
  const view = () => document.getElementById('view');

  /* ================= PANTAU ================= */
  function viewMonitor() {
    const v = view(); v.replaceChildren(h('p', { class: 'muted', text: 'Memuat…' }));
    let last = null;
    const draw = (d) => {
      last = d; const open = d.status === 'DIBUKA';
      const run = d.sesi.filter(x => x.status === 'BERLANGSUNG').length, fin = d.sesi.filter(x => x.status !== 'BERLANGSUNG').length;
      const stopped = d.sesi.filter(x => /DIHENTIKAN/.test(x.status)).length;
      v.replaceChildren(
        h('div', { class: 'card', style: 'margin-bottom:1rem' }, h('div', { class: 'big-toggle' },
          h('div', null, h('b', { text: 'Status ujian: ' }), h('span', { class: 'pill ' + (open ? 'run' : 'bad'), text: open ? 'DIBUKA' : 'DITUTUP' })),
          h('button', { class: 'btn ' + (open ? 'danger' : 'primary'), text: open ? 'Tutup ujian' : 'Buka ujian', onclick: async e => busy(e.target, async () => {
            if (open && run > 0 && !confirm(run + ' siswa masih mengerjakan. Menutup ujian hanya mencegah siswa baru masuk. Lanjutkan?')) return;
            await call('a_saveSettings', { values: { status_ujian: open ? 'DITUTUP' : 'DIBUKA' } }); toast(open ? 'Ujian ditutup' : 'Ujian dibuka'); refresh(); }) }),
          d.token ? h('div', null, h('span', { class: 'muted', text: 'Token: ' }), h('span', { class: 'token', text: d.token })) : h('span', { class: 'muted', text: 'Tanpa token (atur di Pengaturan)' }),
          h('button', { class: 'btn sm', text: 'Buat token baru', onclick: async e => busy(e.target, async () => {
            const tk = Array.from({ length: 5 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('');
            await call('a_saveSettings', { values: { token_ujian: tk } }); toast('Token baru: ' + tk); refresh(); }) }))),
        h('div', { class: 'stat-row' },
          stat(d.totalSoal, 'soal valid'), stat(run, 'sedang mengerjakan'), stat(fin, 'sudah selesai'), stat(stopped, 'dihentikan')),
        d.sesi.length ? h('div', { class: 'tablewrap' }, h('table', { class: 't' },
          h('thead', null, h('tr', null, ['Nama', 'Kelas', 'Mulai', 'Terjawab', 'Poin', 'Status', 'Aksi'].map(x => h('th', { text: x })))),
          h('tbody', null, d.sesi.slice().reverse().map(s => h('tr', null,
            h('td', null, h('b', { text: s.nama }), h('div', { class: 'muted', text: s.nisn })), h('td', { text: s.kelas }), h('td', { text: s.mulai.slice(11) }),
            h('td', { text: s.terjawab + '/' + d.totalSoal }),
            h('td', null, h('span', { class: 'pill ' + (d.maks && s.poin >= d.maks ? 'bad' : s.poin > 0 ? 'warn' : ''), text: s.poin + (d.maks ? '/' + d.maks : '') })),
            h('td', null, h('span', { class: 'pill ' + (s.status === 'BERLANGSUNG' ? 'run' : /DIHENTIKAN/.test(s.status) ? 'bad' : ''), text: s.status.replace('_', ' ').toLowerCase() })),
            h('td', { style: 'white-space:nowrap' },
              s.status === 'BERLANGSUNG' ? h('button', { class: 'btn sm danger', text: 'Hentikan', onclick: async e => { if (confirm('Hentikan ujian ' + s.nama + '?')) busy(e.target, async () => { await call('a_stop', { sid: s.sid }); refresh(); }); } }) : null, ' ',
              h('button', { class: 'btn sm', text: 'Beri kesempatan ulang', onclick: async e => { if (confirm('Atur ulang ' + s.nama + '? Nilainya dihapus dan siswa mengerjakan dari awal.')) busy(e.target, async () => { await call('a_reset', { sid: s.sid }); refresh(); }); } })))))))
          : h('div', { class: 'card muted', text: 'Belum ada siswa yang masuk. Bagikan alamat halaman siswa dan token ujian setelah ujian dibuka.' }),
        h('p', { class: 'note', text: 'Tampilan diperbarui otomatis tiap 10 detik.' }));
    };
    const stat = (n, l) => h('div', { class: 'stat' }, h('b', { text: String(n) }), h('span', { text: l }));
    const refresh = async () => { try { draw(await call('a_monitor')); } catch (e) { if (!last) v.replaceChildren(h('div', { class: 'alert err', text: e.message })); } };
    refresh(); A.monTimer = setInterval(refresh, 10000);
  }

  /* ================= PENGATURAN ================= */
  function viewSetelan() {
    const v = view(), s = A.settings, inputs = {};
    v.replaceChildren(...GROUPS.map(g => h('section', { class: 'card settings-group' }, h('h3', { text: g.t }),
      h('div', { class: 'fgrid' }, g.f.map(([k, label, type, opts, hint]) => {
        let el;
        if (type === 'select') el = h('select', null, opts.map(o => h('option', { value: o, selected: String(s[k]).toUpperCase() === o.toUpperCase() || s[k] === o, text: o })));
        else if (type === 'yn') el = h('select', null, ['YA', 'TIDAK'].map(o => h('option', { value: o, selected: String(s[k]).toUpperCase() === o, text: o })));
        else if (type === 'textarea') el = h('textarea', { value: s[k] || '' });
        else el = h('input', { type: type === 'number' ? 'number' : type, min: type === 'number' ? 0 : null, step: 'any', value: k === 'password_guru' ? '' : (s[k] == null ? '' : s[k]), autocomplete: k === 'password_guru' ? 'new-password' : 'off' });
        inputs[k] = el;
        return h('label', { class: 'field' }, h('span', { text: label }), el, hint ? h('small', { text: hint }) : null);
      })))),
      h('div', { class: 'sticky-save', style: 'position:sticky;bottom:0;top:auto' }, h('span', { text: 'Pengaturan juga bisa diubah langsung di sheet "Pengaturan".' }),
        h('button', { class: 'btn primary', text: 'Simpan pengaturan', onclick: async e => busy(e.target, async () => {
          const values = {}; Object.keys(inputs).forEach(k => { values[k] = inputs[k].value; });
          const r = await call('a_saveSettings', { values }); A.settings = r.settings; toast('Pengaturan tersimpan'); renderShell(); }) })));
  }

  /* ================= SOAL ================= */
  async function viewSoal() {
    const v = view(); v.replaceChildren(h('p', { class: 'muted', text: 'Memuat soal…' }));
    try { const r = await call('a_getQuestions'); A.questions = r.questions; A.qDirty = false; } catch (e) { v.replaceChildren(h('div', { class: 'alert err', text: e.message })); return; }
    drawSoal();
  }
  function setDirty() { A.qDirty = true; const b = document.getElementById('saveBar'); if (b) b.classList.remove('hidden'); }

  function drawSoal() {
    const v = view(), qs = A.questions, bad = qs.filter(q => P.validate(q)).length;
    const file = h('input', { type: 'file', multiple: true, class: 'hidden', accept: '.xlsx,.xls,.csv,.docx,.pdf,.txt,.json,.md', onchange: async e => { const fs = Array.from(e.target.files); e.target.value = ''; if (fs.length) await importFiles(fs); } });
    v.replaceChildren(
      h('div', { class: 'card', style: 'margin-bottom:1rem' },
        h('div', { class: 'toolbar' },
          h('button', { class: 'btn primary', text: 'Impor soal dari file', onclick: () => file.click() }), file,
          h('button', { class: 'btn', text: 'Tambah soal', onclick: () => editQuestion(null) }),
          h('span', { class: 'grow' }),
          h('button', { class: 'btn sm', text: 'Ekspor Excel', onclick: () => exportXlsx() }),
          h('button', { class: 'btn sm', text: 'Ekspor JSON + gambar', onclick: e => busy(e.target, exportJson) }),
          h('button', { class: 'btn sm', text: 'Unduh template Excel', onclick: templateXlsx })),
        h('p', { class: 'note', style: 'margin:0', text: 'Format yang bisa diimpor: Excel (.xlsx/.csv), Word (.docx, gambar ikut terbawa), PDF berteks, teks (.txt), dan JSON hasil ekspor aplikasi ini.' })),
      h('div', { id: 'saveBar', class: 'sticky-save ' + (A.qDirty ? '' : 'hidden') }, h('span', { text: 'Ada perubahan yang belum disimpan ke Google Sheet.' }),
        h('button', { class: 'btn primary', text: 'Simpan soal', onclick: saveQuestions })),
      h('div', { class: 'stat-row' }, h('div', { class: 'stat' }, h('b', { text: String(qs.length) }), h('span', { text: 'soal di bank' })),
        h('div', { class: 'stat' }, h('b', { class: bad ? 'err-text' : '', text: String(qs.length - bad) }), h('span', { text: 'soal valid dipakai ujian' })),
        h('div', { class: 'stat' }, h('b', { class: bad ? 'err-text' : '', text: String(bad) }), h('span', { text: 'soal bermasalah (diabaikan)' }))),
      qs.length ? h('div', { class: 'tablewrap' }, h('table', { class: 't' },
        h('thead', null, h('tr', null, ['No', 'Tipe', 'Pertanyaan', 'Kunci', 'Bobot', 'Gambar', ''].map(x => h('th', { text: x })))),
        h('tbody', null, qs.map((q, i) => { const e = P.validate(q); return h('tr', null,
          h('td', { text: String(i + 1) }), h('td', { text: TIPE[q.tipe] }),
          h('td', null, h('div', { text: (q.teks || '(hanya gambar)').slice(0, 140) }), e ? h('div', { class: 'err-text', text: e }) : null),
          h('td', { text: q.kunci }), h('td', { text: String(q.bobot) }), h('td', { text: q.gambar ? 'ya' : '' }),
          h('td', { style: 'white-space:nowrap' },
            h('button', { class: 'btn sm', text: 'Ubah', onclick: () => editQuestion(i) }), ' ',
            h('button', { class: 'btn sm', 'aria-label': 'Naikkan', text: '↑', disabled: i === 0, onclick: () => { [qs[i - 1], qs[i]] = [qs[i], qs[i - 1]]; setDirty(); drawSoal(); } }), ' ',
            h('button', { class: 'btn sm', 'aria-label': 'Turunkan', text: '↓', disabled: i === qs.length - 1, onclick: () => { [qs[i + 1], qs[i]] = [qs[i], qs[i + 1]]; setDirty(); drawSoal(); } }), ' ',
            h('button', { class: 'btn sm danger', text: 'Hapus', onclick: () => { if (confirm('Hapus soal ' + (i + 1) + '?')) { qs.splice(i, 1); setDirty(); drawSoal(); } } }))); }))))
        : h('div', { class: 'card muted', text: 'Bank soal masih kosong. Impor dari file atau tambah soal satu per satu.' }));
  }

  async function saveQuestions(ev) {
    const bad = A.questions.filter(q => P.validate(q)).length;
    if (bad && !confirm(bad + ' soal bermasalah akan tersimpan tetapi tidak dipakai dalam ujian. Lanjutkan menyimpan?')) return;
    await busy(ev.target, async () => {
      const pending = A.questions.filter(q => /^data:image\//.test(q.gambar));
      for (let i = 0; i < pending.length; i++) { toast('Mengunggah gambar ' + (i + 1) + ' dari ' + pending.length + '…'); pending[i].gambar = await uploadDataUrl(pending[i].gambar); }
      const r = await call('a_saveQuestions', { questions: A.questions });
      A.qDirty = false; toast('Tersimpan: ' + r.jumlah + ' soal (' + r.valid + ' valid)'); viewSoal();
    });
  }

  /* gambar: perkecil lalu unggah ke Google Drive */
  function shrink(dataUrl, max) {
    return new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => {
        const k = Math.min(1, max / Math.max(img.width, img.height)), c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(img.width * k)); c.height = Math.max(1, Math.round(img.height * k));
        const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(img, 0, 0, c.width, c.height);
        res(c.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = () => rej(new Error('Gambar tidak dapat dibaca.'));
      img.src = dataUrl;
    });
  }
  async function uploadDataUrl(dataUrl) {
    const small = await shrink(dataUrl, 1100), b64 = small.split(',')[1];
    const r = await call('a_uploadImage', { mime: 'image/jpeg', data: b64 });
    if (!r.shared) toast('Gambar terunggah tetapi belum bisa dibagikan otomatis. Atur folder gambar di Drive ke "Siapa saja dengan link".', true);
    return r.url;
  }
  const driveId = u => { const m = String(u || '').match(/[?&]id=([\w-]{10,})/) || String(u || '').match(/\/d\/([\w-]{10,})/); return m ? m[1] : ''; };

  /* ---------- editor satu soal ---------- */
  function editQuestion(i) {
    const q = i == null ? Object.assign(P.blank(), { tipe: 'PG' }) : JSON.parse(JSON.stringify(A.questions[i]));
    const body = h('div');
    const draw = () => {
      body.replaceChildren(
        h('label', { class: 'field' }, h('span', { text: 'Tipe soal' }), h('select', { onchange: e => { q.tipe = e.target.value; q.kunci = ''; draw(); } }, Object.keys(TIPE).map(k => h('option', { value: k, selected: q.tipe === k, text: TIPE[k] })))),
        h('label', { class: 'field' }, h('span', { text: 'Pertanyaan' }), h('textarea', { value: q.teks, oninput: e => { q.teks = e.target.value; } })),
        h('div', { class: 'field' }, h('span', { style: 'font-weight:600;display:block;margin-bottom:.3rem', text: 'Gambar (opsional)' }),
          q.gambar ? h('img', { class: 'preview-img', src: q.gambar, alt: 'pratinjau' }) : null,
          h('div', { class: 'toolbar', style: 'margin:0' },
            h('input', { type: 'file', accept: 'image/*', onchange: async e => { const f = e.target.files[0]; if (!f) return; const fr = new FileReader(); fr.onload = () => { q.gambar = fr.result; draw(); }; fr.readAsDataURL(f); } }),
            q.gambar ? h('button', { class: 'btn sm', type: 'button', text: 'Hapus gambar', onclick: () => { q.gambar = ''; draw(); } }) : null),
          h('input', { type: 'text', placeholder: 'atau tempel alamat (URL) gambar', value: /^data:/.test(q.gambar) ? '' : q.gambar, onchange: e => { q.gambar = e.target.value.trim(); draw(); }, style: 'margin-top:.4rem' })));
      if (q.tipe === 'PG' || q.tipe === 'PGK') {
        body.append(h('p', { class: 'hint', text: q.tipe === 'PG' ? 'Pilih satu kunci jawaban dengan tombol bulat.' : 'Centang semua kunci jawaban yang benar.' }));
        P.LET.forEach(L => {
          const sel = (q.kunci || '').split(',').includes(L);
          body.append(h('div', { class: 'optrow' }, h('span', { class: 'badge', text: L }),
            h('input', { type: 'text', value: q[L], placeholder: 'Pilihan ' + L, oninput: e => { q[L] = e.target.value; } }),
            h('input', { type: q.tipe === 'PG' ? 'radio' : 'checkbox', name: 'kunci', checked: sel, title: 'Kunci jawaban', 'aria-label': 'Kunci ' + L, onchange: e => {
              if (q.tipe === 'PG') q.kunci = L; else { const set = new Set((q.kunci || '').split(',').filter(Boolean)); e.target.checked ? set.add(L) : set.delete(L); q.kunci = Array.from(set).sort().join(','); } } })));
        });
      } else if (q.tipe === 'BS') {
        body.append(h('label', { class: 'field' }, h('span', { text: 'Kunci jawaban' }), h('select', { onchange: e => { q.kunci = e.target.value; } },
          [['', '— pilih —'], ['BENAR', 'Benar'], ['SALAH', 'Salah']].map(([v, t]) => h('option', { value: v, selected: q.kunci === v, text: t })))));
      } else {
        body.append(h('label', { class: 'field' }, h('span', { text: 'Kunci jawaban' }), h('input', { type: 'text', value: q.kunci, oninput: e => { q.kunci = e.target.value; } }),
          h('small', { text: 'Pisahkan beberapa jawaban yang diterima dengan tanda | , contoh: wudu|wudhu. Huruf besar/kecil dan tanda baca diabaikan.' })));
      }
      body.append(h('label', { class: 'field', style: 'max-width:180px' }, h('span', { text: 'Bobot nilai' }), h('input', { type: 'number', min: '0.5', step: '0.5', value: q.bobot, oninput: e => { q.bobot = e.target.value; } })));
    };
    draw();
    openModal(i == null ? 'Tambah soal' : 'Ubah soal ' + (i + 1), body, close => [
      h('button', { class: 'btn', text: 'Batal', onclick: close }),
      h('button', { class: 'btn primary', text: 'Simpan ke daftar', onclick: () => {
        P.finish(q); const err = P.validate(q);
        if (err && !confirm('Soal ini bermasalah: ' + err + '. Tetap simpan?')) return;
        if (i == null) A.questions.push(q); else A.questions[i] = q; setDirty(); close(); drawSoal(); } })]);
  }

  /* ---------- impor ---------- */
  async function readFileQuestions(f) {
    const name = f.name.toLowerCase(), ext = name.split('.').pop();
    if (['xlsx', 'xls', 'csv'].includes(ext)) {
      const wb = ext === 'csv' ? XLSX.read(await f.text(), { type: 'string' }) : XLSX.read(await f.arrayBuffer(), { type: 'array' });
      const pick = wb.SheetNames.find(n => /^soal$/i.test(n)) || wb.SheetNames[0];
      return P.fromRows(XLSX.utils.sheet_to_json(wb.Sheets[pick], { header: 1, raw: false, defval: '' }));
    }
    if (ext === 'docx') {
      const out = await mammoth.convertToHtml({ arrayBuffer: await f.arrayBuffer() }, { convertImage: mammoth.images.imgElement(img => img.read('base64').then(b => ({ src: 'data:' + img.contentType + ';base64,' + b }))) });
      const doc = new DOMParser().parseFromString('<body>' + out.value + '</body>', 'text/html'), imgs = [];
      return P.parseText(P.htmlToText(doc.body, imgs), imgs);
    }
    if (ext === 'pdf') return parsePdf(f);
    if (ext === 'json') return P.fromJSON(JSON.parse(await f.text()));
    return P.parseText(await f.text());
  }
  async function parsePdf(f) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'lib/pdf.worker.min.js';
    const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(await f.arrayBuffer()) }).promise; let text = '';
    for (let p = 1; p <= pdf.numPages; p++) {
      const items = (await (await pdf.getPage(p)).getTextContent()).items; let y = null, line = '';
      items.forEach(it => { const yy = Math.round(it.transform[5]); if (y !== null && Math.abs(yy - y) > 3) { text += line.trim() + '\n'; line = ''; } line += it.str + (it.hasEOL ? '\n' : ' '); y = yy; });
      text += line.trim() + '\n';
    }
    if (text.replace(/\s/g, '').length < 20) return { questions: [], warnings: ['PDF ini tampaknya hasil pindai (gambar), teksnya tidak bisa dibaca. Ketik ulang ke Word/Excel atau gunakan PDF yang berteks.'] };
    const res = P.parseText(text); res.warnings.unshift('PDF tidak membawa gambar. Tambahkan gambar soal secara manual lewat tombol "Ubah".'); return res;
  }
  async function importFiles(files) {
    const all = [], warns = [];
    for (const f of files) {
      try { const r = P.review(await readFileQuestions(f)); r.questions.forEach(q => all.push(q)); r.warnings.forEach(w => warns.push(f.name + ': ' + w)); }
      catch (e) { warns.push(f.name + ': gagal dibaca (' + e.message + ')'); }
    }
    if (!all.length) { openModal('Tidak ada soal ditemukan', h('div', null, h('p', { text: 'Pastikan format penomoran soal "1." dan pilihan "A." atau gunakan template Excel.' }), warns.length ? h('ul', null, warns.slice(0, 12).map(w => h('li', { text: w }))) : null), close => [h('button', { class: 'btn primary', text: 'Tutup', onclick: close })]); return; }
    let mode = A.questions.length ? 'tambah' : 'ganti';
    const prev = h('div', { style: 'max-height:42vh;overflow:auto;margin:.8rem 0' }, h('div', { class: 'tablewrap' }, h('table', { class: 't', style: 'min-width:0' },
      h('thead', null, h('tr', null, ['No', 'Tipe', 'Pertanyaan', 'Kunci'].map(x => h('th', { text: x })))),
      h('tbody', null, all.map((q, i) => { const e = P.validate(q); return h('tr', null, h('td', { text: String(i + 1) }), h('td', { text: TIPE[q.tipe] }), h('td', null, (q.teks || '(gambar)').slice(0, 90), e ? h('div', { class: 'err-text', text: e }) : null), h('td', { text: q.kunci })); })))));
    openModal('Pratinjau impor: ' + all.length + ' soal', h('div', null,
      h('p', { text: 'Periksa hasil baca di bawah ini. Soal yang bertanda merah perlu diperbaiki (kunci kosong, pilihan kurang, dll.) lewat tombol "Ubah" setelah diimpor.' }),
      warns.length ? h('div', { class: 'alert info' }, warns.slice(0, 6).map(w => h('div', { text: w }))) : null, prev,
      A.questions.length ? h('label', { class: 'field' }, h('span', { text: 'Soal yang sudah ada' }), h('select', { onchange: e => { mode = e.target.value; } },
        [['tambah', 'Tambahkan di bawah soal yang ada'], ['ganti', 'Ganti semua soal yang ada']].map(([v, t]) => h('option', { value: v, selected: mode === v, text: t })))) : null),
      close => [h('button', { class: 'btn', text: 'Batal', onclick: close }), h('button', { class: 'btn primary', text: 'Masukkan ke bank soal', onclick: async e => busy(e.target, async () => {
        for (const q of all) if (q.gambarData) { q.gambar = await uploadDataUrl(q.gambarData); delete q.gambarData; }
        A.questions = mode === 'ganti' ? all : A.questions.concat(all); setDirty(); close(); drawSoal(); toast(all.length + ' soal dimasukkan. Klik "Simpan soal" untuk menyimpan ke Google Sheet.'); }) })]);
  }

  /* ---------- ekspor ---------- */
  const HEAD = ['No', 'Tipe', 'Pertanyaan', 'Opsi A', 'Opsi B', 'Opsi C', 'Opsi D', 'Opsi E', 'Kunci', 'Bobot', 'Gambar (URL)'];
  function exportXlsx() {
    const rows = [HEAD].concat(A.questions.map((q, i) => [i + 1, q.tipe, q.teks, q.A, q.B, q.C, q.D, q.E, q.kunci, q.bobot, /^data:/.test(q.gambar) ? '' : q.gambar]));
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Soal');
    XLSX.writeFile(wb, 'bank-soal-' + slug(A.settings.mapel) + '-' + tstamp() + '.xlsx');
  }
  async function exportJson() {
    const out = [];
    for (const q of A.questions) {
      const o = Object.assign({}, q);
      const id = driveId(q.gambar);
      if (id && /drive\.google\.com/.test(q.gambar)) { try { const r = await call('a_getImage', { id }); o.gambarData = 'data:' + r.mime + ';base64,' + r.data; } catch (_) {} }
      out.push(o);
    }
    download('bank-soal-' + slug(A.settings.mapel) + '-' + tstamp() + '.json', new Blob([JSON.stringify({ versi: 1, mapel: A.settings.mapel, kelas: A.settings.kelas, soal: out }, null, 1)], { type: 'application/json' }));
    toast('JSON diekspor lengkap dengan gambar. Impor di aplikasi lain lewat "Impor soal dari file".');
  }
  function templateXlsx() {
    const rows = [HEAD,
      [1, 'PG', 'Contoh pilihan ganda: ....', 'pilihan A', 'pilihan B', 'pilihan C', 'pilihan D', '', 'B', 1, ''],
      [2, 'PGK', 'Contoh pilihan ganda kompleks (lebih dari satu benar)', 'benar', 'benar', 'salah', 'benar', '', 'A,B,D', 2, ''],
      [3, 'BS', 'Contoh benar/salah.', '', '', '', '', '', 'BENAR', 1, ''],
      [4, 'ISIAN', 'Contoh isian singkat: ....', '', '', '', '', '', 'jawaban1|jawaban2', 1, ''],
      [5, 'PG', 'Contoh soal bergambar (isi kolom Gambar dengan URL)', 'a', 'b', 'c', 'd', '', 'A', 1, 'https://contoh.com/gambar.png']];
    const ket = [['PETUNJUK'], ['Tipe: PG = pilihan ganda, PGK = pilihan ganda kompleks, BS = benar/salah, ISIAN = isian singkat.'], ['Kunci PG: satu huruf (A–E). PGK: huruf dipisah koma (A,C). BS: BENAR / SALAH. ISIAN: jawaban diterima dipisah tanda |.'], ['Bobot: nilai relatif soal (kosong = 1). Nilai akhir = skor diperoleh / total bobot × 100.'], ['Gambar: alamat (URL) gambar. Untuk gambar dari komputer, gunakan impor Word atau tombol Ubah pada panel guru.']];
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Soal'); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(ket), 'Petunjuk');
    XLSX.writeFile(wb, 'template-soal.xlsx');
  }

  /* ================= SISWA ================= */
  async function viewSiswa() {
    const v = view(); v.replaceChildren(h('p', { class: 'muted', text: 'Memuat…' }));
    try { A.students = (await call('a_getStudents')).students; } catch (e) { v.replaceChildren(h('div', { class: 'alert err', text: e.message })); return; }
    const file = h('input', { type: 'file', class: 'hidden', accept: '.xlsx,.xls,.csv', onchange: async e => { const f = e.target.files[0]; e.target.value = ''; if (!f) return;
      const wb = /\.csv$/i.test(f.name) ? XLSX.read(await f.text(), { type: 'string' }) : XLSX.read(await f.arrayBuffer(), { type: 'array' });
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: false, defval: '' }).filter(r => String(r[0]).trim());
      const first = String(rows[0] && rows[0][0]).toLowerCase(); if (/nisn|absen|no|nomor/.test(first)) rows.shift();
      A.students = rows.map(r => ({ nisn: String(r[0]).trim(), nama: String(r[1] || '').trim(), kelas: String(r[2] || '').trim(), pin: String(r[3] || '').trim() })); draw(true); } });
    const draw = (dirty) => v.replaceChildren(
      h('div', { class: 'card', style: 'margin-bottom:1rem' }, h('div', { class: 'toolbar', style: 'margin:0' },
        h('button', { class: 'btn primary', text: 'Impor daftar siswa (Excel/CSV)', onclick: () => file.click() }), file,
        h('button', { class: 'btn sm', text: 'Unduh template', onclick: () => { const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['NISN / No. Absen', 'Nama', 'Kelas', 'PIN (opsional)'], ['001', 'Contoh Siswa', 'VI-A', '']]), 'Siswa'); XLSX.writeFile(wb, 'template-siswa.xlsx'); } }),
        h('span', { class: 'grow' }),
        h('button', { class: 'btn ' + (dirty ? 'gold' : ''), text: 'Simpan daftar siswa', onclick: async e => busy(e.target, async () => { const r = await call('a_saveStudents', { students: A.students }); toast(r.jumlah + ' siswa tersimpan'); viewSiswa(); }) })),
        h('p', { class: 'note', style: 'margin-bottom:0', text: 'Daftar ini hanya dipakai bila "Hanya siswa terdaftar" diaktifkan di Pengaturan. Kolom: NISN/No. absen, Nama, Kelas, PIN (opsional). Daftar dapat juga diisi langsung di sheet "Siswa".' })),
      A.students.length ? h('div', { class: 'tablewrap' }, h('table', { class: 't' }, h('thead', null, h('tr', null, ['NISN / No. Absen', 'Nama', 'Kelas', 'PIN'].map(x => h('th', { text: x })))),
        h('tbody', null, A.students.map(s => h('tr', null, h('td', { text: s.nisn }), h('td', { text: s.nama }), h('td', { text: s.kelas }), h('td', { text: s.pin ? '••••' : '' })))))) : h('div', { class: 'card muted', text: 'Belum ada siswa terdaftar.' }));
    draw(false);
  }

  /* ================= HASIL ================= */
  async function viewHasil() {
    const v = view(); v.replaceChildren(h('p', { class: 'muted', text: 'Memuat…' }));
    let r; try { r = await call('a_results'); } catch (e) { v.replaceChildren(h('div', { class: 'alert err', text: e.message })); return; }
    const rows = r.rows, nil = rows.map(x => x.nilai), avg = nil.length ? nil.reduce((a, b) => a + b, 0) / nil.length : 0;
    v.replaceChildren(
      h('div', { class: 'toolbar' }, h('button', { class: 'btn primary', text: 'Unduh nilai (Excel)', disabled: !rows.length, onclick: () => {
        const data = [['No', 'NISN / No. Absen', 'Nama', 'Kelas', 'Benar', 'Salah', 'Kosong', 'Nilai', 'Ketuntasan', 'Status', 'Poin Pelanggaran', 'Durasi (menit)', 'Waktu Selesai']].concat(rows.map((x, i) => [i + 1, x.nisn, x.nama, x.kelas, x.benar, x.salah, x.kosong, x.nilai, x.tuntas, x.status, x.poin, x.durasi, x.waktu]));
        const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(data), 'Nilai'); XLSX.writeFile(wb, 'nilai-' + slug(A.settings.mapel) + '-kelas-' + slug(A.settings.kelas) + '-' + tstamp() + '.xlsx'); } }),
        h('button', { class: 'btn', text: 'Segarkan', onclick: viewHasil }), h('span', { class: 'grow' }),
        h('button', { class: 'btn sm danger', text: 'Hapus semua data uji coba', onclick: async e => { const k = prompt('Ini menghapus SEMUA sesi, pelanggaran, dan nilai. Soal & pengaturan aman.\nKetik HAPUS untuk melanjutkan:'); if (k === 'HAPUS') busy(e.target, async () => { await call('a_clearData', { konfirmasi: 'HAPUS' }); toast('Data dihapus'); viewHasil(); }); } })),
      h('div', { class: 'stat-row' }, h('div', { class: 'stat' }, h('b', { text: String(rows.length) }), h('span', { text: 'siswa selesai' })), h('div', { class: 'stat' }, h('b', { text: avg.toFixed(1) }), h('span', { text: 'rata-rata nilai' })),
        h('div', { class: 'stat' }, h('b', { text: nil.length ? String(Math.max.apply(null, nil)) : '-' }), h('span', { text: 'tertinggi' })), h('div', { class: 'stat' }, h('b', { text: nil.length ? String(Math.min.apply(null, nil)) : '-' }), h('span', { text: 'terendah' })),
        h('div', { class: 'stat' }, h('b', { text: rows.filter(x => x.tuntas === 'Tuntas').length + '/' + rows.length }), h('span', { text: 'tuntas (KKM ' + r.kkm + ')' }))),
      rows.length ? h('div', { class: 'tablewrap' }, h('table', { class: 't' }, h('thead', null, h('tr', null, ['Nama', 'Kelas', 'Benar', 'Salah', 'Kosong', 'Nilai', 'Status', 'Poin'].map(x => h('th', { text: x })))),
        h('tbody', null, rows.slice().sort((a, b) => a.nama.localeCompare(b.nama)).map(x => h('tr', null, h('td', null, h('b', { text: x.nama }), h('div', { class: 'muted', text: x.nisn })), h('td', { text: x.kelas }), h('td', { text: String(x.benar) }), h('td', { text: String(x.salah) }), h('td', { text: String(x.kosong) }),
          h('td', null, h('b', { text: String(x.nilai) }), ' ', h('span', { class: 'pill ' + (x.tuntas === 'Tuntas' ? 'run' : 'warn'), text: x.tuntas })), h('td', null, h('span', { class: 'pill ' + (/Dihentikan/.test(x.status) ? 'bad' : ''), text: x.status })), h('td', { text: String(x.poin) })))))) : h('div', { class: 'card muted', text: 'Belum ada nilai. Nilai masuk otomatis ke sheet "Nilai" begitu siswa selesai.' }));
  }

  /* ================= LOG ================= */
  async function viewLog() {
    const v = view(); v.replaceChildren(h('p', { class: 'muted', text: 'Memuat…' }));
    try { const r = await call('a_violations');
      v.replaceChildren(h('p', { class: 'note', text: '200 catatan terbaru. Seluruh catatan ada di sheet "Pelanggaran".' }), r.rows.length ? h('div', { class: 'tablewrap' }, h('table', { class: 't' },
        h('thead', null, h('tr', null, ['Waktu', 'Nama', 'Pelanggaran', 'Poin', 'Total', 'Keterangan'].map(x => h('th', { text: x })))),
        h('tbody', null, r.rows.map(x => h('tr', null, h('td', { text: x.waktu.slice(5) }), h('td', { text: x.nama }), h('td', { text: x.jenis.replace(/_/g, ' ').toLowerCase() }), h('td', { text: '+' + x.poin }), h('td', { text: String(x.total) }), h('td', { text: x.ket })))))) : h('div', { class: 'card muted', text: 'Belum ada pelanggaran tercatat.' }));
    } catch (e) { v.replaceChildren(h('div', { class: 'alert err', text: e.message })); }
  }

  /* ---------- mulai ---------- */
  document.addEventListener('DOMContentLoaded', async () => {
    let saved = ''; try { saved = sessionStorage.getItem('adm_pw') || ''; } catch (_) {}
    if (saved) { A.pw = saved; try { const r = await call('a_login'); A.settings = r.settings; A.sheetUrl = r.sheetUrl; return renderShell(); } catch (e) { A.pw = ''; return renderLogin(e.config ? e.message : ''); } }
    renderLogin();
  });
  window.addEventListener('beforeunload', e => { if (A.qDirty) { e.preventDefault(); e.returnValue = ''; } });
})();

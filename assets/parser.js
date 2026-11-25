/* Parser soal: teks / Word / PDF / Excel / CSV / JSON  ->  daftar soal seragam.
 * Bentuk soal: { tipe, teks, A, B, C, D, E, kunci, bobot, gambar, gambarData? }
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SoalParser = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const LET = ['A', 'B', 'C', 'D', 'E'];

  function blank() { return { tipe: 'PG', teks: '', A: '', B: '', C: '', D: '', E: '', kunci: '', bobot: 1, gambar: '' }; }

  function normTipe(v) {
    v = String(v || '').trim().toUpperCase().replace(/[\s_\-]+/g, '');
    if (['PGK', 'PGKOMPLEKS', 'PILIHANGANDAKOMPLEKS', 'KOMPLEKS'].includes(v)) return 'PGK';
    if (['BS', 'BENARSALAH', 'BENARATAUSALAH'].includes(v)) return 'BS';
    if (['ISIAN', 'ISIANSINGKAT', 'IS'].includes(v)) return 'ISIAN';
    return 'PG';
  }

  function normKunci(tipe, k) {
    k = String(k == null ? '' : k).trim();
    if (tipe === 'PG') return (k.toUpperCase().replace(/[^A-E]/g, '').charAt(0)) || '';
    if (tipe === 'PGK') return Array.from(new Set(k.toUpperCase().match(/[A-E]/g) || [])).sort().join(',');
    if (tipe === 'BS') {
      const x = k.toUpperCase().replace(/[^A-Z]/g, '');
      if (['B', 'BENAR', 'TRUE', 'YA'].includes(x)) return 'BENAR';
      if (['S', 'SALAH', 'FALSE', 'TIDAK'].includes(x)) return 'SALAH';
      return '';
    }
    return k;
  }

  function finish(q) {
    q.teks = String(q.teks || '').trim();
    LET.forEach(l => { q[l] = String(q[l] || '').trim(); });
    // tebak tipe bila belum jelas
    const hasOpt = LET.some(l => q[l]);
    if (!q.tipe) {
      const k = String(q.kunci || '').trim();
      if (hasOpt) q.tipe = /[,;]|^[A-Ea-e]\s+[A-Ea-e]/.test(k) ? 'PGK' : 'PG';
      else if (/^(benar|salah|b|s)$/i.test(k)) q.tipe = 'BS';
      else q.tipe = 'ISIAN';
    }
    q.tipe = normTipe(q.tipe);
    if (q.tipe === 'PG' && /^[A-Ea-e]\s*[,;]\s*[A-Ea-e]/.test(String(q.kunci))) q.tipe = 'PGK';
    q.kunci = normKunci(q.tipe, q.kunci);
    if (q.tipe === 'BS' || q.tipe === 'ISIAN') LET.forEach(l => { q[l] = ''; });
    const b = Number(String(q.bobot).replace(',', '.'));
    q.bobot = isFinite(b) && b > 0 ? b : 1;
    q.gambar = String(q.gambar || '').trim();
    return q;
  }

  function validate(q) {
    const keys = LET.filter(l => q[l]);
    if (!q.teks && !q.gambar) return 'Pertanyaan kosong';
    if (q.tipe === 'PG') {
      if (keys.length < 2) return 'Minimal 2 pilihan';
      if (!q.kunci || !keys.includes(q.kunci)) return 'Kunci belum ada / tidak cocok dengan pilihan';
    } else if (q.tipe === 'PGK') {
      if (keys.length < 2) return 'Minimal 2 pilihan';
      const ks = q.kunci ? q.kunci.split(',') : [];
      if (!ks.length || ks.some(k => !keys.includes(k))) return 'Kunci belum ada / tidak cocok dengan pilihan';
    } else if (q.tipe === 'BS') {
      if (!q.kunci) return 'Kunci harus BENAR atau SALAH';
    } else if (q.tipe === 'ISIAN') {
      if (!String(q.kunci).trim()) return 'Kunci isian kosong';
    }
    return '';
  }

  /* ---------- Teks bebas (txt / docx / pdf) ---------- */
  const IMG_RE = /⟦IMG:(\d+)⟧/g;

  function splitKeySection(lines) {
    let idx = -1;
    for (let i = 0; i < lines.length; i++) {
      if (/^\s*(kunci\s*jawaban|kunci|jawaban)\s*:?\s*$/i.test(lines[i]) || /^\s*kunci\s*jawaban\s*[:\-]?\s*\d/i.test(lines[i])) { idx = i; }
    }
    // kunci hanya dianggap bagian akhir bila setelahnya banyak pola "no huruf"
    if (idx < 0) return { body: lines, keys: {} };
    const tail = lines.slice(idx).join(' ').replace(/^\s*(kunci\s*jawaban|kunci|jawaban)\s*[:\-]?/i, ' ');
    const re = /(\d{1,3})\s*[\.\)\-:]?\s*([A-Ea-e](?:\s*,\s*[A-Ea-e])*)(?![A-Za-z])/g;
    const keys = {}; let m, n = 0;
    while ((m = re.exec(tail))) { keys[Number(m[1])] = m[2].replace(/\s+/g, ''); n++; }
    if (n < 2) return { body: lines, keys: {} };
    return { body: lines.slice(0, idx), keys };
  }

  function parseText(text, images) {
    images = images || [];
    const warnings = [];
    let lines = String(text || '').replace(/\r/g, '').split('\n');
    const ks = splitKeySection(lines);
    lines = ks.body;

    const reQ = /^\s*(?:soal\s*)?(\d{1,3})\s*[\.\)\-:]\s*(.*)$/i;
    const reOpt = /^\s*\(?([A-Ea-e])[\.\)]\s+(.*)$/;
    const reKey = /^\s*(?:kunci(?:\s*jawaban)?|jawaban(?:\s*benar)?|key|answer)\s*[:=\-]\s*(.+)$/i;
    const reBobot = /^\s*(?:bobot|skor|poin)\s*[:=]\s*([\d.,]+)\s*$/i;
    const reTipe = /^\s*(?:tipe|jenis)\s*[:=]\s*(\w+)\s*$/i;

    const qs = []; let cur = null, part = null, pendingImg = '';
    const start = (num, rest) => { cur = Object.assign(blank(), { _num: num, tipe: '' }); if (pendingImg) { cur.gambar = pendingImg; pendingImg = ''; } qs.push(cur); part = 'teks'; cur.teks = rest || ''; };
    const addTo = (field, s) => { cur[field] = cur[field] ? cur[field] + (field === 'teks' ? '\n' : ' ') + s : s; };

    for (let raw of lines) {
      let line = raw;
      // gambar
      line = line.replace(IMG_RE, (m, n) => { const src = images[Number(n)]; if (src) { if (cur) { if (!cur.gambar) cur.gambar = src; } else pendingImg = src; } return ' '; });
      line = line.replace(/ /g, ' ').replace(/[ \t]+$/g, '');
      if (!line.trim()) continue;

      // beberapa opsi dalam satu baris: "A. xx B. yy C. zz"
      if (cur && /^\s*\(?A[\.\)]\s/.test(line) && /\s\(?B[\.\)]\s/.test(line)) {
        const parts = line.split(/\s+(?=\(?[B-E][\.\)]\s)/);
        if (parts.length > 1) {
          parts.forEach(p => { const mo = p.match(reOpt); if (mo) { cur[mo[1].toUpperCase()] = mo[2].trim(); part = mo[1].toUpperCase(); } });
          continue;
        }
      }
      let m;
      if ((m = line.match(reKey)) && cur) { cur.kunci = m[1].trim(); part = 'kunci'; continue; }
      if ((m = line.match(reBobot)) && cur) { cur.bobot = m[1]; continue; }
      if ((m = line.match(reTipe)) && cur) { cur.tipe = m[1]; continue; }
      if ((m = line.match(reOpt)) && cur && part !== null) { const L = m[1].toUpperCase(); cur[L] = m[2].trim(); part = L; continue; }
      if ((m = line.match(reQ))) { start(Number(m[1]), m[2].trim()); continue; }
      if (cur) { addTo(part === 'kunci' ? 'kunci' : part, line.trim()); }
      else warnings.push('Baris diabaikan sebelum soal pertama: "' + line.trim().slice(0, 40) + '"');
    }

    qs.forEach(q => {
      if (!q.kunci && ks.keys[q._num]) q.kunci = ks.keys[q._num];
      delete q._num;
      finish(q);
    });
    return { questions: qs, warnings };
  }

  /* ---------- Hasil mammoth (HTML) -> teks bernomor ---------- */
  function htmlToText(rootEl, images) {
    const out = []; let qn = 0;
    const isBlock = t => /^(p|h[1-6]|div|li|td|th)$/.test(t);
    function inline(node) {
      let s = '';
      node.childNodes.forEach(n => {
        if (n.nodeType === 3) s += n.nodeValue;
        else if (n.nodeType === 1) {
          const t = n.tagName.toLowerCase();
          if (t === 'img') { images.push(n.getAttribute('src')); s += ' ⟦IMG:' + (images.length - 1) + '⟧ '; }
          else if (t === 'br') s += '\n';
          else if (t === 'ol' || t === 'ul' || t === 'table') { /* ditangani walker */ }
          else s += inline(n);
        }
      });
      return s;
    }
    function pushLines(s, prefix) {
      const parts = s.split('\n').map(x => x.trim()).filter(Boolean);
      parts.forEach((p, i) => out.push((i === 0 ? prefix : '') + p));
    }
    function list(el, depth) {
      const ordered = el.tagName.toLowerCase() === 'ol'; let i = 0;
      el.childNodes.forEach(li => {
        if (li.nodeType !== 1 || li.tagName.toLowerCase() !== 'li') return;
        i++;
        const t = inline(li).trim();
        let prefix = '';
        if (ordered && depth === 1 && !/^\d+[\.\)]\s/.test(t)) prefix = (++qn) + '. ';
        else if (ordered && depth >= 2 && !/^\(?[A-Ea-e][\.\)]\s/.test(t)) prefix = String.fromCharCode(64 + i) + '. ';
        else if (ordered && depth === 1) qn = parseInt(t, 10) || qn;
        if (t) pushLines(t, prefix);
        li.childNodes.forEach(c => { if (c.nodeType === 1 && /^(ol|ul)$/i.test(c.tagName)) list(c, depth + 1); });
      });
    }
    function table(el) {
      el.querySelectorAll('tr').forEach(tr => {
        const cells = Array.from(tr.children).map(td => inline(td).replace(/\n+/g, '\n').trim());
        if (cells.length >= 3 && /^\d{1,3}\.?$/.test(cells[0]) && /^[A-Ea-e](\s*,\s*[A-Ea-e])*$/.test(cells[cells.length - 1])) {
          const mid = cells.slice(1, -1).join('\n').split('\n').map(x => x.trim()).filter(Boolean);
          mid.forEach((p, i) => out.push(i === 0 ? parseInt(cells[0], 10) + '. ' + p : p));
          out.push('Kunci: ' + cells[cells.length - 1]);
        } else cells.forEach(c => c && pushLines(c, ''));
      });
    }
    function walk(node) {
      node.childNodes.forEach(n => {
        if (n.nodeType !== 1) return;
        const t = n.tagName.toLowerCase();
        if (t === 'ol' || t === 'ul') list(n, 1);
        else if (t === 'table') table(n);
        else if (isBlock(t) && t !== 'div') { const s = inline(n).trim(); if (s) pushLines(s, ''); }
        else walk(n);
      });
    }
    walk(rootEl);
    return out.join('\n');
  }

  /* ---------- Baris tabel (Excel / CSV) ---------- */
  const ALIAS = {
    no: ['no', 'nomor', 'nomer', 'id'],
    tipe: ['tipe', 'tipesoal', 'jenis', 'jenissoal', 'type'],
    teks: ['pertanyaan', 'soal', 'teks', 'teksoal', 'question', 'butirsoal'],
    A: ['a', 'opsia', 'pilihana', 'jawabana', 'optiona'],
    B: ['b', 'opsib', 'pilihanb', 'jawabanb', 'optionb'],
    C: ['c', 'opsic', 'pilihanc', 'jawabanc', 'optionc'],
    D: ['d', 'opsid', 'pilihand', 'jawaband', 'optiond'],
    E: ['e', 'opsie', 'pilihane', 'jawabane', 'optione'],
    kunci: ['kunci', 'kuncijawaban', 'jawaban', 'jawabanbenar', 'key', 'answer'],
    bobot: ['bobot', 'skor', 'poin', 'score', 'weight'],
    gambar: ['gambar', 'gambarurl', 'urlgambar', 'image', 'foto', 'linkgambar']
  };
  const norm = h => String(h == null ? '' : h).toLowerCase().replace(/[^a-z0-9]/g, '');

  function fromRows(rows) {
    const warnings = [];
    rows = (rows || []).filter(r => Array.isArray(r) && r.some(c => String(c == null ? '' : c).trim() !== ''));
    if (!rows.length) return { questions: [], warnings: ['File kosong.'] };
    let map = null, startAt = 0;
    for (let i = 0; i < Math.min(rows.length, 5); i++) {
      const m = {}; let hit = 0;
      rows[i].forEach((c, idx) => {
        const h = norm(c);
        for (const f in ALIAS) if (!(f in m) && ALIAS[f].includes(h)) { m[f] = idx; hit++; break; }
      });
      if ('teks' in m && hit >= 2) { map = m; startAt = i + 1; break; }
    }
    if (!map) {
      map = { no: 0, tipe: 1, teks: 2, A: 3, B: 4, C: 5, D: 6, E: 7, kunci: 8, bobot: 9, gambar: 10 };
      if (rows[0].length < 4) return { questions: [], warnings: ['Judul kolom tidak dikenali. Gunakan template yang disediakan.'] };
      warnings.push('Judul kolom tidak ditemukan, urutan kolom standar dipakai (No, Tipe, Pertanyaan, A–E, Kunci, Bobot, Gambar).');
    }
    const qs = [];
    for (let i = startAt; i < rows.length; i++) {
      const r = rows[i], g = f => (f in map ? String(r[map[f]] == null ? '' : r[map[f]]).trim() : '');
      const q = blank();
      q.tipe = g('tipe'); q.teks = g('teks'); q.kunci = g('kunci'); q.bobot = g('bobot') || 1; q.gambar = g('gambar');
      LET.forEach(l => { q[l] = g(l); });
      if (!q.teks && !q.gambar) continue;
      qs.push(finish(q));
    }
    return { questions: qs, warnings };
  }

  /* ---------- JSON ---------- */
  function fromJSON(obj) {
    const warnings = [];
    const list = Array.isArray(obj) ? obj : (obj && (obj.soal || obj.questions)) || [];
    const qs = list.map(it => {
      const q = blank();
      q.tipe = it.tipe || it.type || '';
      q.teks = it.teks || it.pertanyaan || it.soal || it.question || '';
      const op = it.opsi || it.options;
      if (Array.isArray(op)) op.forEach((o, i) => { if (i < 5) q[LET[i]] = typeof o === 'string' ? o : (o && (o.teks || o.t || o.text)) || ''; });
      else if (op && typeof op === 'object') LET.forEach(l => { q[l] = op[l] || op[l.toLowerCase()] || ''; });
      LET.forEach(l => { if (it[l] != null) q[l] = it[l]; });
      q.kunci = it.kunci || it.jawaban || it.answer || '';
      q.bobot = it.bobot || it.skor || 1;
      q.gambar = it.gambar || it.image || '';
      if (it.gambarData) q.gambarData = it.gambarData;
      return finish(q);
    }).filter(q => q.teks || q.gambar);
    if (!qs.length) warnings.push('Tidak ada soal ditemukan dalam JSON.');
    return { questions: qs, warnings };
  }

  /* ---------- Ringkas hasil validasi ---------- */
  function review(res) {
    res.questions.forEach((q, i) => { const e = validate(q); if (e) res.warnings.push('Soal ' + (i + 1) + ': ' + e); });
    return res;
  }

  return { blank, normTipe, normKunci, finish, validate, parseText, htmlToText, fromRows, fromJSON, review, LET };
});

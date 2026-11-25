/* Utilitas bersama: pemanggilan API Apps Script + pembuat elemen */
(function () {
  'use strict';
  const API = {
    async call(action, data) {
      const url = (window.APP_CONFIG || {}).API_URL || '';
      if (!/^https:\/\/script\.google(usercontent)?\.com\//.test(url)) {
        const e = new Error('Alamat server belum diatur. Isi API_URL pada file config.js (lihat README langkah 5).');
        e.config = true; throw e;
      }
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 60000);
      try {
        const r = await fetch(url, {
          method: 'POST', redirect: 'follow', signal: ctrl.signal,
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(Object.assign({ action }, data || {}))
        });
        let j;
        try { j = await r.json(); } catch (_) { throw new Error('Server tidak memberi jawaban yang valid. Pastikan Deploy diatur "Siapa saja" dan URL berakhiran /exec.'); }
        if (!j.ok) { const e = new Error(j.error || 'Terjadi kesalahan di server.'); e.server = true; throw e; }
        return j;
      } catch (e) {
        if (e.name === 'AbortError') { const x = new Error('Koneksi lambat (waktu habis).'); x.net = true; throw x; }
        if (!e.server && !e.config && e instanceof TypeError) { const x = new Error('Tidak bisa terhubung ke server. Periksa internet.'); x.net = true; throw x; }
        throw e;
      } finally { clearTimeout(timer); }
    }
  };

  function h(tag, attrs) {
    const el = document.createElement(tag);
    if (attrs) for (const k in attrs) {
      const v = attrs[k];
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (k === 'value') el.value = v;
      else if (k === 'checked' || k === 'disabled' || k === 'selected') el[k] = !!v;
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (let i = 2; i < arguments.length; i++) {
      const c = arguments[i];
      if (c == null || c === false) continue;
      if (Array.isArray(c)) c.forEach(x => x != null && el.append(x));
      else el.append(c.nodeType ? c : document.createTextNode(String(c)));
    }
    return el;
  }

  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const fmtTime = s => { s = Math.max(0, Math.floor(s)); const hh = Math.floor(s / 3600), mm = Math.floor(s % 3600 / 60), ss = s % 60; return (hh ? hh + ':' + String(mm).padStart(2, '0') : String(mm).padStart(2, '0')) + ':' + String(ss).padStart(2, '0'); };

  window.AppCommon = { API, h, $, $$, fmtTime };
})();

// Lingkungan tiruan Google Apps Script (in-memory) untuk menguji Code.gs
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const crypto = require('crypto');

class Range {
  constructor(sheet, r, c, nr, nc) { this.sh = sheet; this.r = r; this.c = c; this.nr = nr; this.nc = nc; }
  getValues() { const o = []; for (let i = 0; i < this.nr; i++) { const row = []; for (let j = 0; j < this.nc; j++) row.push(this.sh.get(this.r + i, this.c + j)); o.push(row); } return o; }
  getValue() { return this.sh.get(this.r, this.c); }
  setValues(v) { for (let i = 0; i < v.length; i++) for (let j = 0; j < v[i].length; j++) this.sh.set(this.r + i, this.c + j, v[i][j]); return this; }
  setValue(v) { this.sh.set(this.r, this.c, v); return this; }
  clearContent() { for (let i = 0; i < this.nr; i++) for (let j = 0; j < this.nc; j++) this.sh.set(this.r + i, this.c + j, ''); return this; }
}
const noop = new Proxy(function () {}, { get: () => noop, apply: () => noop });
['setNumberFormat', 'setFontWeight', 'setBackground', 'setFontColor', 'setDataValidation'].forEach(m => { Range.prototype[m] = function () { return this; }; });

class Sheet {
  constructor(name) { this.name = name; this.data = []; }
  get(r, c) { const row = this.data[r - 1]; return row && row[c - 1] !== undefined ? row[c - 1] : ''; }
  set(r, c, v) { while (this.data.length < r) this.data.push([]); const row = this.data[r - 1]; while (row.length < c) row.push(''); row[c - 1] = v; }
  getLastRow() { let l = 0; this.data.forEach((row, i) => { if (row.some(x => x !== '' && x != null)) l = i + 1; }); return l; }
  getLastColumn() { return this.data.reduce((m, r) => Math.max(m, r.length), 0); }
  getRange(r, c, nr, nc) { return new Range(this, r, c, nr || 1, nc || 1); }
  getDataRange() { return new Range(this, 1, 1, Math.max(this.getLastRow(), 1), Math.max(this.getLastColumn(), 1)); }
  appendRow(row) { const r = this.getLastRow() + 1; row.forEach((v, i) => this.set(r, i + 1, v)); }
  deleteRow(r) { this.data.splice(r - 1, 1); }
  setFrozenRows() {} setColumnWidth() {}
}

function createEnv() {
  const sheets = {};
  const ss = {
    getSheetByName: n => sheets[n] || null,
    insertSheet: n => (sheets[n] = new Sheet(n)),
    getId: () => 'SSID', getUrl: () => 'https://docs.google.com/spreadsheets/d/SSID', getName: () => 'Asesmen',
    setSpreadsheetTimeZone() {}, getSpreadsheetTimeZone: () => 'Asia/Jakarta', toast() {}
  };
  const cacheStore = {};
  const cache = {
    get: k => (cacheStore[k] && cacheStore[k].exp > Date.now() ? cacheStore[k].v : null),
    put: (k, v, s) => { cacheStore[k] = { v: String(v), exp: Date.now() + (s || 600) * 1000 }; },
    remove: k => { delete cacheStore[k]; }, removeAll: () => { Object.keys(cacheStore).forEach(k => delete cacheStore[k]); }
  };
  const props = {};
  const ctx = {
    console, Math, JSON, Date, String, Number, Object, Array, isFinite, RegExp, Error,
    Logger: { log() {} },
    SpreadsheetApp: {
      getActiveSpreadsheet: () => ss, openById: () => ss, getUi: () => noop,
      newDataValidation: () => ({ requireValueInList: () => ({ build: () => ({}) }) })
    },
    CacheService: { getScriptCache: () => cache },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => props[k] || null, setProperty: (k, v) => { props[k] = v; } }) },
    Utilities: {
      formatDate: (d) => d.toISOString().replace('T', ' ').slice(0, 19),
      getUuid: () => crypto.randomUUID(), sleep() {},
      base64Decode: s => Buffer.from(s, 'base64'), base64Encode: b => Buffer.from(b).toString('base64'),
      newBlob: (b, m, n) => ({ b, m, n })
    },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: t => ({ text: t, setMimeType() { return this; } }) },
    DriveApp: {
      createFolder: () => ({ getId: () => 'FOLDER', createFile: blob => ({ getId: () => 'FILE1', setSharing() {} }) }),
      getFolderById: () => ({ createFile: () => ({ getId: () => 'FILE1', setSharing() {} }) }),
      Access: { ANYONE_WITH_LINK: 1 }, Permission: { VIEW: 1 },
      getFileById: () => ({ getBlob: () => ({ getContentType: () => 'image/png', getBytes: () => Buffer.from('abc') }) })
    }
  };
  vm.createContext(ctx);
  const code = fs.readFileSync(path.join(__dirname, '..', 'apps-script', 'Code.gs'), 'utf8');
  vm.runInContext(code, ctx, { filename: 'Code.gs' });
  const call = (req) => JSON.parse(ctx.doPost({ postData: { contents: JSON.stringify(req) } }).text);
  return { ctx, sheets, call, ss };
}
module.exports = { createEnv };

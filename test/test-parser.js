const assert = require('assert');
const P = require('../assets/parser.js');
const { JSDOM } = require('/tmp/claude-0/-home-claude/9a805de3-cd1d-58d2-b99f-ce21476fbbd4/scratchpad/npm/node_modules/jsdom');
let n = 0; const ok = m => console.log('  ✓', m, ++n && '');

// 1. teks
let r = P.review(P.parseText(`
1. Zakat fitrah dikeluarkan pada bulan ....
A. Syaban
B. Ramadan
C. Syawal
D. Zulhijah
Kunci: B

2. Yang termasuk mustahik zakat adalah ....
A. fakir B. miskin C. orang kaya D. amil
Jawaban: A, B, D

3. Zakat fitrah hanya wajib bagi orang dewasa. (Benar/Salah)
Kunci: Salah
Bobot: 2

4. Bersuci dari hadas kecil disebut ....
Kunci: wudu | wudhu
`));
assert.equal(r.questions.length, 4);
assert.equal(r.questions[0].kunci, 'B'); assert.equal(r.questions[0].tipe, 'PG');
assert.equal(r.questions[1].tipe, 'PGK'); assert.equal(r.questions[1].kunci, 'A,B,D'); assert.equal(r.questions[1].C, 'orang kaya');
assert.equal(r.questions[2].tipe, 'BS'); assert.equal(r.questions[2].kunci, 'SALAH'); assert.equal(r.questions[2].bobot, 2);
assert.equal(r.questions[3].tipe, 'ISIAN'); assert.equal(r.questions[3].kunci, 'wudu | wudhu');
assert.equal(r.warnings.length, 0, r.warnings.join(';')); ok('parseText: PG, PGK (opsi sebaris), BS, ISIAN, bobot');

// 2. daftar kunci di akhir
r = P.review(P.parseText(`1. Rukun Islam pertama?
A. Salat
B. Syahadat
2. Rukun Islam kelima?
A. Haji
B. Puasa

KUNCI JAWABAN
1. B   2. A`));
assert.equal(r.questions[0].kunci, 'B'); assert.equal(r.questions[1].kunci, 'A'); assert.equal(r.warnings.length, 0); ok('kunci jawaban di akhir dokumen dipetakan');

// 3. gambar token
r = P.parseText('1. Perhatikan gambar! ⟦IMG:0⟧\nA. wudu\nB. salat\nKunci: A', ['data:image/png;base64,AAA']);
assert.equal(r.questions[0].gambar, 'data:image/png;base64,AAA'); assert(!/IMG/.test(r.questions[0].teks)); ok('gambar dari Word menempel ke soal');

// 4. baris tabel
r = P.fromRows([['No', 'Tipe', 'Pertanyaan', 'Opsi A', 'Opsi B', 'Opsi C', 'Opsi D', 'Opsi E', 'Kunci', 'Bobot', 'Gambar (URL)'],
  [1, 'PG', 'Soal 1', 'a', 'b', 'c', 'd', '', 'c', 1, 'https://x/y.png'], [2, '', 'Soal 2', '', '', '', '', '', 'benar', '', '']]);
assert.equal(r.questions.length, 2); assert.equal(r.questions[0].kunci, 'C'); assert.equal(r.questions[0].gambar, 'https://x/y.png'); assert.equal(r.questions[1].tipe, 'BS'); ok('fromRows (judul Indonesia)');
r = P.fromRows([['soal', 'a', 'b', 'c', 'jawaban'], ['Siapa?', 'x', 'y', 'z', 'B']]);
assert.equal(r.questions[0].B, 'y'); assert.equal(r.questions[0].kunci, 'B'); ok('fromRows (judul bebas)');

// 5. JSON
r = P.fromJSON({ soal: [{ tipe: 'pg', pertanyaan: 'Q', opsi: ['a', 'b', 'c'], kunci: 'b', gambarData: 'data:image/png;base64,Zm9v' }] });
assert.equal(r.questions[0].B, 'b'); assert(r.questions[0].gambarData); ok('fromJSON (opsi array + gambarData)');

// 6. Word HTML (daftar bernomor + gambar)
const dom = new JSDOM(`<body>
<ol><li>Gambar apa ini? <img src="data:image/png;base64,QQ=="/><ol><li>Wudu</li><li>Salat</li><li>Puasa</li></ol></li></ol>
<p>Kunci: A</p>
<ol><li>Rukun Islam ke-5?<ol><li>Haji</li><li>Zakat</li></ol></li></ol>
<p>Kunci: A</p>
<table><tr><td>3</td><td>Soal tabel<br>A. ya<br>B. tidak</td><td>B</td></tr></table></body>`);
const imgs = []; const txt = P.htmlToText(dom.window.document.body, imgs);
r = P.review(P.parseText(txt, imgs));
assert.equal(r.questions.length, 3, txt); assert.equal(r.questions[0].gambar, 'data:image/png;base64,QQ=='); assert.equal(r.questions[0].C, 'Puasa');
assert.equal(r.questions[2].kunci, 'B'); assert.equal(r.warnings.length, 0, r.warnings.join(';')); ok('Word: daftar bertingkat, gambar, dan tabel');
console.log('\nSEMUA TES PARSER LULUS (' + n + ')');

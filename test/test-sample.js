const fs=require('fs'),assert=require('assert');const P=require('../assets/parser.js');
const XLSX=require('/tmp/claude-0/-home-claude/9a805de3-cd1d-58d2-b99f-ce21476fbbd4/scratchpad/npm/node_modules/xlsx');
const wb=XLSX.readFile(__dirname+'/../contoh/contoh-soal-fikih-VI.xlsx');
const a=P.review(P.fromRows(XLSX.utils.sheet_to_json(wb.Sheets['Soal'],{header:1,raw:false,defval:''})));
const b=P.review(P.parseText(fs.readFileSync(__dirname+'/../contoh/contoh-soal-fikih-VI.txt','utf8')));
console.log('xlsx',a.questions.length,a.warnings,'| txt',b.questions.length,b.warnings);
assert.equal(a.questions.length,17);assert.equal(b.questions.length,17);assert.equal(a.warnings.length+b.warnings.length,0);
a.questions.forEach((q,i)=>{const r=b.questions[i];assert.equal(q.tipe,r.tipe,'tipe '+(i+1));assert.equal(q.kunci,r.kunci,'kunci '+(i+1));assert.equal(q.teks,r.teks)});
console.log('contoh xlsx & txt konsisten dan valid');

#!/usr/bin/env node
// Kiểm thử bộ tìm kiếm.
//   node TIM-KIEM/kiem-thu.mjs          kiểm thử với một kho mẫu nhỏ (không cần Ollama, không đụng chỉ mục thật)
//   node TIM-KIEM/kiem-thu.mjs --kho    chạy thêm bộ câu hỏi kiem-thu-kho.json trên chỉ mục thật
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, readFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OLLAMA_GOC = process.env.OLLAMA_HOST;   // kiểm thử dùng Ollama giả; trả lại địa chỉ thật khi xong
let pass = 0;
const ok = (name, fn) => { fn(); pass++; };
const okA = async (name, fn) => { try { await fn(); pass++; } catch (e) { e.message = `[${name}] ${e.message}`; throw e; } };

// ---------- 1. tham chiếu Kinh Thánh ----------
const { timThamChieu, docThamChieuTruyVan, dinhDanh } = await import('./lib/kinh-thanh.mjs');
const ref = (s) => timThamChieu(s).map((r) => dinhDanh(r) + (r.khong_chac ? '?' : ''));
ok('ref', () => {
  for (const s of ['Mt 25,1-13', 'Mt 25, 1-13', 'Mt. 25:1-13', '(Mt 25,1–13)', 'Matt 25:1-13', 'Mát-thêu 25,1-13']) assert.deepEqual(ref(s), ['Mt 25,1-13'], s);
  assert.deepEqual(ref('Lc 21, 25-28. 34-36'), ['Lc 21,25-28', 'Lc 21,34-36']);
  assert.deepEqual(ref('1 Cr 13,4-7 và Jn 3:16'), ['1Cr 13,4-7', 'Ga 3,16']);
  assert.deepEqual(ref('Ðnl 6,4-9'), ['Đnl 6,4-9']);           // Ð Latin
  assert.deepEqual(ref('Mk 1:14'), ['Mc 1,14?']);               // Mk kiểu Anh = Máccô, gắn "không chắc"
  assert.deepEqual(ref('Mk 6,8'), ['Mk 6,8?']);                 // Mk kiểu Việt = Mikha
  assert.deepEqual(ref('CN 7 Thường Niên, Is 5 hôm nay'), []);  // không nhận bừa
  assert.deepEqual(ref('Mt 5'), ['Mt 5?']);                     // chỉ có chương: không chắc
  assert.equal(docThamChieuTruyVan('Mt 25,1-13').length, 1);
  assert.equal(docThamChieuTruyVan('tỉnh thức Mt 25').length, 0);
});

// ---------- 2. chữ Việt ----------
const { boDau, coDau, nfc } = await import('./lib/tieng-viet.mjs');
ok('vn', () => {
  const s = 'Hãy TỈNH THỨC, Đức Giêsu!';
  assert.equal(boDau(s), 'hay tinh thuc, duc giesu!');
  assert.equal(boDau(s).length, s.length);                         // giữ vị trí để tô sáng
  assert.equal(nfc('tỉnh'.normalize('NFD')), 'tỉnh');
  assert.ok(coDau('tỉnh') && coDau('Đi') && !coDau('tinh thuc'));
});

// ---------- 3. chia đoạn giữ đúng số dòng ----------
const { docBai, chiaDoan } = await import('./lib/markdown.mjs');
const para = (n, w) => Array.from({ length: n }, (_, i) => `${w}${i}`).join(' ') + '.';
const mau = `---\nma_le: ["5320"]\nnam: ["A"]\nten_le: "Chúa Nhật XXXII Thường Niên"\ntin_mung: ["Mt 25, 1-13"]\ntac_gia: "Lm. A"\nchu_de: "Sự khôn ngoan đích thực"\n---\n\n# Sự khôn ngoan đích thực\n\n${para(120, 'a')}\n\n${para(150, 'b')}\n\nTiêu đề phụ\n\n${para(500, 'c')}\n\n${para(10, 'd')}\n`;
ok('chia', () => {
  const { meta, body, bodyLine } = docBai(mau);
  assert.equal(meta.chu_de, 'Sự khôn ngoan đích thực');
  assert.deepEqual(meta.tin_mung, ['Mt 25, 1-13']);
  const ds = chiaDoan(body, bodyLine);
  const lines = mau.split('\n');
  for (const d of ds) {
    assert.ok(d.so_tu <= 420, `đoạn ${d.so_tu} từ`);
    const first = d.noi_dung.split('\n')[0];
    assert.ok(lines[d.dong_dau - 1].includes(first.slice(0, 20)), 'dong_dau trỏ đúng dòng gốc');
  }
  assert.ok(!ds.some((d) => d.noi_dung.startsWith('# ')), 'không lấy dòng tiêu đề chính');
});

// ---------- 4. kho mẫu: lập chỉ mục, tìm, cập nhật, vector ----------
const tmp = mkdtempSync(join(tmpdir(), 'timkiem-'));
const kho = join(tmp, 'kho'), dbp = join(tmp, 'tk.sqlite');
const viet = (p, meta, body) => {
  mkdirSync(dirname(join(kho, p)), { recursive: true });
  const y = Object.entries(meta).map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join('\n');
  writeFileSync(join(kho, p), `---\n${y}\n---\n\n# ${meta.chu_de}\n\n${body}\n`);
};
viet('5320-A/001.md', { ma_le: ['5320'], nam: ['A'], ten_le: 'Chúa Nhật XXXII Thường Niên', tin_mung: ['Mt 25, 1-13'], tac_gia: 'Lm. Giuse Nguyễn Hữu An', chu_de: 'Sự khôn ngoan đích thực' },
  'Dụ ngôn mười trinh nữ (Mt 25,1-13) dạy ta phải tỉnh thức. Năm cô khôn ngoan mang theo dầu cho đèn.\n\nNgày Chúa đến không ai biết trước, nên phải chuẩn bị sẵn sàng.');
viet('1010-B/001.md', { ma_le: ['1010'], nam: ['B'], ten_le: 'Chúa Nhật I Mùa Vọng', tin_mung: ['Mc 13, 33-37'], tac_gia: 'Vô danh', chu_de: 'Hãy TỈNH THỨC' },
  'Các con hãy coi chừng và TỈNH THỨC, vì các con không biết khi nào thời ấy đến. Ðức Giêsu dạy như vậy.');
viet('4020-C/001.md', { ma_le: ['4020'], nam: ['C'], ten_le: 'Chúa Nhật II Phục Sinh', tin_mung: ['Ga 20, 19-31'], tac_gia: 'Lm. Phêrô B', chu_de: 'Lòng thương xót' },
  'Tình thương của Chúa thật bao la. Lòng thương xót không có giới hạn. Ta tinh tế nhận ra tình Chúa.');
const env = { ...process.env, TIM_KIEM_DB: dbp };
const lap = () => execFileSync(process.execPath, [join(HERE, 'lap-chi-muc.mjs'), '--thu-muc', kho], { env }).toString();
assert.match(lap(), /3 mới/);

process.env.TIM_KIEM_DB = dbp;
const { moCsdl } = await import('./lib/csdl.mjs');
const { timKiem } = await import('./lib/tim-kiem.mjs');
let db = moCsdl(dbp, { readOnly: true });
const paths = async (q, o = {}) => (await timKiem(db, q, { che_do: 'tu-khoa', ...o })).ket_qua.map((k) => k.bai.duong_dan).sort();

await okA('tu-khoa', async () => {
  assert.deepEqual(await paths('tỉnh thức'), ['1010-B/001.md', '5320-A/001.md']);   // không phân biệt hoa thường
  assert.deepEqual(await paths('tỉnh thức'.normalize('NFD')), ['1010-B/001.md', '5320-A/001.md']); // gõ NFD
  assert.deepEqual(await paths('tinh thuc'), ['1010-B/001.md', '5320-A/001.md']);   // không dấu
  assert.deepEqual(await paths('tình'), ['4020-C/001.md']);                         // có dấu: "tình" ≠ "tinh", "tỉnh"
  assert.deepEqual(await paths('Đức Giêsu'), ['1010-B/001.md']);                    // Ð Latin trong bài vẫn tìm được
  assert.deepEqual(await paths('mười trinh'), ['5320-A/001.md']);                    // đúng cụm
  assert.deepEqual(await paths('mười trinh nữ'), ['5320-A/001.md']);
  assert.deepEqual(await paths('"dầu" "đèn"'), ['5320-A/001.md']);
  assert.deepEqual(await paths('"thương xót" OR "dầu"'), ['4020-C/001.md', '5320-A/001.md']);
  assert.deepEqual(await paths('"tỉnh thức" -"trinh nữ"'), ['1010-B/001.md']);
  const r = await timKiem(db, 'tỉnh thức', { che_do: 'tu-khoa' });
  const d = r.ket_qua.find((k) => k.bai.duong_dan === '5320-A/001.md').doan[0];
  assert.equal(d.noi_dung.slice(...d.khop[0]), 'tỉnh thức');                       // tô sáng đúng chỗ
  const r2 = await timKiem(db, 'tinh thuc', { che_do: 'tu-khoa' });
  const d2 = r2.ket_qua.find((k) => k.bai.duong_dan === '1010-B/001.md').doan[0];
  assert.equal(d2.noi_dung.slice(...d2.khop[0]), 'TỈNH THỨC');
});
await okA('kinh-thanh', async () => {
  assert.deepEqual(await paths('Mt 25,1-13'), ['5320-A/001.md']);
  assert.deepEqual(await paths('Mt 25,5'), ['5320-A/001.md']);                     // câu nằm trong khoảng
  assert.deepEqual(await paths('Mt 25'), ['5320-A/001.md']);
  assert.deepEqual(await paths('Mt 26,1'), []);
  assert.deepEqual(await paths('Ga 20,19'), ['4020-C/001.md']);                     // chỉ có trong tin_mung (YAML)
});
await okA('loc', async () => {
  assert.deepEqual(await paths('tỉnh thức', { loc: { nam: 'B' } }), ['1010-B/001.md']);
  assert.deepEqual(await paths('tỉnh thức', { loc: { ma: '5320' } }), ['5320-A/001.md']);
  assert.deepEqual(await paths('tỉnh thức', { loc: { tac_gia: 'huu an' } }), ['5320-A/001.md']);
  assert.deepEqual(await paths('tỉnh thức', { loc: { tac_gia: 'vô danh' } }), ['1010-B/001.md']);
  assert.deepEqual(await paths('tỉnh thức', { loc: { sach: 'Mc' } }), ['1010-B/001.md']);
  assert.deepEqual(await paths('', { loc: { ma: '4020' } }), ['4020-C/001.md']);
  // tên ngày lễ gõ trong ô tìm → lọc theo mã lễ
  assert.deepEqual(await paths('CN 32 TN tỉnh thức'), ['5320-A/001.md']);
  assert.deepEqual(await paths('chủ nhật XXXII thường niên năm A'), ['5320-A/001.md']);
  assert.deepEqual(await paths('Chúa nhật 1 mùa vọng tỉnh thức'), ['1010-B/001.md']);
  assert.deepEqual(await paths('chúa nhật 2 phục sinh'), ['4020-C/001.md']);
  assert.deepEqual(await paths('chủ nhật 32 thường niên năm B'), []);
  assert.deepEqual(await paths('lễ Chúa nhật 32 thường niên'), ['5320-A/001.md']);   // tên suy từ mã, bỏ chữ "lễ" thừa
});
// bản một-file HTML: cùng các câu tìm, chạy bằng bộ máy trong trình duyệt
await okA('mot-file', async () => {
  const { taoDuLieu, gopMa } = await import('./dong-goi-html.mjs');
  const D = JSON.parse(JSON.stringify(taoDuLieu(db, kho)));
  const { taoBoMay } = new Function(gopMa() + '\nreturn BoMay;')();     // đúng đoạn mã được nhúng vào HTML
  const M = taoBoMay(D);
  const ps = (q, o = {}) => M.tim(q, o).ket_qua.map((k) => k.bai.duong_dan).sort();
  assert.deepEqual(ps('tỉnh thức'), ['1010-B/001.md', '5320-A/001.md']);
  assert.deepEqual(ps('tinh thuc'), ['1010-B/001.md', '5320-A/001.md']);
  assert.deepEqual(ps('tình'), ['4020-C/001.md']);
  assert.deepEqual(ps('Đức Giêsu'), ['1010-B/001.md']);
  assert.deepEqual(ps('mười trinh'), ['5320-A/001.md']);
  assert.deepEqual(ps('"dầu" "đèn"'), ['5320-A/001.md']);
  assert.deepEqual(ps('"thương xót" OR "dầu"'), ['4020-C/001.md', '5320-A/001.md']);
  assert.deepEqual(ps('"tỉnh thức" -"trinh nữ"'), ['1010-B/001.md']);
  assert.deepEqual(ps('Mt 25,5'), ['5320-A/001.md']);
  assert.deepEqual(ps('Mt 26,1'), []);
  assert.deepEqual(ps('Ga 20,19'), ['4020-C/001.md']);
  assert.deepEqual(ps('CN 32 TN tỉnh thức'), ['5320-A/001.md']);
  assert.deepEqual(ps('chủ nhật 32 thường niên năm B'), []);
  assert.deepEqual(ps('tỉnh thức', { loc: { tac_gia: 'huu an' } }), ['5320-A/001.md']);
  assert.deepEqual(ps('tỉnh thức', { loc: { sach: 'Mc' } }), ['1010-B/001.md']);
  const r = M.tim('tỉnh thức');
  const d = r.ket_qua.find((k) => k.bai.duong_dan === '1010-B/001.md').doan[0];
  assert.equal(d.noi_dung.slice(...d.khop[0]), 'TỈNH THỨC');
  assert.ok(M.docBai(0).doan.length >= 1);
});
db.close();

// cập nhật từng phần
await okA('cap-nhat', async () => {
  const p = join(kho, '4020-C/001.md');
  writeFileSync(p, readFileSync(p, 'utf8').replace('bao la', 'bao la như biển cả'));
  const out = lap();
  assert.match(out, /0 mới, 1 đã sửa, 2 giữ nguyên/);
  unlinkSync(join(kho, '1010-B/001.md'));
  assert.match(lap(), /1 đã xóa/);
  db = moCsdl(dbp, { readOnly: true });
  assert.deepEqual(await paths('biển cả'), ['4020-C/001.md']);
  assert.deepEqual(await paths('TỈNH THỨC'), ['5320-A/001.md']);
  db.close();
});

// vector với một Ollama giả (vector theo từ, đủ để kiểm đường đi dữ liệu, không kiểm chất lượng)
await okA('vector', async () => {
  const DIM = 64;
  const fake = createServer((req, res) => {
    let b = ''; req.on('data', (c) => (b += c)).on('end', () => {
      if (req.url === '/api/tags') return res.end(JSON.stringify({ models: [{ name: 'gia:latest' }] }));
      const { input } = JSON.parse(b);
      const embeddings = input.map((t) => { const v = Array(DIM).fill(0); for (const w of boDau(t).match(/[a-z0-9]+/g) ?? []) { let h = 0; for (const c of w) h = (h * 31 + c.charCodeAt(0)) >>> 0; v[h % DIM] += 1; } return v; });
      res.setHeader('content-type', 'application/json'); res.end(JSON.stringify({ embeddings }));
    });
  });
  await new Promise((r) => fake.listen(0, '127.0.0.1', r));
  const host = `http://127.0.0.1:${fake.address().port}`;
  const run = (args) => new Promise((resolve, reject) => {
    import('node:child_process').then(({ execFile }) => execFile(process.execPath, [join(HERE, 'tao-vector.mjs'), ...args],
      { env: { ...env, OLLAMA_HOST: host } }, (e, so, se) => (e ? reject(new Error(se || e.message)) : resolve(so))));
  });
  assert.match(await run(['--mo-hinh', 'gia']), /Xong: \d+ đoạn/);
  assert.match(await run([]), /Cần tạo 0/);                                        // chạy lại: không làm lại
  process.env.OLLAMA_HOST = host;
  const { timKiem: tk } = await import('./lib/tim-kiem.mjs?v2');
  db = moCsdl(dbp, { readOnly: true });
  const r = await tk(db, 'chuẩn bị sẵn sàng ngày Chúa đến', { che_do: 'y-nghia' });
  assert.equal(r.ket_qua[0].bai.duong_dan, '5320-A/001.md');
  assert.ok(r.ket_qua[0].doan[0].nguon.includes('y-nghia'));
  const r2 = await tk(db, 'thương xót', { che_do: 'tat-ca' });
  assert.ok(r2.ket_qua[0].doan[0].nguon.includes('tu-khoa') && r2.ket_qua[0].doan[0].nguon.includes('y-nghia'));
  db.close(); fake.close();
  if (OLLAMA_GOC === undefined) delete process.env.OLLAMA_HOST; else process.env.OLLAMA_HOST = OLLAMA_GOC;
});
rmSync(tmp, { recursive: true, force: true });
console.log(`Đạt ${pass} nhóm kiểm thử trên kho mẫu.`);

// ---------- 5. bộ câu hỏi trên kho thật ----------
if (process.argv.includes('--kho')) {
  delete process.env.TIM_KIEM_DB;
  const { DB_PATH } = await import('./lib/csdl.mjs?kho');
  const { timKiem: tk } = await import('./lib/tim-kiem.mjs?kho');
  const dbk = moCsdl(DB_PATH, { readOnly: true });
  const ds = JSON.parse(readFileSync(join(HERE, 'kiem-thu-kho.json'), 'utf8'));
  let dat = 0;
  for (const c of ds) {
    const r = await tk(dbk, c.q, { che_do: c.che_do ?? 'tat-ca', gioi_han: c.top ?? 10 });
    const texts = r.ket_qua.flatMap((k) => k.doan.map((d) => boDau(d.noi_dung)));
    const tim = c.co_mot_trong.map(boDau);
    const n = texts.filter((t) => tim.some((w) => t.includes(w))).length;
    const okc = n >= (c.it_nhat ?? 1);
    if (okc) dat++;
    console.log(`${okc ? 'ĐẠT ' : 'CHƯA'}  [${c.che_do ?? 'tat-ca'}] "${c.q}" → ${n} đoạn trong top ${c.top ?? 10} có một trong: ${c.co_mot_trong.join(', ')}${r.ghi_chu.length ? '  (' + r.ghi_chu.join(' ') + ')' : ''}`);
  }
  console.log(`Kho thật: đạt ${dat}/${ds.length}.`);
}

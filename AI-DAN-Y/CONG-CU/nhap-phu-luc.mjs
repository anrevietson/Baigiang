#!/usr/bin/env node
// Nhập TOÀN BỘ Phụ lục I Kim Chỉ Nam Giảng Lễ (bảng số GLHTCG cho Chúa nhật & lễ trọng) vào
// HUONG-DAN/kim-chi-nam-tham-chieu.json → phu_luc_1[<thư mục>]. Đọc từ NGUON/kim-chi-nam-giang-le.en.txt, chép nguyên văn.
//
//   node AI-DAN-Y/CONG-CU/nhap-phu-luc.mjs [--thu]     (--thu: chỉ in, không ghi)
//
// Ghép tiêu đề → mã thư mục theo bảng MA bên dưới (đối chiếu tên lễ trong TRA-CUU/lich-ngay.json và ten_le của bài giảng).
// Thư mục có chu kỳ (-A/-B/-C) lấy mục của đúng chu kỳ; thư mục không chu kỳ (vd Giáng Sinh) chỉ nhận khi ba chu kỳ giống hệt nhau.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { AI_DIR, LIB_ROOT, NGUON } from './chung.mjs';

const THU = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth', 'eleventh', 'twelfth', 'thirteenth',
  'fourteenth', 'fifteenth', 'sixteenth', 'seventeenth', 'eighteenth', 'nineteenth', 'twentieth'];
const soThu = (w) => {
  w = w.toLowerCase();
  if (w.startsWith('twenty-')) return 20 + soThu(w.slice(7));
  if (w.startsWith('thirty-')) return 30 + soThu(w.slice(7));
  if (w === 'thirtieth') return 30;
  const i = THU.indexOf(w); return i < 0 ? null : i + 1;
};
/** tiêu đề (đã chuẩn hóa) → danh sách mã lễ */
function maCua(t) {
  let m;
  if ((m = t.match(/^(\w+) Sunday of Advent$/))) return [`10${soThu(m[1])}0`];
  if ((m = t.match(/^(\w+) Sunday of Lent$/))) return [`30${soThu(m[1])}0`];
  if ((m = t.match(/^(\w+) Sunday of Easter\b/))) return [`40${soThu(m[1])}0`];
  if ((m = t.match(/^([\w-]+) Sunday in Ordinary Time$/))) return [`5${String(soThu(m[1])).padStart(2, '0')}0`];
  const BANG = [
    [/^The Solemnity of Christmas$/, ['92412', '92512', '22512', '02512']],   // lễ vọng, đêm, rạng đông, ban ngày
    [/^The Holy Family$/, ['2010']],
    [/Mary, the Mother of God$/, ['80101']],
    [/^Second Sunday after the Nativity$/, ['2020']],
    [/Epiphany$/, ['6000']],
    [/^Palm Sunday/, ['3060']],
    [/^Thursday of the Lord’s Supper$/, ['3064']],
    [/^Friday of the Passion of the Lord$/, ['3065']],
    [/^Easter Sunday of the Resurrection/, ['4010']],
    [/Ascension of the Lord$/, ['4077']],
    [/Solemnity of Pentecost$/, ['4080']],
    [/Most Holy Trinity$/, ['5420']],
    [/Body and Blood of Christ$/, ['5430']],
    [/Sacred Heart of Jesus$/, ['5440']],
    [/^Solemnity of Christ the King/, ['5340']],
    [/^March 19:/, ['81903']], [/^June 29:/, ['82906']], [/^August 15:/, ['81508']], [/^November 1:/, ['80111']], [/^December 8:/, ['80812']],
  ];
  for (const [re, ma] of BANG) if (re.test(t)) return ma;
  return null;
}

const L = readFileSync(join(NGUON, 'kim-chi-nam-giang-le.en.txt'), 'utf8').split(/\r?\n/);
const dau = L.findIndex((l, i) => l === 'CYCLE A' && /^First Sunday of Advent$/.test(L[i + 1] ?? ''));
const cuoi = L.indexOf('Appendix II', dau);
if (dau < 0 || cuoi < 0) throw new Error('Không tìm thấy Phụ lục I trong bản văn');
const muc = [];   // { chu_ky, tieu_de, dong:[a,b], chu_de:[{so,en}] }
let chuKy = null, cur = null;
for (let i = dau; i < cuoi; i++) {
  const l = L[i].trim(), so = i + 1;
  if (!l) continue;
  if (/^CYCLE [ABC]$/.test(l)) { chuKy = l.slice(-1); cur = null; continue; }
  if (l === 'OTHER HOLY DAYS') { chuKy = null; cur = null; continue; }
  if (l.startsWith('CCC')) {
    // vài dòng trong bản vatican.va thiếu dấu hai chấm: "CCC 1961-1964 the old Law"
    const m = l.match(/^CCC ([\d, \-–]+?)(?::\s*|\s+(?=[^\d\s,\-–]))(.+)$/);
    if (!m || !cur) throw new Error(`Dòng ${so} không đọc được: ${l}`);
    cur.chu_de.push({ so: m[1].trim(), en: m[2].trim() }); cur.dong[1] = so; continue;
  }
  const tieuDe = l.replace(/Sunday/g, ' Sunday ').replace(/in\s*Ordinary/g, ' in Ordinary ').replace(/\s+/g, ' ').trim();
  cur = { chu_ky: chuKy, tieu_de: tieuDe, dong: [so + 1, so], chu_de: [] };
  muc.push(cur);
}

const ra = {}, loi = [], khongChuKy = new Map();
for (const x of muc) {
  const ds = maCua(x.tieu_de);
  if (!ds) { loi.push(`Không ghép được tiêu đề: "${x.tieu_de}" (dòng ${x.dong[0] - 1})`); continue; }
  if (!x.chu_de.length) { loi.push(`"${x.tieu_de}" không có số GLHTCG`); continue; }
  for (const ma of ds) {
    const coChuKy = x.chu_ky && existsSync(join(LIB_ROOT, `${ma}-${x.chu_ky}`));
    const tm = coChuKy ? `${ma}-${x.chu_ky}` : ma;
    if (!existsSync(join(LIB_ROOT, tm))) { loi.push(`Không có thư mục ${tm} cho "${x.tieu_de}"`); continue; }
    const ban = { muc: `${x.chu_ky ? 'CYCLE ' + x.chu_ky : 'OTHER HOLY DAYS'} — ${x.tieu_de}`, dong_trong_ban_van: x.dong, chu_de: x.chu_de };
    if (coChuKy || !x.chu_ky) { ra[tm] = ban; continue; }
    // thư mục không chu kỳ nhưng mục nằm trong CYCLE A/B/C → chỉ nhận khi ba chu kỳ giống nhau
    if (!khongChuKy.has(tm)) khongChuKy.set(tm, []);
    khongChuKy.get(tm).push({ ...ban, chu_ky: x.chu_ky });
  }
}
for (const [tm, ds] of khongChuKy) {
  // so theo SỐ GLHTCG (bản văn có chỗ khác chữ do gõ thiếu "the", vd 80101 năm C, 3064 năm C); lấy chữ của năm A
  const soCua = (d) => JSON.stringify(d.chu_de.map((c) => c.so));
  const giong = ds.length === 3 && ds.every((d) => soCua(d) === soCua(ds[0]));
  if (!giong) { loi.push(`${tm}: các chu kỳ khác nhau (${ds.map((d) => d.chu_ky).join('/')}) — không nhận`); continue; }
  ra[tm] = { muc: `CYCLE A/B/C — ${ds[0].muc.split(' — ')[1]}`, dong_trong_ban_van: ds[0].dong_trong_ban_van, dong_cac_chu_ky: ds.map((d) => d.dong_trong_ban_van), chu_de: ds[0].chu_de };
}

const p = join(AI_DIR, 'HUONG-DAN', 'kim-chi-nam-tham-chieu.json');
const ref = JSON.parse(readFileSync(p, 'utf8'));
// các mục đã có phải trùng khớp với bản nhập mới (bảo đảm không đổi những mã đã làm)
for (const [tm, cu] of Object.entries(ref.phu_luc_1)) {
  if (!ra[tm]) loi.push(`Mục cũ ${tm} không có trong bản nhập mới`);
  else if (JSON.stringify(ra[tm].chu_de) !== JSON.stringify(cu.chu_de)) loi.push(`Mục cũ ${tm} khác bản nhập mới`);
}
console.log(`Phụ lục I: ${muc.length} tiêu đề → ${Object.keys(ra).length} thư mục.`);
for (const e of loi) console.log('  ✗ ' + e);
if (process.argv.includes('--thu')) { for (const [tm, v] of Object.entries(ra)) console.log(`  ${tm.padEnd(8)} ${v.muc} (${v.chu_de.length} nhóm)`); process.exit(loi.length ? 1 : 0); }
if (loi.length) process.exit(1);
ref.phu_luc_1 = Object.fromEntries(Object.entries(ra).sort(([a], [b]) => a.localeCompare(b)));
ref.phu_luc_1_nhap = { luc: new Date().toISOString(), cong_cu: 'CONG-CU/nhap-phu-luc.mjs', so_thu_muc: Object.keys(ra).length,
  ghi_chu: 'Toàn bộ Phụ lục I, chép nguyên văn số GLHTCG và chủ đề tiếng Anh. Giáng Sinh áp cho cả 4 thánh lễ (92412, 92512, 22512, 02512).' };
writeFileSync(p, JSON.stringify(ref, null, 2) + '\n');
console.log(`Đã ghi ${p}`);

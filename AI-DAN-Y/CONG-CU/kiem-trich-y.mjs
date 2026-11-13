#!/usr/bin/env node
// Kiểm tra LAM-VIEC/<tm>/trich-y.md có thật sự phản ánh việc ĐỌC từng bài hay không.
// Bắt các lỗi đã gặp (5330-A, 5326-I-II bản Copilot 14/11/2026):
//   - bài không có dòng trích ý;
//   - dòng trích ý không có số dòng gốc (chỉ ghi "dùng như hướng phụ", "dùng như đối chiếu");
//   - bài dài (≥ 40 dòng) chỉ ghi 1 số dòng → chưa đọc kỹ;
//   - thiếu "## Gom hướng".
//
//   node AI-DAN-Y/CONG-CU/kiem-trich-y.mjs <tm>
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { LAM_VIEC } from './chung.mjs';

const BAI_DAI = 40;   // số dòng nội dung trong gói
const LOAI_TRU = /không dùng|khong_dung|trùng|xếp nhầm|nhầm ngày|không phải bài giảng|hướng dẫn cử hành|dữ liệu cá nhân/i;

/** đọc các gói → [{ duong_dan, trung, so_dong }] */
function baiTrongGoi(tm) {
  const lv = join(LAM_VIEC, tm);
  const goi = readdirSync(lv).filter((f) => /^goi-\d+\.txt$/.test(f)).sort();
  const bai = [];
  for (const g of goi) {
    let cur = null;
    for (const dong of readFileSync(join(lv, g), 'utf8').split(/\r?\n/)) {
      const m = /^=== (\S+)/.exec(dong);
      if (m) { cur = { duong_dan: m[1], trung: false, so_dong: 0, goi: g }; bai.push(cur); continue; }
      if (!cur) continue;
      if (/^\(TRÙNG \d+%/.test(dong)) cur.trung = true;
      else if (/^L\d+\|/.test(dong)) cur.so_dong++;
    }
  }
  return bai;
}

/** → { loi: [], canh_bao: [], so_huong } ; không có trich-y.md → một lỗi */
export function kiemTrichY(tm) {
  const loi = [], canh_bao = [];
  const f = join(LAM_VIEC, tm, 'trich-y.md');
  if (!existsSync(f)) return { loi: [`chưa có ${f}`], canh_bao, so_huong: 0 };
  const txt = readFileSync(f, 'utf8');
  const dongs = txt.split(/\r?\n/).filter((d) => /^\s*[-|*]/.test(d));
  for (const b of baiTrongGoi(tm)) {
    if (b.trung) continue;                       // bản trùng: gói đã ghi, không cần dòng riêng
    const ds = dongs.filter((d) => d.includes(b.duong_dan));
    if (!ds.length) { loi.push(`${b.duong_dan} (${b.goi}): không có dòng trích ý — mỗi bài phải có một dòng "- \`${b.duong_dan}\`: …"`); continue; }
    const t = ds.join(' ');
    if (LOAI_TRU.test(t) && !/L\d+/.test(t)) continue;   // loại trừ có lý do
    const so = new Set(t.match(/L\d+/g) ?? []);
    if (!so.size) loi.push(`${b.duong_dan}: trích ý không có số dòng gốc (L…) — đọc lại bài, ghi ý cụ thể + số dòng, hoặc ghi rõ lý do không dùng`);
    else if (b.so_dong >= BAI_DAI && so.size < 2) loi.push(`${b.duong_dan}: bài ${b.so_dong} dòng mà trích ý chỉ có ${so.size} chỗ dẫn dòng — đọc hết bài, ghi các ý chính`);
  }
  const gom = /^##\s+Gom hướng\s*$([\s\S]*?)(?=^##\s|(?![\s\S]))/m.exec(txt);
  if (!gom) loi.push('thiếu mục "## Gom hướng"');
  const so_huong = gom ? (gom[1].match(/^\s*\d+\.\s/gm) ?? []).length : 0;
  if (gom && !so_huong) loi.push('"## Gom hướng" phải liệt kê các hướng dạng "1. …", "2. …"');
  return { loi, canh_bao, so_huong };
}

if (import.meta.url.endsWith(process.argv[1]?.split(/[\\/]/).pop())) {
  const tm = process.argv[2];
  if (!tm) { console.error('Cách dùng: node AI-DAN-Y/CONG-CU/kiem-trich-y.mjs <tm>'); process.exit(1); }
  const r = kiemTrichY(tm);
  for (const e of r.loi) console.log('  ✗ ' + e);
  console.log(`${tm}: trích ý — ${r.loi.length} lỗi, ${r.so_huong} hướng`);
  process.exit(r.loi.length ? 1 : 0);
}

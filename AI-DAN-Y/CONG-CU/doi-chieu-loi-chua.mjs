#!/usr/bin/env node
// Đối chiếu thư mục bài giảng ↔ bộ Lời Chúa trong catholic-cal-vn (chỉ đọc, không gọi AI).
//
//   node AI-DAN-Y/CONG-CU/doi-chieu-loi-chua.mjs                 → REPORTS/bang-doi-chieu.json (cả 593 thư mục)
//   node AI-DAN-Y/CONG-CU/doi-chieu-loi-chua.mjs 1010-A 82612    → thêm OUTPUT/<thư mục>/loi-chua.json (nguyên văn)
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  dsThuMuc, doiChieuThuMuc, layBoBaiDoc, commitLich, CAL_ROOT, OUTPUT, REPORTS, sha256, DOAN_BAI_DOC,
} from './chung.mjs';

const commit = commitLich();
const tatCa = dsThuMuc().map(doiChieuThuMuc);
const thongKe = {};
for (const r of tatCa) {
  const k = r.loi ? 'loi' : r.bo.length && r.bo.every((b) => b.co_bai_doc) ? r.cach : r.cach + (r.bo.length ? '-thieu' : '');
  thongKe[k] = (thongKe[k] ?? 0) + 1;
}
mkdirSync(REPORTS, { recursive: true });
writeFileSync(join(REPORTS, 'bang-doi-chieu.json'), JSON.stringify({
  tao_luc: new Date().toISOString(), lich: { thu_muc: CAL_ROOT, commit }, thong_ke: thongKe, thu_muc: tatCa,
}, null, 1));
console.log('Bảng đối chiếu:', thongKe);

// Bản sao mục lục rút gọn của chính chương trình lịch để kiểm chéo excerpt
const chiMuc = JSON.parse(readFileSync(join(CAL_ROOT, 'src/reading/readingIndex.generated.json'), 'utf8'));

for (const tm of process.argv.slice(2)) {
  const r = tatCa.find((x) => x.thu_muc === tm);
  if (!r) { console.error('Không có thư mục', tm); process.exitCode = 1; continue; }
  const bo = r.bo.map((b) => {
    const set = layBoBaiDoc(b.nguon, b.readingCode, b.chu_ky);
    const ci = b.nguon === 'sunday' ? chiMuc.sunday[b.readingCode]?.cycles?.[b.chu_ky] : chiMuc[b.nguon]?.[b.readingCode];
    const kiemCheo = ci ? ['firstReading', 'secondReading', 'gospel'].every((k) => (ci[k]?.excerpt ?? null) === (set?.[k]?.excerpt ?? null)) : null;
    return {
      ...b, kiem_cheo_muc_luc: kiemCheo,
      doan: set ? Object.fromEntries(Object.keys(DOAN_BAI_DOC).filter((k) => set[k]).map((k) => [k, set[k]])) : null,
    };
  });
  mkdirSync(join(OUTPUT, tm), { recursive: true });
  const out = { thu_muc: tm, celebrationCode: r.celebrationCode, chu_ky: r.chu_ky, cach: r.cach, ghi_chu: r.ghi_chu,
    lich: { thu_muc: CAL_ROOT, commit }, bo, sha256: sha256(JSON.stringify(bo.map((b) => b.doan))) };
  writeFileSync(join(OUTPUT, tm, 'loi-chua.json'), JSON.stringify(out, null, 1));
  console.log(`${tm}: ${r.cach}${r.ghi_chu ? ' — ' + r.ghi_chu : ''}`);
  for (const b of bo) console.log(`   năm ${b.chu_ky ?? '—'}: ${b.file} [${b.khoa}] kiểm chéo mục lục: ${b.kiem_cheo_muc_luc}`,
    b.doan ? Object.entries(b.doan).map(([k, v]) => `${DOAN_BAI_DOC[k]} ${v.excerpt ?? ''}`).join(' · ') : '(không có bài đọc)');
}

#!/usr/bin/env node
// Theo dõi tiến độ: mã lễ nào ĐÃ LÀM, đang làm, chưa làm — để không làm lại.
// Ghi AI-DAN-Y/DA-LAM.json (máy đọc) và AI-DAN-Y/DA-LAM.md (người đọc). Hai file này được theo dõi trong git.
//
//   node AI-DAN-Y/CONG-CU/tien-do.mjs            cập nhật và in tóm tắt
//   node AI-DAN-Y/CONG-CU/tien-do.mjs 1010-A     xem trạng thái một mã
// Trạng thái:
//   xong          có OUTPUT/<tm>/goi-y.json hợp lệ, nguồn không đổi → KHÔNG làm lại
//   can-kiem-tra  đã làm nhưng nguồn (bài giảng / Lời Chúa) đã đổi → xem lại phần bị gắn cờ
//   dang-lam      đã có gói đọc / ghi chú / bản nháp nhưng chưa ghi OUTPUT
//   chua          chưa bắt đầu
import { existsSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { AI_DIR, OUTPUT, LAM_VIEC, dsThuMuc, docJson } from './chung.mjs';
import { kiemTra, nguonDaDoi } from './kiem.mjs';

export const FILE_JSON = join(AI_DIR, 'DA-LAM.json');

/** trạng thái của một thư mục mã lễ */
export function trangThai(tm) {
  const out = join(OUTPUT, tm, 'goi-y.json');
  if (existsSync(out)) {
    const d = docJson(out);
    const loi = kiemTra(d).loi;
    const doi = nguonDaDoi(d);
    const duyet = {};
    for (const g of d.goi_y) duyet[g.duyet?.trang_thai ?? 'draft'] = (duyet[g.duyet?.trang_thai ?? 'draft'] ?? 0) + 1;
    return {
      thu_muc: tm, trang_thai: loi.length || doi.length ? 'can-kiem-tra' : 'xong',
      ten_le: d.ten_le, so_goi_y: d.goi_y.length, so_luan_diem: d.goi_y.reduce((n, g) => n + g.luan_diem.length, 0),
      so_bai_da_doc: d.nguon_bai_giang?.so_bai ?? null, ghi_luc: d.ghi_luc ?? null, van_tay_nguon: d.van_tay_nguon ?? null,
      duyet, ...(loi.length && { loi_kiem_tra: loi.slice(0, 5) }), ...(doi.length && { nguon_da_doi: doi }),
    };
  }
  const lv = join(LAM_VIEC, tm);
  if (existsSync(lv)) {
    const f = readdirSync(lv);
    return { thu_muc: tm, trang_thai: 'dang-lam', co: { goi_doc: f.filter((x) => x.startsWith('goi-')).length, trich_y: f.includes('trich-y.md'), ban_nhap: f.includes('goi-y.nhap.json') } };
  }
  return { thu_muc: tm, trang_thai: 'chua' };
}

/** quét toàn bộ, ghi DA-LAM.json + DA-LAM.md */
export function capNhatTienDo() {
  const ds = dsThuMuc().map(trangThai);
  const dem = {};
  for (const x of ds) dem[x.trang_thai] = (dem[x.trang_thai] ?? 0) + 1;
  const data = { cap_nhat: new Date().toISOString(), tong_thu_muc: ds.length, dem,
    da_lam: ds.filter((x) => x.trang_thai !== 'chua') };
  writeFileSync(FILE_JSON, JSON.stringify(data, null, 1));
  const nhan = { xong: '✅ Xong', 'can-kiem-tra': '⚠️ Cần kiểm tra', 'dang-lam': '🛠️ Đang làm' };
  const md = [
    '# Tiến độ ngân hàng gợi ý bài giảng',
    '',
    `Cập nhật: ${data.cap_nhat} — tạo tự động bởi \`node AI-DAN-Y/CONG-CU/tien-do.mjs\`, không sửa tay.`,
    '',
    `Tổng ${ds.length} thư mục mã lễ: ${Object.entries(dem).map(([k, v]) => `${nhan[k] ?? '⬜ Chưa làm'} ${v}`).join(' · ')}.`,
    '',
    'Mã đã **Xong** thì không làm lại; `chuan-bi.mjs` sẽ tự bỏ qua (thêm `--lam-lai` nếu thật sự muốn làm lại).',
    '',
    '| Mã lễ | Tên lễ | Trạng thái | Gợi ý | Luận điểm | Bài đã đọc | Duyệt | Ghi lúc |',
    '|---|---|---|---|---|---|---|---|',
    ...data.da_lam.map((x) => `| ${x.thu_muc} | ${x.ten_le ?? ''} | ${nhan[x.trang_thai]} | ${x.so_goi_y ?? ''} | ${x.so_luan_diem ?? ''} | ${x.so_bai_da_doc ?? ''} | ${x.duyet ? Object.entries(x.duyet).map(([k, v]) => `${k}: ${v}`).join(', ') : ''} | ${x.ghi_luc?.slice(0, 10) ?? ''} |`),
    '',
  ].join('\n');
  writeFileSync(join(AI_DIR, 'DA-LAM.md'), md);
  return data;
}

if (import.meta.url.endsWith(process.argv[1]?.split(/[\\/]/).pop())) {
  const tm = process.argv[2];
  if (tm) { console.log(JSON.stringify(trangThai(tm), null, 1)); process.exit(0); }
  const d = capNhatTienDo();
  console.log(`Đã cập nhật AI-DAN-Y/DA-LAM.json và DA-LAM.md — ${d.tong_thu_muc} thư mục:`, d.dem);
  for (const x of d.da_lam) console.log(`  ${x.trang_thai.padEnd(13)} ${x.thu_muc}${x.so_goi_y ? ` (${x.so_goi_y} gợi ý)` : ''}`);
}

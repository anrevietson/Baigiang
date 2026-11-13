#!/usr/bin/env node
// Kiểm tra bản nháp LAM-VIEC/<tm>/goi-y.nhap.json rồi ghi vào OUTPUT/<tm>/goi-y.json.
// - Có lỗi (trích dẫn không khớp nguyên văn, thiếu nguồn, số GLHTCG không có trong Phụ lục I…) → không ghi.
// - Gợi ý đã được người phụ trách đổi trạng thái (khác "draft") trong OUTPUT → giữ nguyên, KHÔNG ghi đè.
//
//   node AI-DAN-Y/CONG-CU/ghi-goi-y.mjs 1010-A [--thu]   (--thu: chỉ kiểm tra, không ghi)
import { writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { OUTPUT, LAM_VIEC, docJson } from './chung.mjs';
import { kiemTra, ganVanTay } from './kiem.mjs';

const tm = process.argv[2];
const chiThu = process.argv.includes('--thu');
const nhap = join(LAM_VIEC, tm ?? '', 'goi-y.nhap.json');
if (!tm || !existsSync(nhap)) { console.error(`Không có ${nhap}`); process.exit(1); }
const data = docJson(nhap);
const r = kiemTra(data);
for (const w of r.canh_bao) console.log('  ! ' + w);
for (const e of r.loi) console.log('  ✗ ' + e);
console.log(`${tm}: ${r.thong_ke?.so_goi_y} gợi ý, ${r.thong_ke?.so_luan_diem} luận điểm — ${r.loi.length} lỗi, ${r.canh_bao.length} cảnh báo`);
if (r.thong_ke?.do_giong?.length) console.log('  độ giống từ khóa giữa các gợi ý:', r.thong_ke.do_giong.map(([a, b, s]) => `${a}-${b}:${s}`).join(' '));
if (r.loi.length) process.exit(1);
if (chiThu) process.exit(0);

const out = join(OUTPUT, tm, 'goi-y.json');
if (existsSync(out)) {
  const cu = docJson(out);
  for (const g of cu.goi_y ?? []) {
    if (g.duyet?.trang_thai && g.duyet.trang_thai !== 'draft') {
      const i = data.goi_y.findIndex((x) => x.so === g.so);
      console.log(`  = giữ nguyên gợi ý ${g.so} (trạng thái "${g.duyet.trang_thai}" do người phụ trách đặt)`);
      if (i >= 0) data.goi_y[i] = g; else data.goi_y.push(g);
    }
  }
  data.goi_y.sort((a, b) => a.so - b.so);
}
ganVanTay(data);
data.ghi_luc = new Date().toISOString();
mkdirSync(join(OUTPUT, tm), { recursive: true });
writeFileSync(out, JSON.stringify(data, null, 1));
console.log(`Đã ghi ${out}`);
const { capNhatTienDo } = await import('./tien-do.mjs');
const td = capNhatTienDo();
console.log('Tiến độ (AI-DAN-Y/DA-LAM.md):', td.dem);

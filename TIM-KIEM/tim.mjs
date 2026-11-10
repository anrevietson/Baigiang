#!/usr/bin/env node
// Tìm trong kho bài giảng từ dòng lệnh.
//
//   node TIM-KIEM/tim.mjs "tỉnh thức"
//   node TIM-KIEM/tim.mjs "Con người phải chuẩn bị để gặp Chúa" --y-nghia
//   node TIM-KIEM/tim.mjs "Mt 25,1-13"
//   node TIM-KIEM/tim.mjs "lòng thương xót" --ma 4020 --nam C --tac-gia "Nguyễn Hữu An"
//   node TIM-KIEM/tim.mjs "" --ngay 2026-11-22          (bài của một ngày, theo lịch)
//   thêm --tu-khoa (chỉ từ khóa) | --y-nghia (chỉ ý nghĩa) | --so 20 | --json
import { moCsdl, DB_PATH } from './lib/csdl.mjs';
import { timKiem } from './lib/tim-kiem.mjs';
import { existsSync } from 'node:fs';

const a = process.argv.slice(2);
const opt = (k) => (a.includes(k) ? a[a.indexOf(k) + 1] : undefined);
const q = a.find((x, i) => !x.startsWith('--') && !(i && a[i - 1].startsWith('--') && !['--tu-khoa', '--y-nghia', '--json'].includes(a[i - 1])));
if (q === undefined) {
  console.error('Cách dùng: node TIM-KIEM/tim.mjs "câu tìm" [--tu-khoa|--y-nghia] [--ma 1010] [--nam A] [--ngay YYYY-MM-DD] [--tac-gia "..."] [--sach Mt] [--so 10] [--json]');
  process.exit(1);
}
if (!existsSync(DB_PATH)) { console.error('Chưa có chỉ mục. Chạy trước: node TIM-KIEM/lap-chi-muc.mjs'); process.exit(1); }
const db = moCsdl(DB_PATH, { readOnly: true });
const r = await timKiem(db, q, {
  che_do: a.includes('--tu-khoa') ? 'tu-khoa' : a.includes('--y-nghia') ? 'y-nghia' : 'tat-ca',
  loc: { ma: opt('--ma'), nam: opt('--nam'), ngay: opt('--ngay'), tac_gia: opt('--tac-gia'), sach: opt('--sach') },
  gioi_han: +(opt('--so') ?? 10),
});
if (a.includes('--json')) { console.log(JSON.stringify(r, null, 2)); process.exit(0); }
const B = (s) => `\x1b[1m${s}\x1b[0m`, H = (s) => `\x1b[33m${s}\x1b[0m`, D = (s) => `\x1b[2m${s}\x1b[0m`;
const toSang = (t, k) => { let o = '', p = 0; for (const [x, y] of k) { o += t.slice(p, x) + H(t.slice(x, y)); p = y; } return o + t.slice(p); };
for (const g of r.ghi_chu) console.log(D('• ' + g));
console.log(D(`${r.tong_bai} bài có kết quả${r.tong_bai > r.ket_qua.length ? `, hiện ${r.ket_qua.length}` : ''}.\n`));
for (const [i, k] of r.ket_qua.entries()) {
  const b = k.bai;
  console.log(`${i + 1}. ${B(b.chu_de ?? '(không chủ đề)')} — ${b.tac_gia ?? 'Vô danh'}`);
  console.log(D(`   ${b.ten_le ?? ''}${b.nam.length ? ' · năm ' + b.nam.join('/') : ''} · ${b.tin_mung.join('; ')} · ${b.duong_dan}`));
  for (const d of k.doan) {
    const t = d.noi_dung.length > 700 ? d.noi_dung.slice(0, 700) + '…' : d.noi_dung;
    console.log(D(`   ─ dòng ${d.dong_dau}–${d.dong_cuoi} [${d.nguon.join(', ') || 'đầu bài'}]`));
    console.log('   ' + toSang(t, d.khop.filter(([x]) => x < 700)).replace(/\n/g, '\n   '));
  }
  console.log();
}

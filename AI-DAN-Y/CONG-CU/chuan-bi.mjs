#!/usr/bin/env node
// Thu thập MỌI bài giảng của một thư mục mã lễ (theo bai_ma + năm trong chỉ mục SQLite, không chỉ theo tên thư mục),
// phát hiện bài trùng theo nội dung, và xuất gói đọc có số dòng gốc để người soạn đọc hết từng bài.
//
//   node AI-DAN-Y/CONG-CU/chuan-bi.mjs 1010-A [--kb 60]
//   → REPORTS/<tm>/nguon-bai-giang.json   danh sách bài, sha256, tác giả, trùng lặp
//   → LAM-VIEC/<tm>/goi-01.txt …          nội dung từng bài, mỗi dòng "L<số dòng gốc>| …"
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { moCsdl, DB_PATH } from '../../TIM-KIEM/lib/csdl.mjs';
import { docBai } from '../../TIM-KIEM/lib/markdown.mjs';
import { boDau } from '../../TIM-KIEM/lib/tieng-viet.mjs';
import { LIB_ROOT, REPORTS, LAM_VIEC, phanTichThuMuc, sha256 } from './chung.mjs';

const NGUONG_TRUNG = 0.8;        // ≥ 80% shingle của bài ngắn hơn nằm trong bài kia → coi là cùng một bài
const NGUONG_MOT_PHAN = 0.25;    // 25–80%: trùng một phần (vẫn đọc cả hai, ghi chú lại)

/** Shingle 6 từ trên bản bỏ dấu, viết thường — bền với khác biệt định dạng, dấu câu, Ð/Đ, NFC/NFD */
export function shingles(body, n = 6) {
  const w = boDau(body).toLowerCase().match(/[a-z0-9]+/g) ?? [];
  const s = new Set();
  for (let i = 0; i + n <= w.length; i++) s.add(w.slice(i, i + n).join(' '));
  return s;
}
export function chongLap(a, b) {
  if (!a.size || !b.size) return 0;
  const [nho, lon] = a.size <= b.size ? [a, b] : [b, a];
  let c = 0;
  for (const x of nho) if (lon.has(x)) c++;
  return c / nho.size;
}

/** → danh sách bài của thư mục (đã gom trùng). Dùng được từ module khác. */
export function thuThap(tm, db) {
  const p = phanTichThuMuc(tm);
  const rows = db.prepare(`SELECT DISTINCT b.id, b.duong_dan, b.sha256, b.ma_le, b.nam, b.ten_le, b.tin_mung, b.tac_gia, b.chu_de
    FROM bai_ma m JOIN bai b ON b.id=m.bai_id WHERE m.ma=? ORDER BY b.duong_dan`).all(p.ma);
  const bai = [];
  for (const r of rows) {
    const nam = JSON.parse(r.nam);
    // Chu kỳ: thư mục năm A chỉ lấy bài năm A (hoặc bài không ghi năm); thư mục I-II lấy I, II hoặc không ghi
    if (p.chuKy[0] !== null && nam.length && !nam.some((n) => p.chuKy.includes(n))) continue;
    const text = readFileSync(join(LIB_ROOT, r.duong_dan), 'utf8');
    const { meta, body, bodyLine } = docBai(text);
    const sh = shingles(body);
    bai.push({
      duong_dan: r.duong_dan, sha256: sha256(text), tac_gia: r.tac_gia ?? 'Vô danh', chu_de: r.chu_de,
      ten_le: r.ten_le, ma_le: JSON.parse(r.ma_le), nam, tin_mung: JSON.parse(r.tin_mung),
      tach: /-tach-\d+\.md$/.test(r.duong_dan), ngoai_thu_muc: !r.duong_dan.startsWith(tm + '/'),
      so_tu: (body.match(/[\p{L}\p{N}]+/gu) ?? []).length, body, bodyLine, sh,
      trung_voi: null, trung_mot_phan: [],
    });
  }
  // Gom trùng: bài dài hơn làm bản chính (giữ thứ tự đường dẫn khi bằng nhau)
  const thuTu = [...bai].sort((a, b) => b.so_tu - a.so_tu || a.duong_dan.localeCompare(b.duong_dan));
  for (let i = 0; i < thuTu.length; i++) {
    const a = thuTu[i];
    if (a.trung_voi) continue;
    for (let j = i + 1; j < thuTu.length; j++) {
      const b = thuTu[j];
      if (b.trung_voi) continue;
      const c = b.sha256 === a.sha256 ? 1 : chongLap(a.sh, b.sh);
      if (c >= NGUONG_TRUNG) b.trung_voi = { duong_dan: a.duong_dan, ty_le: +c.toFixed(2) };
      else if (c >= NGUONG_MOT_PHAN) { a.trung_mot_phan.push({ duong_dan: b.duong_dan, ty_le: +c.toFixed(2) }); b.trung_mot_phan.push({ duong_dan: a.duong_dan, ty_le: +c.toFixed(2) }); }
    }
  }
  return bai;
}

if (import.meta.url.endsWith(process.argv[1]?.split(/[\\/]/).pop())) {
  const args = process.argv.slice(2);
  const tm = args.find((a) => !a.startsWith('--'));
  const kb = args.includes('--kb') ? +args[args.indexOf('--kb') + 1] : 60;
  if (!tm || !phanTichThuMuc(tm)) { console.error('Dùng: chuan-bi.mjs <thư mục mã lễ> [--lam-lai]'); process.exit(1); }
  // Không làm lại mã đã xong (xem AI-DAN-Y/DA-LAM.md)
  const { trangThai } = await import('./tien-do.mjs');
  const tt = trangThai(tm);
  if (tt.trang_thai === 'xong' && !args.includes('--lam-lai')) {
    console.log(`${tm} đã XONG (${tt.so_goi_y} gợi ý, ghi lúc ${tt.ghi_luc}) — bỏ qua. Thêm --lam-lai nếu thật sự muốn làm lại.`);
    process.exit(0);
  }
  if (tt.trang_thai === 'can-kiem-tra') console.log(`! ${tm} đã làm nhưng nguồn đã đổi — chỉ cần xem lại phần bị gắn cờ:`, JSON.stringify(tt.nguon_da_doi ?? tt.loi_kiem_tra));
  const db = moCsdl(DB_PATH, { readOnly: true });
  const bai = thuThap(tm, db);
  mkdirSync(join(REPORTS, tm), { recursive: true });
  const lv = join(LAM_VIEC, tm);
  rmSync(lv, { recursive: true, force: true });
  mkdirSync(lv, { recursive: true });
  writeFileSync(join(REPORTS, tm, 'nguon-bai-giang.json'), JSON.stringify({
    thu_muc: tm, tao_luc: new Date().toISOString(), so_bai: bai.length,
    so_bai_doc_lap: bai.filter((b) => !b.trung_voi).length, nguong: { trung: NGUONG_TRUNG, mot_phan: NGUONG_MOT_PHAN },
    van_tay: sha256(bai.map((b) => b.duong_dan + ':' + b.sha256).join('\n')),
    bai: bai.map(({ body, bodyLine, sh, ...r }) => r),
  }, null, 1));
  // Gói đọc
  let goi = [], co = 0, so = 0;
  const xuat = () => { if (!goi.length) return; so++; writeFileSync(join(lv, `goi-${String(so).padStart(2, '0')}.txt`), goi.join('\n')); goi = []; co = 0; };
  for (const b of bai) {
    const dau = `=== ${b.duong_dan} | ${b.tac_gia} | ${b.chu_de ?? ''} | năm ${b.nam.join('/') || '—'} | ${b.tin_mung.join('; ')}${b.tach ? ' | (file tách)' : ''}`;
    if (b.trung_voi) { goi.push(dau + `\n(TRÙNG ${Math.round(b.trung_voi.ty_le * 100)}% với ${b.trung_voi.duong_dan} — không lặp lại nội dung)\n`); continue; }
    const lines = b.body.split('\n').map((l, i) => [b.bodyLine + i, l.trim()]).filter(([, l]) => l && !/^\*\*Tác giả:\*\*/.test(l));
    const txt = dau + (b.trung_mot_phan.length ? `\n(trùng một phần với ${b.trung_mot_phan.map((x) => x.duong_dan + ' ' + Math.round(x.ty_le * 100) + '%').join(', ')})` : '') +
      '\n' + lines.map(([n, l]) => `L${n}| ${l}`).join('\n') + '\n';
    if (co && co + txt.length > kb * 1000) xuat();
    goi.push(txt); co += txt.length;
  }
  xuat();
  const t = bai.filter((b) => b.trung_voi).length;
  console.log(`${tm}: ${bai.length} bài (${bai.filter((b) => b.tach).length} file tách, ${bai.filter((b) => b.ngoai_thu_muc).length} ngoài thư mục), ` +
    `${t} bài trùng, ${bai.filter((b) => !b.trung_voi && b.trung_mot_phan.length).length} bài trùng một phần → ${so} gói đọc trong ${lv}`);
  for (const b of bai.filter((x) => x.trung_voi)) console.log(`   trùng: ${b.duong_dan} ≈ ${b.trung_voi.duong_dan} (${b.trung_voi.ty_le})`);
}

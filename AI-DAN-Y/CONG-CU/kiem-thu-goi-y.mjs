#!/usr/bin/env node
// Kiểm thử ngân hàng gợi ý bài giảng (không gọi AI, không mạng, không sửa Markdown gốc).
//   node AI-DAN-Y/CONG-CU/kiem-thu-goi-y.mjs
import { readFileSync, writeFileSync, mkdtempSync, rmSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { doiChieuThuMuc, layBoBaiDoc, OUTPUT, LAM_VIEC, LIB_ROOT, CONG_CU, AI_DIR } from './chung.mjs';
import { shingles, chongLap, thuThap } from './chuan-bi.mjs';
import { kiemTra, nguonDaDoi } from './kiem.mjs';
import { napTatCa } from './nap-csdl.mjs';
import { moCsdl, DB_PATH } from '../../TIM-KIEM/lib/csdl.mjs';

let dat = 0, hong = 0;
const thu = (ten, ok, ct = '') => { ok ? dat++ : hong++; console.log(`${ok ? '✓' : '✗'} ${ten}${ct ? ' — ' + ct : ''}`); };
const doc = (p) => JSON.parse(readFileSync(p, 'utf8'));

// 1. Đối chiếu mã lễ → bộ Lời Chúa (theo quy tắc catholic-cal-vn)
const mong = {
  '1010-A': [['A', 'sunday', '1010.A', 'Mt 24, 37-44']],
  '5321-I-II': [['I', 'ordinary1', '5321', 'Lc 17, 1-6'], ['II', 'ordinary2', '5321', 'Lc 17, 1-6']],
  '82612': [[null, 'season', '22612', 'Mt 10,17-22']],
  '95001-A': [['A', 'sunday', '5010.A', 'Mt 3, 13-17']],
  '80608-A': [['A', 'sunday', '5450.A', 'Mt 17, 1-9']],
  '92412': [[null, 'saints', '82412', 'Mt 1, 1-25']],
};
for (const [tm, ds] of Object.entries(mong)) {
  const r = doiChieuThuMuc(tm);
  const ok = r.bo.length === ds.length && ds.every(([cy, ng, khoa, tm2], i) => {
    const b = r.bo[i];
    return b.chu_ky === cy && b.nguon === ng && b.khoa === khoa && layBoBaiDoc(b.nguon, b.readingCode, b.chu_ky)?.gospel?.excerpt === tm2;
  });
  thu(`Đối chiếu ${tm}`, ok, r.bo.map((b) => `${b.chu_ky ?? '—'}:${b.file}[${b.khoa}]`).join(' '));
}
const lc5321 = doc(join(OUTPUT, '5321-I-II', 'loi-chua.json'));
thu('5321: Bài đọc I năm I ≠ năm II, Tin Mừng giống nhau',
  lc5321.bo[0].doan.firstReading.excerpt === 'Kn 1, 1-7' && lc5321.bo[1].doan.firstReading.excerpt === 'Tt 1, 1-9' && lc5321.bo[0].doan.gospel.content === lc5321.bo[1].doan.gospel.content);
thu('loi-chua.json là nguyên văn JSON nguồn (không sửa)', JSON.stringify(lc5321.bo[0].doan) === JSON.stringify(Object.fromEntries(Object.entries(layBoBaiDoc('ordinary1', '5321', 'I')))));

// 2. Phát hiện bài trùng theo nội dung (không chỉ hash file)
const a = shingles('Chúa Giêsu dạy các môn đệ hãy tỉnh thức vì không biết ngày nào Chúa đến, hãy sẵn sàng luôn.');
const b = shingles('**Chúa Giêsu** dạy các môn-đệ: hãy TỈNH THỨC, vì không biết ngày nào Chúa đến… hãy sẵn sàng luôn!');
thu('Trùng nội dung dù khác định dạng/dấu câu/hoa thường', chongLap(a, b) === 1);
thu('Hai văn bản khác nhau không bị coi là trùng', chongLap(a, shingles('Thánh Stêphanô đầy ơn sủng và sức mạnh làm nhiều phép lạ cả thể trong dân chúng.')) === 0);
const db0 = moCsdl(DB_PATH, { readOnly: true });
const bai1010 = thuThap('1010-A', db0);
thu('1010-A: 110 bài, có file -tach, 14 bản trùng', bai1010.length === 110 && bai1010.filter((x) => x.tach).length === 44 && bai1010.filter((x) => x.trung_voi).length === 14);
thu('094-tach-02 được nhận là trùng 091-tach-02', bai1010.find((x) => x.duong_dan === '1010-A/094-tach-02.md')?.trung_voi?.duong_dan === '1010-A/091-tach-02.md');
thu('Thư mục năm A không lấy bài năm B/C', bai1010.every((x) => !x.nam.length || x.nam.includes('A')));

// 3. Bộ gợi ý đã ghi: hợp lệ, đủ nguồn
for (const tm of ['1010-A', '5321-I-II', '82612']) {
  const d = doc(join(OUTPUT, tm, 'goi-y.json'));
  const r = kiemTra(d);
  const moiLd = d.goi_y.every((g) => g.luan_diem.every((x) => x.nguon.length));
  thu(`${tm}: ${d.goi_y.length} gợi ý hợp lệ, mọi luận điểm có nguồn`, !r.loi.length && moiLd && d.goi_y.length >= 1 && d.goi_y.length <= 5, r.loi[0] ?? '');
  thu(`${tm}: các gợi ý khác nhau (độ giống từ khóa ≤ 0.35)`, r.thong_ke.do_giong.every(([, , s]) => s <= 0.35), 'max ' + Math.max(...r.thong_ke.do_giong.map((x) => x[2])));
  thu(`${tm}: tất cả ở trạng thái draft`, d.goi_y.every((g) => g.duyet.trang_thai === 'draft'));
}
const d1010 = doc(join(OUTPUT, '1010-A', 'goi-y.json'));
const ccc = d1010.goi_y[0].luan_diem.flatMap((x) => x.nguon).filter((s) => s.loai === 'glhtcg').map((s) => s.so);
thu('1010-A gợi ý 01: đủ 3 nhóm số GLHTCG đúng Phụ lục I', JSON.stringify(ccc) === JSON.stringify(['668-677, 769', '451, 671, 1130, 1403, 2817', '2729-2733']));
thu('5321 & 82612: không có số GLHTCG nào (không có mục Phụ lục I)', ['5321-I-II', '82612'].every((tm) => !JSON.stringify(doc(join(OUTPUT, tm, 'goi-y.json'))).includes('"glhtcg"')));

// 4. Kiểm tra bắt được trích dẫn bịa
const base = () => doc(join(LAM_VIEC, '5321-I-II', 'goi-y.nhap.json'));
const phai = (ten, f) => { const d = base(); f(d); thu(`Bắt lỗi: ${ten}`, kiemTra(d).loi.length > 0); };
phai('trích bài giảng bịa', (d) => { d.goi_y[0].luan_diem[0].nguon[0].trich = 'Chúa dạy rằng đức tin là tất cả'; });
phai('sai số dòng', (d) => { d.goi_y[0].luan_diem[0].nguon[0].dong = [30, 30]; });
phai('trích Lời Chúa bịa', (d) => { d.goi_y[1].loi_chua_nen.trich = 'Phúc cho ai không gây gương xấu'; });
phai('tham chiếu ngoài bộ bài đọc', (d) => { d.goi_y[1].loi_chua_nen.ref = 'Lc 18,2'; });
phai('dùng Bài đọc năm I cho gợi ý năm II', (d) => { d.goi_y[3].ap_dung_nam = ['II']; });
phai('số GLHTCG cho ngày không có Phụ lục I', (d) => { d.goi_y[0].luan_diem[0].nguon.push({ loai: 'glhtcg', so: '2843' }); });
phai('luận điểm không có nguồn', (d) => { d.goi_y[2].luan_diem[1].nguon = []; });
phai('trích phần đã loại (040 dòng 36-83)', (d) => { d.goi_y[2].luan_diem[1].nguon[0] = { loai: 'bai-giang', duong_dan: '5321-I-II/040.md', dong: [40, 40], trich: 'Mỗi người đón nhận Tin Mừng' }; });
phai('trích bản trùng thay vì bản chính', (d) => { d.goi_y[2].luan_diem[0].nguon[0].duong_dan = '5321-I-II/039.md'; });
phai('trích Kim Chỉ Nam bịa', (d) => { d.goi_y[0].luan_diem[3].nguon[0].trich = 'The homily must last ten minutes'; });
phai('chép nguyên văn câu Kinh Thánh ngoài bài đọc', (d) => { d.goi_y[0].luan_diem[0].kinh_thanh.push({ ref: 'Mt 18,22', qua: { duong_dan: '5321-I-II/001.md', dong: [22, 22] }, trich: 'bảy mươi lần bảy' }); });
phai('hai gợi ý trùng luận điểm', (d) => { d.goi_y[4].luan_diem[0].tieu_de = d.goi_y[0].luan_diem[0].tieu_de; });
phai('nội dung không phải tiếng Việt có dấu', (d) => { d.goi_y[1].chu_de = 'Faith opens the eyes of the heart'; });
phai('lỗi mã hoá "?" thay chữ có dấu', (d) => { d.ten_le = 'Th? Hai Tu?n XXXII'; });
phai('câu đệm thay cho giải thích', (d) => { d.goi_y[1].luan_diem[0].giai_thich = 'Grounded interpretation from the cited source lines.'; });
phai('giải thích lặp nguyên văn', (d) => { d.goi_y[1].luan_diem[1].giai_thich = d.goi_y[1].luan_diem[0].giai_thich; });
{
  const d = doc(join(LAM_VIEC, '1010-C', 'goi-y.nhap.json'));
  d.goi_y[0].loai_nguon = 'kim-chi-nam-nguyen-tac';
  thu('Bắt lỗi: có mục Phụ lục I mà gợi ý 01 ghi "nguyên tắc chung"', kiemTra(d).loi.some((m) => m.includes('Phụ lục I có mục')));
}
{
  const pl = doc(join(AI_DIR, 'HUONG-DAN', 'kim-chi-nam-tham-chieu.json')).phu_luc_1;
  thu('Phụ lục I đủ 186 thư mục (58 CN/lễ × 3 năm + 12 lễ không theo năm)', Object.keys(pl).length === 186, Object.keys(pl).length);
  thu('Phụ lục I: Chúa Kitô Vua năm B, Giáng Sinh ban đêm, Thánh Giuse có mục; Thánh Stêphanô không',
    !!pl['5340-B'] && !!pl['92512'] && !!pl['81903'] && !pl['82612'] && pl['5340-B'].muc.includes('Christ the King'));
}
for (const tm of ['1010-B', '1010-C']) {
  const ma = doc(join(OUTPUT, tm, 'goi-y.json')).goi_y[0];
  thu(`${tm} gợi ý 01 theo Phụ lục I`, ma.loai_nguon === 'kim-chi-nam-phu-luc');
}

// 5. Phát hiện nguồn thay đổi (giả lập bằng dữ liệu, KHÔNG sửa file Markdown)
const dDoi = doc(join(OUTPUT, '82612', 'goi-y.json'));
thu('Nguồn hiện tại khớp hash đã lưu', nguonDaDoi(structuredClone(dDoi)).length === 0);
const dGia = structuredClone(dDoi);
dGia.goi_y[1].luan_diem[0].nguon[0].sha256 = 'x'; dGia.goi_y[1].luan_diem[0].nguon[0].bam_dong = 'y';
const doi = nguonDaDoi(dGia);
thu('Dòng trích thay đổi → gắn cờ đúng luận điểm', doi.length === 1 && doi[0].goi_y === 2 && doi[0].luan_diem === 1, JSON.stringify(doi[0]));
const dGia2 = structuredClone(dDoi); dGia2.loi_chua.sha256 = 'z';
thu('Bộ Lời Chúa thay đổi → gắn cờ', nguonDaDoi(dGia2).some((x) => /Lời Chúa/.test(x.ly_do)));

// 6. Không ghi đè gợi ý đã duyệt
const outP = join(OUTPUT, '5321-I-II', 'goi-y.json');
const goc = readFileSync(outP, 'utf8');
try {
  const d = JSON.parse(goc);
  d.goi_y[1].duyet = { trang_thai: 'da-duyet', nguoi: 'Kiểm thử', luc: '2026-11-13', ghi_chu: null };
  d.goi_y[1].tieu_de = 'TIÊU ĐỀ ĐÃ DUYỆT (kiểm thử)';
  writeFileSync(outP, JSON.stringify(d));
  execFileSync(process.execPath, [join(CONG_CU, 'ghi-goi-y.mjs'), '5321-I-II', '--khong-kiem-trich-y'], { stdio: 'pipe' });
  const sau = doc(outP);
  thu('Ghi lại bản nháp không ghi đè gợi ý đã duyệt', sau.goi_y[1].tieu_de === 'TIÊU ĐỀ ĐÃ DUYỆT (kiểm thử)' && sau.goi_y[1].duyet.trang_thai === 'da-duyet' && sau.goi_y[0].duyet.trang_thai === 'draft');
} finally { writeFileSync(outP, goc); }

// 7. SQLite trên một CSDL tạm (không đụng chỉ mục thật)
const tmp = mkdtempSync(join(tmpdir(), 'goi-y-db-'));
try {
  const db = moCsdl(join(tmp, 't.sqlite'));
  const st1 = napTatCa(db, { log: () => {} });
  const st2 = napTatCa(db, { log: () => {} });
  const soBo = readdirSync(OUTPUT).filter((tm) => existsSync(join(OUTPUT, tm, 'goi-y.json'))).length;
  thu(`Nạp SQLite: lần 1 nạp ${soBo}, lần 2 giữ nguyên ${soBo} (gia tăng)`, st1.nap === soBo && st2.giu === soBo && st2.nap === 0);
  const q = (s, ...p) => db.prepare(s).all(...p);
  thu('Tra theo mã + năm (5321, II) → 01,02,03,05', q(`SELECT g.so FROM goi_y_ma m JOIN goi_y g ON g.id=m.goi_y_id WHERE m.ma=? AND (m.nam IS NULL OR m.nam=?) ORDER BY g.so`, '5321', 'II').map((r) => r.so).join(',') === '1,2,3,5');
  thu('FTS5 có dấu "hạt cải"', q(`SELECT rowid FROM luan_diem_fts WHERE luan_diem_fts MATCH ?`, '"hạt cải"').length >= 1);
  thu('FTS5 không dấu "sinh vao nuoc troi"', q(`SELECT g.ma FROM goi_y_fts f JOIN goi_y g ON g.id=f.rowid WHERE goi_y_fts MATCH ?`, 'khong_dau:"sinh vao nuoc troi"').map((r) => r.ma).includes('82612/05'));
  thu('Nguồn lưu đường dẫn + dòng + hash', q(`SELECT count(*) n FROM nguon_goi_y WHERE loai='bai-giang' AND (duong_dan IS NULL OR dong_dau IS NULL OR sha256 IS NULL OR bam_dong IS NULL)`)[0].n === 0);
  // bản server (TIM-KIEM/lib/goi-y.mjs): theo ngày, cùng quy tắc với baigiang.html
  const { goiYTheoMa, goiYTheoNgay } = await import('../../TIM-KIEM/lib/goi-y.mjs');
  const tom = (r) => r.bo.map((b) => b.tm + ':' + b.goi_y.map((g) => g.so).join(',')).join(' | ');
  thu('Server: ngày 28/11/2027 → 1010-C (4 gợi ý)', tom(goiYTheoNgay(db, '2027-11-28')) === '1010-C:1,2,3,4');
  thu('Server: ngày 08/11/2027 (năm I) → 5321 gợi ý 01-04', tom(goiYTheoNgay(db, '2027-11-08')) === '5321-I-II:1,2,3,4');
  thu('Server: ngày 05/12/2025 → 1015', tom(goiYTheoNgay(db, '2025-12-05')) === '1015:1,2,3');
  thu('Server: mã 1010 năm B → chỉ 1010-B', tom(goiYTheoMa(db, '1010', 'B')) === '1010-B:1,2,3');
  thu('Trạng thái nguồn tách khỏi trạng thái duyệt', q(`SELECT DISTINCT trang_thai_nguon t FROM goi_y_bo`).map((r) => r.t).join() === 'khop' && q(`SELECT DISTINCT trang_thai_duyet t FROM goi_y`).map((r) => r.t).join() === 'draft');
  db.close();
} finally { rmSync(tmp, { recursive: true, force: true }); }

// 8. Không đụng Markdown gốc
const gitSt = execFileSync('git', ['-C', LIB_ROOT, 'status', '--porcelain', '--', ':(glob)[0-9]*/**'], { encoding: 'utf8' }).trim();
thu('Không file Markdown bài giảng nào bị sửa', gitSt === '', gitSt.split('\n')[0]);

console.log(`\n${dat}/${dat + hong} đạt.`);
process.exit(hong ? 1 : 0);

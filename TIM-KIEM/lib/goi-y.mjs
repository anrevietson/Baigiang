// Đọc ngân hàng gợi ý bài giảng (bảng goi_y* do AI-DAN-Y/CONG-CU/nap-csdl.mjs nạp) cho bản chạy server.
// Cùng quy tắc chọn như baigiang.html (giao-dien/mot-file.html → boGoiY): theo mã lễ + năm, hoặc theo ngày.
import { maTheoNgay } from './tim-kiem.mjs';

const MA_TUONG_DUONG = { '95002': '5340' };   // Chúa Kitô Vua: lịch phát 95002, thư mục là 5340

/**
 * Gợi ý của một mã lễ. ngay (tùy chọn): ngày thường Mùa Thường niên mà lịch không ghi I/II → theo năm dương lịch.
 * → { bo: [{ tm, ma, ten, loai, chu_ky, nam, goi_y: [...] }] }
 */
export function goiYTheoMa(db, ma, nam, ngay) {
  if (!ma) return { bo: [] };
  ma = MA_TUONG_DUONG[ma] ?? ma;
  if (!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='goi_y_bo'").get()) return { bo: [] };
  const bo = db.prepare(`SELECT thu_muc tm, celebration_code ma, ten_le ten, loai_ngay loai, chu_ky
    FROM goi_y_bo WHERE celebration_code=? ORDER BY thu_muc`).all(ma);
  const dsGoiY = db.prepare(`SELECT id, ma, so, loai_nguon loai, ap_dung_nam nam, tieu_de, chu_de, luan_de,
    loi_chua_nen nen, lien_he_bai_doc lien_he, su_diep, ap_dung, duyet
    FROM goi_y WHERE thu_muc=? ORDER BY so`);
  const dsLuanDiem = db.prepare(`SELECT id, so, tieu_de, giai_thich, kinh_thanh
    FROM luan_diem WHERE goi_y_id=? ORDER BY so`);
  const dsNguon = db.prepare(`SELECT loai, duong_dan dd, dong_dau, dong_cuoi, so, trich, ghi_chu theo
    FROM nguon_goi_y WHERE luan_diem_id=? ORDER BY id`);
  const out = [];
  for (const b of bo) {
    const chuKy = JSON.parse(b.chu_ky);
    let n = nam ?? null;
    if (ngay && chuKy.includes('I') && !['I', 'II'].includes(n)) n = +ngay.slice(0, 4) % 2 ? 'I' : 'II';
    if (n && chuKy[0] !== null && !chuKy.includes(n)) continue;   // vd chỉ có 1010-A mà đang xem năm B
    const goiY = dsGoiY.all(b.tm)
      .map((g) => ({ ...g, nam: JSON.parse(g.nam), nen: JSON.parse(g.nen ?? 'null'),
        ap_dung: JSON.parse(g.ap_dung ?? '[]'), duyet: JSON.parse(g.duyet ?? '{}'),
        ld: dsLuanDiem.all(g.id).map((d) => ({ ...d, kinh_thanh: JSON.parse(d.kinh_thanh ?? '[]'), ng: dsNguon.all(d.id) })) }))
      .filter((g) => !n || g.nam.includes(n) || g.nam.includes(null));
    if (goiY.length) out.push({ ...b, chu_ky: chuKy, nam: n, goi_y: goiY });
  }
  return { bo: out };
}

/** ngày YYYY-MM-DD → gợi ý của mọi lễ trong ngày (lễ chính trước) */
export function goiYTheoNgay(db, ngay) {
  const bo = [], da = new Set();
  for (const { ma, nam } of maTheoNgay(ngay))
    for (const b of goiYTheoMa(db, ma, nam, ngay).bo) if (!da.has(b.tm)) { da.add(b.tm); bo.push(b); }
  return { bo };
}

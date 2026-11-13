#!/usr/bin/env node
// Nạp AI-DAN-Y/OUTPUT/*/goi-y.json vào SQLite của TIM-KIEM (bảng goi_y*, luan_diem*, nguon_goi_y, FTS5).
// Cập nhật gia tăng: file không đổi (sha256) thì bỏ qua; nhưng luôn kiểm lại nguồn để gắn cờ "nguon-da-doi".
// Không sửa goi-y.json, không đổi trạng thái duyệt.
//
//   node AI-DAN-Y/CONG-CU/nap-csdl.mjs [--lam-lai]
import { readdirSync, existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { moCsdl, DB_PATH } from '../../TIM-KIEM/lib/csdl.mjs';
import { boDau } from '../../TIM-KIEM/lib/tieng-viet.mjs';
import { OUTPUT, REPORTS, sha256 } from './chung.mjs';
import { kiemTra, nguonDaDoi } from './kiem.mjs';

export function napTatCa(db, { lamLai = false, log = console.log } = {}) {
  const q = {
    bo: db.prepare('SELECT sha256_file FROM goi_y_bo WHERE thu_muc=?'),
    idsGoiY: db.prepare('SELECT id FROM goi_y WHERE thu_muc=?'),
    idsLd: db.prepare('SELECT l.id FROM luan_diem l JOIN goi_y g ON g.id=l.goi_y_id WHERE g.thu_muc=?'),
    xoaFtsG: db.prepare('DELETE FROM goi_y_fts WHERE rowid=?'),
    xoaFtsL: db.prepare('DELETE FROM luan_diem_fts WHERE rowid=?'),
    xoaBo: db.prepare('DELETE FROM goi_y_bo WHERE thu_muc=?'),
    insBo: db.prepare(`INSERT INTO goi_y_bo(thu_muc, celebration_code, ten_le, loai_ngay, chu_ky, sha256_file, van_tay_nguon, trang_thai_nguon, chi_tiet_nguon, nap_luc)
      VALUES (?,?,?,?,?,?,?,?,?,?)`),
    updNguon: db.prepare('UPDATE goi_y_bo SET trang_thai_nguon=?, chi_tiet_nguon=? WHERE thu_muc=?'),
    insG: db.prepare(`INSERT INTO goi_y(ma, thu_muc, so, loai_nguon, ap_dung_nam, tieu_de, chu_de, luan_de, loi_chua_nen, lien_he_bai_doc, su_diep, ap_dung, trang_thai_duyet, duyet)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?) RETURNING id`),
    insMa: db.prepare('INSERT INTO goi_y_ma(goi_y_id, ma, nam) VALUES (?,?,?)'),
    insL: db.prepare('INSERT INTO luan_diem(goi_y_id, so, tieu_de, giai_thich, kinh_thanh) VALUES (?,?,?,?,?) RETURNING id'),
    insN: db.prepare(`INSERT INTO nguon_goi_y(luan_diem_id, loai, duong_dan, dong_dau, dong_cuoi, so, trich, ghi_chu, sha256, bam_dong) VALUES (?,?,?,?,?,?,?,?,?,?)`),
    insFtsG: db.prepare('INSERT INTO goi_y_fts(rowid, tieu_de, chu_de, noi_dung, khong_dau) VALUES (?,?,?,?,?)'),
    insFtsL: db.prepare('INSERT INTO luan_diem_fts(rowid, tieu_de, giai_thich, khong_dau) VALUES (?,?,?,?)'),
  };
  const st = { nap: 0, giu: 0, loi: 0, nguon_doi: 0 };
  const dsTm = existsSync(OUTPUT) ? readdirSync(OUTPUT).filter((d) => existsSync(join(OUTPUT, d, 'goi-y.json'))).sort() : [];
  const bao = [];
  for (const tm of dsTm) {
    const raw = readFileSync(join(OUTPUT, tm, 'goi-y.json'), 'utf8');
    const h = sha256(raw);
    const data = JSON.parse(raw);
    const doi = nguonDaDoi(data);
    const ttNguon = doi.length ? 'nguon-da-doi' : 'khop';
    if (doi.length) st.nguon_doi++;
    bao.push({ thu_muc: tm, trang_thai_nguon: ttNguon, nguon_da_doi: doi });
    if (!lamLai && q.bo.get(tm)?.sha256_file === h) { q.updNguon.run(ttNguon, JSON.stringify(doi), tm); st.giu++; continue; }
    const r = kiemTra(data);
    if (r.loi.length) { log(`  ✗ ${tm}: ${r.loi.length} lỗi kiểm tra — không nạp (${r.loi[0]})`); st.loi++; continue; }
    db.exec('BEGIN');
    try {
      for (const { id } of q.idsLd.all(tm)) q.xoaFtsL.run(id);
      for (const { id } of q.idsGoiY.all(tm)) q.xoaFtsG.run(id);
      q.xoaBo.run(tm);   // ON DELETE CASCADE xóa goi_y, goi_y_ma, luan_diem, nguon_goi_y
      q.insBo.run(tm, data.celebrationCode, data.ten_le, data.loai_ngay, JSON.stringify(data.chu_ky), h, data.van_tay_nguon ?? null, ttNguon, JSON.stringify(doi), new Date().toISOString());
      for (const g of data.goi_y) {
        const { id } = q.insG.get(`${tm}/${String(g.so).padStart(2, '0')}`, tm, g.so, g.loai_nguon, JSON.stringify(g.ap_dung_nam),
          g.tieu_de, g.chu_de, g.luan_de, JSON.stringify(g.loi_chua_nen), g.lien_he_bai_doc, g.su_diep, JSON.stringify(g.ap_dung),
          g.duyet?.trang_thai ?? 'draft', JSON.stringify(g.duyet ?? {}));
        for (const nam of g.ap_dung_nam) q.insMa.run(id, data.celebrationCode, nam);
        const noiDung = [g.luan_de, g.lien_he_bai_doc, g.su_diep, ...(g.ap_dung ?? []), ...g.luan_diem.map((d) => d.tieu_de + ' ' + d.giai_thich)].join('\n');
        q.insFtsG.run(id, g.tieu_de, g.chu_de, noiDung, boDau([g.tieu_de, g.chu_de, noiDung].join('\n')));
        for (const d of g.luan_diem) {
          const { id: lid } = q.insL.get(id, d.so, d.tieu_de, d.giai_thich, JSON.stringify(d.kinh_thanh ?? []));
          q.insFtsL.run(lid, d.tieu_de, d.giai_thich, boDau(d.tieu_de + '\n' + d.giai_thich));
          for (const s of d.nguon) q.insN.run(lid, s.loai, s.duong_dan ?? null, s.dong?.[0] ?? null, s.dong?.[1] ?? null, s.so ?? null,
            s.trich ?? null, s.theo ?? null, s.sha256 ?? null, s.bam_dong ?? null);
        }
      }
      db.exec('COMMIT');
      st.nap++;
    } catch (e) { db.exec('ROLLBACK'); throw e; }
  }
  // thư mục đã bị xóa khỏi OUTPUT → gỡ khỏi chỉ mục
  for (const { thu_muc } of db.prepare('SELECT thu_muc FROM goi_y_bo').all()) if (!dsTm.includes(thu_muc)) {
    for (const { id } of q.idsLd.all(thu_muc)) q.xoaFtsL.run(id);
    for (const { id } of q.idsGoiY.all(thu_muc)) q.xoaFtsG.run(id);
    q.xoaBo.run(thu_muc);
  }
  mkdirSync(REPORTS, { recursive: true });
  writeFileSync(join(REPORTS, 'trang-thai-nguon.json'), JSON.stringify({ luc: new Date().toISOString(), thu_muc: bao }, null, 1));
  return st;
}

if (import.meta.url.endsWith(process.argv[1]?.split(/[\\/]/).pop())) {
  const db = moCsdl(DB_PATH);
  const st = napTatCa(db, { lamLai: process.argv.includes('--lam-lai') });
  const n = db.prepare('SELECT (SELECT count(*) FROM goi_y_bo) bo, (SELECT count(*) FROM goi_y) g, (SELECT count(*) FROM luan_diem) l, (SELECT count(*) FROM nguon_goi_y) n').get();
  console.log(`Nạp ${st.nap}, giữ ${st.giu}, lỗi ${st.loi}, có nguồn đã đổi ${st.nguon_doi}. Trong CSDL: ${n.bo} mã lễ, ${n.g} gợi ý, ${n.l} luận điểm, ${n.n} nguồn.`);
  const { capNhatTienDo } = await import('./tien-do.mjs');
  capNhatTienDo();
}

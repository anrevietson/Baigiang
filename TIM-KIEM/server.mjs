#!/usr/bin/env node
// Giao diện tìm kiếm chạy trên máy: node TIM-KIEM/server.mjs  → mở http://localhost:8686
// Chỉ nghe trên 127.0.0.1 (không mở ra mạng). Đổi cổng: PORT=9000 node TIM-KIEM/server.mjs
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { moCsdl, DB_PATH, TOOL_DIR, thongTin } from './lib/csdl.mjs';
import { timKiem, docCaBai, napVector } from './lib/tim-kiem.mjs';
import { ollamaSanSang } from './lib/ollama.mjs';
import { SACH } from './lib/kinh-thanh.mjs';
import { nfc, boDau } from './lib/tieng-viet.mjs';

if (!existsSync(DB_PATH)) { console.error('Chưa có chỉ mục. Chạy trước: node TIM-KIEM/lap-chi-muc.mjs'); process.exit(1); }
const db = moCsdl(DB_PATH, { readOnly: true });
const PORT = +(process.env.PORT ?? 8686);
const HOST = process.env.HOST ?? '127.0.0.1';
const html = () => readFileSync(join(TOOL_DIR, 'giao-dien', 'index.html'));

let BO_LOC = null;
function boLoc() {
  if (BO_LOC) return BO_LOC;
  const le = db.prepare(`SELECT m.ma, min(b.ten_le) ten, count(*) n FROM bai_ma m JOIN bai b ON b.id=m.bai_id
                         GROUP BY m.ma ORDER BY m.ma`).all();
  const tacGia = db.prepare(`SELECT tac_gia, count(*) n FROM bai WHERE tac_gia IS NOT NULL GROUP BY tac_gia HAVING n>=3 ORDER BY n DESC LIMIT 400`).all();
  const sach = db.prepare(`SELECT sach, count(DISTINCT bai_id) n FROM tham_chieu GROUP BY sach ORDER BY n DESC`).all().map((r) => ({ ...r, ten: SACH[r.sach] }));
  return (BO_LOC = { le, tac_gia: tacGia, sach });
}

function goiY(q) {
  q = nfc(q).trim();
  if (q.length < 2) return [];
  const toks = (q.match(/[\p{L}\p{N}]+/gu) ?? []);
  if (!toks.length) return [];
  const khongDau = boDau(q) === q.toLowerCase();
  const expr = khongDau
    ? `khong_dau:${toks.map((t, i) => `"${boDau(t)}"${i === toks.length - 1 ? '*' : ''}`).join(' ')}`
    : `chu_de:${toks.map((t, i) => `"${t}"${i === toks.length - 1 ? '*' : ''}`).join(' ')}`;
  try {
    const rows = db.prepare(`SELECT b.chu_de FROM bai_fts f JOIN bai b ON b.id=f.rowid WHERE bai_fts MATCH ? ORDER BY bm25(bai_fts) LIMIT 40`).all(expr);
    return [...new Set(rows.map((r) => r.chu_de).filter(Boolean))].slice(0, 8);
  } catch { return []; }
}

function goiYBai(ma, nam) {
  if (!ma) return { bo: [] };
  const bo = db.prepare(`SELECT thu_muc tm, celebration_code ma, ten_le ten, loai_ngay loai, chu_ky
    FROM goi_y_bo WHERE celebration_code=? ORDER BY thu_muc`).all(ma);
  const dsGoiY = db.prepare(`SELECT id, ma, so, loai_nguon loai, ap_dung_nam nam, tieu_de, chu_de, luan_de,
    loi_chua_nen nen, lien_he_bai_doc lien_he, su_diep, ap_dung, duyet
    FROM goi_y WHERE thu_muc=? ORDER BY so`);
  const dsLuanDiem = db.prepare(`SELECT id, so, tieu_de, giai_thich, kinh_thanh
    FROM luan_diem WHERE goi_y_id=? ORDER BY so`);
  const dsNguon = db.prepare(`SELECT loai, duong_dan dd, dong_dau, dong_cuoi, so, trich, ghi_chu theo
    FROM nguon_goi_y WHERE luan_diem_id=? ORDER BY id`);
  return {
    bo: bo.map((b) => {
      const chuKy = JSON.parse(b.chu_ky);
      const goiY = dsGoiY.all(b.tm)
        .map((g) => ({ ...g, nam: JSON.parse(g.nam), nen: JSON.parse(g.nen ?? 'null'),
          ap_dung: JSON.parse(g.ap_dung ?? '[]'), duyet: JSON.parse(g.duyet ?? '{}'),
          ld: dsLuanDiem.all(g.id).map((d) => ({ ...d, kinh_thanh: JSON.parse(d.kinh_thanh ?? '[]'), ng: dsNguon.all(d.id) })) }))
        .filter((g) => !nam || g.nam.includes(nam) || g.nam.includes(null));
      return { ...b, chu_ky: chuKy, goi_y: goiY };
    }).filter((b) => b.goi_y.length),
  };
}

const send = (res, code, body, type = 'application/json; charset=utf-8') => {
  res.writeHead(code, { 'content-type': type, 'cache-control': 'no-store' });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
};

createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x');
  const p = (k) => u.searchParams.get(k) || undefined;
  try {
    if (u.pathname === '/') return send(res, 200, html(), 'text/html; charset=utf-8');
    if (u.pathname === '/api/tim') {
      const trang = Math.max(0, +(p('trang') ?? 0));
      const r = await timKiem(db, p('q') ?? '', {
        che_do: p('che_do') ?? 'tat-ca', gioi_han: 20, bo_qua: trang * 20,
        loc: { ma: p('ma'), nam: p('nam'), ngay: p('ngay'), tac_gia: p('tac_gia'), sach: p('sach') },
      });
      return send(res, 200, r);
    }
    if (u.pathname === '/api/bai') { const r = docCaBai(db, p('duong_dan') ?? ''); return r ? send(res, 200, r) : send(res, 404, { loi: 'Không có bài này' }); }
    if (u.pathname === '/api/goi-y') return send(res, 200, goiY(p('q') ?? ''));
    if (u.pathname === '/api/goi-y-bai') return send(res, 200, goiYBai(p('ma'), p('nam')));
    if (u.pathname === '/api/bo-loc') return send(res, 200, boLoc());
    if (u.pathname === '/api/trang-thai') {
      const c = db.prepare('SELECT (SELECT count(*) FROM bai) bai, (SELECT count(*) FROM doan) doan, (SELECT count(*) FROM vector) vector').get();
      const model = thongTin(db, 'embed_model');
      return send(res, 200, { ...c, mo_hinh: model, cap_nhat: thongTin(db, 'cap_nhat'), ollama: model ? await ollamaSanSang(model) : { ok: false, ly_do: 'Chưa tạo vector' } });
    }
    send(res, 404, { loi: 'Không có' });
  } catch (e) { send(res, 500, { loi: e.message }); }
}).listen(PORT, HOST, () => {
  const M = napVector(db);
  console.log(`Tìm kiếm bài giảng: http://localhost:${PORT}  (${M ? M.n + ' vector đã nạp' : 'chưa có vector — chỉ tìm từ khóa và Kinh Thánh'})`);
});

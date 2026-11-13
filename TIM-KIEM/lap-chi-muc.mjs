#!/usr/bin/env node
// Lập (hoặc cập nhật) chỉ mục tìm kiếm từ các file bài giảng Markdown.
//
//   node TIM-KIEM/lap-chi-muc.mjs            cập nhật: chỉ làm lại file mới/đã sửa, xóa file đã mất
//   node TIM-KIEM/lap-chi-muc.mjs --lam-lai  xóa chỉ mục cũ, lập lại từ đầu
//   node TIM-KIEM/lap-chi-muc.mjs --tham-chieu  chỉ tính lại bảng tham chiếu Kinh Thánh (sau khi sửa lib/kinh-thanh.mjs)
//   node TIM-KIEM/lap-chi-muc.mjs --thu-muc /duong/dan/PhungVu-MD
//
// Không sửa file Markdown nào. Chỉ ghi vào TIM-KIEM/du-lieu/tim-kiem.sqlite.
import {
  readFileSync,
  readdirSync,
  statSync,
  rmSync,
  existsSync,
} from "node:fs";
import { join, relative, sep } from "node:path";
import { createHash } from "node:crypto";
import { moCsdl, DB_PATH, LIB_ROOT, ghiThongTin } from "./lib/csdl.mjs";
import { docBai, chiaDoan } from "./lib/markdown.mjs";
import { boDau } from "./lib/tieng-viet.mjs";
import { timThamChieu } from "./lib/kinh-thanh.mjs";

const args = process.argv.slice(2);
const root = args.includes("--thu-muc")
  ? args[args.indexOf("--thu-muc") + 1]
  : LIB_ROOT;
if (args.includes("--lam-lai"))
  for (const s of ["", "-wal", "-shm"]) rmSync(DB_PATH + s, { force: true });

// Thư mục bài giảng: tên bắt đầu bằng chữ số (mã lễ), vd "1010-A", "80111", "5011-I-II"
const files = [];
for (const d of readdirSync(root).sort()) {
  if (!/^\d/.test(d) || !statSync(join(root, d)).isDirectory()) continue;
  for (const f of readdirSync(join(root, d)).sort())
    if (f.endsWith(".md")) files.push(join(d, f).split(sep).join("/"));
}
if (!files.length) {
  console.error(`Không thấy thư mục bài giảng nào trong ${root}`);
  process.exit(1);
}

const db = moCsdl();
const q = {
  getBai: db.prepare("SELECT id, sha256 FROM bai WHERE duong_dan=?"),
  allBai: db.prepare("SELECT id, duong_dan FROM bai"),
  insBai:
    db.prepare(`INSERT INTO bai(duong_dan, sha256, ma_le, nam, ten_le, tin_mung, tac_gia, chu_de, so_doan)
                      VALUES (?,?,?,?,?,?,?,?,?) RETURNING id`),
  updBai: db.prepare(
    `UPDATE bai SET sha256=?, ma_le=?, nam=?, ten_le=?, tin_mung=?, tac_gia=?, chu_de=?, so_doan=? WHERE id=?`,
  ),
  delBai: db.prepare("DELETE FROM bai WHERE id=?"),
  oldDoan: db.prepare(
    "SELECT d.id, d.bam, v.vec FROM doan d LEFT JOIN vector v ON v.doan_id=d.id WHERE d.bai_id=?",
  ),
  delDoanFts: db.prepare("DELETE FROM doan_fts WHERE rowid=?"),
  delDoan: db.prepare("DELETE FROM doan WHERE bai_id=?"),
  delBaiFts: db.prepare("DELETE FROM bai_fts WHERE rowid=?"),
  delMa: db.prepare("DELETE FROM bai_ma WHERE bai_id=?"),
  delTc: db.prepare("DELETE FROM tham_chieu WHERE bai_id=?"),
  insDoan: db.prepare(
    "INSERT INTO doan(bai_id, thu_tu, dong_dau, dong_cuoi, so_tu, bam, noi_dung) VALUES (?,?,?,?,?,?,?) RETURNING id",
  ),
  insDoanFts: db.prepare(
    "INSERT INTO doan_fts(rowid, noi_dung, khong_dau) VALUES (?,?,?)",
  ),
  insBaiFts: db.prepare(
    "INSERT INTO bai_fts(rowid, chu_de, tac_gia, ten_le, khong_dau) VALUES (?,?,?,?,?)",
  ),
  insMa: db.prepare("INSERT INTO bai_ma(bai_id, ma) VALUES (?,?)"),
  insTc: db.prepare(
    "INSERT INTO tham_chieu(bai_id, doan_id, sach, chuong, tu, den, raw, khong_chac, nguon) VALUES (?,?,?,?,?,?,?,?,?)",
  ),
  insVec: db.prepare("INSERT INTO vector(doan_id, bam, vec) VALUES (?,?,?)"),
};

// --tham-chieu: chỉ tính lại bảng tham_chieu từ dữ liệu đã có trong CSDL (sau khi sửa lib/kinh-thanh.mjs).
// Không đọc lại file Markdown, không xóa CSDL (chạy được cả khi server đang mở CSDL).
if (args.includes("--tham-chieu")) {
  const t0 = Date.now();
  let n = 0;
  const tc = (baiId, doanId, text, nguon) => {
    for (const r of timThamChieu(text)) {
      q.insTc.run(baiId, doanId, r.sach, r.chuong, r.tu, r.den, r.raw, r.khong_chac, nguon);
      n++;
    }
  };
  db.exec("BEGIN");
  try {
    db.exec("DELETE FROM tham_chieu");
    for (const b of db.prepare("SELECT id, tin_mung FROM bai").all())
      for (const t of JSON.parse(b.tin_mung || "[]")) tc(b.id, null, t, "yaml");
    for (const d of db.prepare("SELECT id, bai_id, noi_dung FROM doan").all())
      tc(d.bai_id, d.id, d.noi_dung, "van-ban");
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
  ghiThongTin(db, "cap_nhat", new Date().toISOString());
  console.log(`Đã tính lại ${n} tham chiếu Kinh Thánh sau ${((Date.now() - t0) / 1000).toFixed(1)} giây.`);
  process.exit(0);
}

const arr = (v) =>
  v == null || v === "" ? [] : Array.isArray(v) ? v.map(String) : [String(v)];
const sha1 = (s) => createHash("sha1").update(s).digest("hex");
const st = { moi: 0, sua: 0, giu: 0, xoa: 0, doan: 0, vecGiu: 0 };
const t0 = Date.now();

function xoaNoiDung(baiId) {
  const old = q.oldDoan.all(baiId);
  for (const d of old) q.delDoanFts.run(d.id);
  q.delBaiFts.run(baiId);
  q.delTc.run(baiId);
  q.delMa.run(baiId);
  q.delDoan.run(baiId);
  return new Map(old.filter((d) => d.vec).map((d) => [d.bam, d.vec]));
}

const conLai = new Set(files);
db.exec("BEGIN");
for (const [n, rel] of files.entries()) {
  const raw = readFileSync(join(root, rel));
  const hash = createHash("sha256").update(raw).digest("hex");
  const cu = q.getBai.get(rel);
  if (cu && cu.sha256 === hash) {
    st.giu++;
    continue;
  }
  const { meta, body, bodyLine } = docBai(raw.toString("utf8"));
  const doan = chiaDoan(body, bodyLine);
  const ma = arr(meta.ma_le),
    nam = arr(meta.nam),
    tm = arr(meta.tin_mung);
  const tacGia =
    meta.tac_gia && meta.tac_gia !== "Vô danh" ? String(meta.tac_gia) : null;
  const vals = [
    JSON.stringify(ma),
    JSON.stringify(nam),
    meta.ten_le ?? null,
    JSON.stringify(tm),
    tacGia,
    meta.chu_de ?? null,
    doan.length,
  ];
  let id,
    vecCu = new Map();
  if (cu) {
    vecCu = xoaNoiDung(cu.id);
    q.updBai.run(hash, ...vals, cu.id);
    id = cu.id;
    st.sua++;
  } else {
    id = q.insBai.get(rel, hash, ...vals).id;
    st.moi++;
  }
  q.insBaiFts.run(
    id,
    meta.chu_de ?? "",
    tacGia ?? "",
    meta.ten_le ?? "",
    boDau(`${meta.chu_de ?? ""} ${tacGia ?? ""} ${meta.ten_le ?? ""}`),
  );
  for (const m of ma) q.insMa.run(id, m);
  for (const t of tm)
    for (const r of timThamChieu(t))
      q.insTc.run(
        id,
        null,
        r.sach,
        r.chuong,
        r.tu,
        r.den,
        r.raw,
        r.khong_chac,
        "yaml",
      );
  for (const d of doan) {
    const bam = sha1(d.noi_dung);
    const did = q.insDoan.get(
      id,
      d.thu_tu,
      d.dong_dau,
      d.dong_cuoi,
      d.so_tu,
      bam,
      d.noi_dung,
    ).id;
    q.insDoanFts.run(did, d.noi_dung, boDau(d.noi_dung));
    for (const r of timThamChieu(d.noi_dung))
      q.insTc.run(
        id,
        did,
        r.sach,
        r.chuong,
        r.tu,
        r.den,
        r.raw,
        r.khong_chac,
        "van-ban",
      );
    const v = vecCu.get(bam);
    if (v) {
      q.insVec.run(did, bam, v);
      st.vecGiu++;
    }
    st.doan++;
  }
  if ((n + 1) % 2000 === 0) {
    db.exec("COMMIT; BEGIN");
    process.stdout.write(`  ${n + 1}/${files.length}\r`);
  }
}
for (const b of q.allBai.all())
  if (!conLai.has(b.duong_dan)) {
    xoaNoiDung(b.id);
    q.delBai.run(b.id);
    st.xoa++;
  }
ghiThongTin(db, "thu_muc_nguon", root);
ghiThongTin(db, "cap_nhat", new Date().toISOString());
db.exec("COMMIT");
if (st.moi + st.sua + st.xoa)
  db.exec(
    "INSERT INTO doan_fts(doan_fts) VALUES('optimize'); INSERT INTO bai_fts(bai_fts) VALUES('optimize');",
  );
const tong = db
  .prepare(
    "SELECT (SELECT count(*) FROM bai) b, (SELECT count(*) FROM doan) d, (SELECT count(*) FROM vector) v, (SELECT count(*) FROM tham_chieu) t",
  )
  .get();
db.close();
console.log(`Xong sau ${((Date.now() - t0) / 1000).toFixed(1)} giây.
  File: ${st.moi} mới, ${st.sua} đã sửa, ${st.giu} giữ nguyên, ${st.xoa} đã xóa khỏi chỉ mục.
  Đoạn lập lại: ${st.doan}${st.vecGiu ? ` (dùng lại ${st.vecGiu} vector cũ)` : ""}.
  Tổng trong chỉ mục: ${tong.b} bài, ${tong.d} đoạn, ${tong.t} tham chiếu Kinh Thánh, ${tong.v} đoạn đã có vector.
  ${tong.v < tong.d ? 'Chạy "node TIM-KIEM/tao-vector.mjs" để tạo vector cho tìm theo ý nghĩa.' : ""}`);

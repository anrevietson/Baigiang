#!/usr/bin/env node
// Đóng gói cả thư viện + bộ tìm kiếm thành MỘT file HTML, mở bằng trình duyệt là dùng
// (không cần Node, Ollama hay mạng). Tìm được: từ khóa, câu Kinh Thánh, tên ngày lễ, ngày.
//
//   node TIM-KIEM/lap-chi-muc.mjs        (cập nhật chỉ mục trước)
//   node TIM-KIEM/dong-goi-html.mjs      → TIM-KIEM/xuat/Tim-kiem-bai-giang.html
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { moCsdl, DB_PATH, TOOL_DIR, LIB_ROOT, thongTin } from "./lib/csdl.mjs";

export function taoDuLieu(db, libRoot = LIB_ROOT, { goiY = false } = {}) {
  const bai = db
    .prepare(
      "SELECT id, duong_dan, chu_de, tac_gia, ten_le, ma_le, nam, tin_mung FROM bai ORDER BY duong_dan",
    )
    .all();
  const idx = new Map(bai.map((b, i) => [b.id, i]));
  const doanRows = db
    .prepare(
      "SELECT d.id, d.bai_id, d.noi_dung FROM doan d JOIN bai b ON b.id=d.bai_id ORDER BY b.duong_dan, d.thu_tu",
    )
    .all();
  const didx = new Map(doanRows.map((d, i) => [d.id, i]));
  const sach = [
    ...new Set(
      db
        .prepare("SELECT DISTINCT sach FROM tham_chieu")
        .all()
        .map((r) => r.sach),
    ),
  ];
  const tc = [],
    tcBai = [];
  for (const r of db
    .prepare(
      "SELECT bai_id, doan_id, sach, chuong, tu, den, khong_chac, nguon FROM tham_chieu",
    )
    .iterate()) {
    const row = [
      r.doan_id == null ? idx.get(r.bai_id) : didx.get(r.doan_id),
      sach.indexOf(r.sach),
      r.chuong,
      r.tu ?? -1,
      r.den ?? -1,
      r.khong_chac,
    ];
    (r.nguon === "yaml" ? tcBai : tc).push(...row);
  }
  const le = db
    .prepare(
      `SELECT m.ma, b.ten_le ten, count(*) n FROM bai_ma m JOIN bai b ON b.id=m.bai_id
                         WHERE b.ten_le IS NOT NULL AND b.ten_le<>'' GROUP BY m.ma, b.ten_le ORDER BY m.ma`,
    )
    .all()
    .map((r) => [r.ma, r.ten, r.n]);
  const tacGia = db
    .prepare(
      `SELECT tac_gia FROM bai WHERE tac_gia IS NOT NULL GROUP BY tac_gia HAVING count(*)>=3 ORDER BY count(*) DESC LIMIT 400`,
    )
    .all()
    .map((r) => r.tac_gia);
  // lịch ngày → mã lễ (lịch phụng vụ còn phát 95002 cho lễ Chúa Kitô Vua; thư viện dùng 5340)
  const lich = {};
  const p = join(libRoot, "TRA-CUU", "lich-ngay.json");
  if (existsSync(p)) {
    for (const [ngay, d] of Object.entries(
      JSON.parse(readFileSync(p, "utf8")).ngay,
    )) {
      const y = +ngay.slice(0, 4);
      lich[ngay] = d.le
        .filter((l) => l.celebrationCode || l.readingCode)
        .map((l) => {
          let ma = l.celebrationCode ?? l.readingCode;
          if (ma === "95002") ma = "5340";
          return [ma, d.nam ?? (l.celebrationCode ? null : y % 2 ? "I" : "II")];
        });
    }
  }
  return {
    v: 1,
    tao_luc: new Date().toISOString(),
    bai: bai.map((b) => [
      b.duong_dan,
      b.chu_de,
      b.tac_gia,
      b.ten_le,
      JSON.parse(b.ma_le),
      JSON.parse(b.nam),
      JSON.parse(b.tin_mung),
    ]),
    doan: doanRows.map((d) => d.noi_dung),
    doan_bai: doanRows.map((d) => idx.get(d.bai_id)),
    sach,
    tc,
    tc_bai: tcBai,
    le,
    tac_gia: tacGia,
    lich,
    ...(goiY && { goi_y: taoGoiY(db, idx, didx) }),
  };
}

/**
 * Ngân hàng gợi ý bài giảng cho bản HTML (chỉ khi --goi-y). Không nhúng lại nguyên văn bài giảng:
 * nguồn bài giảng chỉ lưu chỉ số bài (b) và đoạn (d) để mở bằng khung đọc sẵn có, cùng câu trích ngắn.
 */
export function taoGoiY(db, idx, didx) {
  const coBang = db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='goi_y_bo'").get();
  if (!coBang) return { v: 1, bo: [] };
  const baiId = db.prepare("SELECT id FROM bai WHERE duong_dan=?");
  const doanTai = db.prepare("SELECT id FROM doan WHERE bai_id=? AND dong_dau<=? AND dong_cuoi>=? ORDER BY thu_tu LIMIT 1");
  const doanGan = db.prepare("SELECT id FROM doan WHERE bai_id=? AND dong_dau<=? ORDER BY dong_dau DESC LIMIT 1");
  const goiYCua = db.prepare("SELECT * FROM goi_y WHERE thu_muc=? ORDER BY so");
  const ldCua = db.prepare("SELECT * FROM luan_diem WHERE goi_y_id=? ORDER BY so");
  const ngCua = db.prepare("SELECT * FROM nguon_goi_y WHERE luan_diem_id=? ORDER BY id");
  const bo = db.prepare("SELECT * FROM goi_y_bo ORDER BY thu_muc").all().map((b) => ({
    tm: b.thu_muc, ma: b.celebration_code, ten: b.ten_le, loai: b.loai_ngay, chu_ky: JSON.parse(b.chu_ky), tt_nguon: b.trang_thai_nguon,
    goi_y: goiYCua.all(b.thu_muc).map((g) => ({
      ma: g.ma, so: g.so, loai: g.loai_nguon, nam: JSON.parse(g.ap_dung_nam), tieu_de: g.tieu_de, chu_de: g.chu_de, luan_de: g.luan_de,
      nen: JSON.parse(g.loi_chua_nen ?? "null"), lien_he: g.lien_he_bai_doc, su_diep: g.su_diep, ap_dung: JSON.parse(g.ap_dung ?? "[]"),
      duyet: JSON.parse(g.duyet ?? "{}"),
      ld: ldCua.all(g.id).map((l) => ({
        so: l.so, tieu_de: l.tieu_de, giai_thich: l.giai_thich,
        kt: JSON.parse(l.kinh_thanh ?? "[]").map((k) => ({ ref: k.ref ?? null, trich: k.trich ?? null, qua: k.qua?.duong_dan ?? null })),
        ng: ngCua.all(l.id).map((n) => {
          const o = { loai: n.loai, so: n.so, trich: n.trich, theo: n.ghi_chu };
          if (n.duong_dan) {
            const bi = baiId.get(n.duong_dan);
            const dd = bi && (doanTai.get(bi.id, n.dong_dau, n.dong_dau) ?? doanGan.get(bi.id, n.dong_dau));
            Object.assign(o, { dd: n.duong_dan, dong: [n.dong_dau, n.dong_cuoi], b: bi ? idx.get(bi.id) : null, d: dd ? didx.get(dd.id) : null });
          }
          return o;
        }),
      })),
    })),
  }));
  return {
    v: 1, bo,
    kcn_url: "https://www.vatican.va/roman_curia/congregations/ccdds/documents/rc_con_ccdds_doc_20140629_direttorio-omiletico_en.html",
  };
}

/** Gộp các module của bộ máy thành một đoạn script thường (bỏ import/export) */
export function gopMa() {
  return (
    "const BoMay = (() => {\n" +
    ["tieng-viet", "kinh-thanh", "ngay-le", "bo-may-html"]
      .map((f) =>
        readFileSync(join(TOOL_DIR, "lib", f + ".mjs"), "utf8")
          .replace(/^import .*$/gm, "")
          .replace(/^export (?=function|const|let|async)/gm, ""),
      )
      .join("\n") +
    "\nreturn { taoBoMay };\n})();"
  );
}

if (
  process.argv[1] &&
  import.meta.url.endsWith(process.argv[1].split(/[\\/]/).pop())
) {
  if (!existsSync(DB_PATH)) {
    console.error("Chưa có chỉ mục. Chạy trước: node TIM-KIEM/lap-chi-muc.mjs");
    process.exit(1);
  }
  // --goi-y: kèm ngân hàng gợi ý bài giảng (bảng goi_y*) → mặc định xuất baigiang-goi-y.html (chỉ dùng local)
  const coGoiY = process.argv.includes("--goi-y");
  const out = process.argv.includes("--ra")
    ? process.argv[process.argv.indexOf("--ra") + 1]
    : coGoiY ? join(LIB_ROOT, "baigiang-goi-y.html") : join(TOOL_DIR, "xuat", "Tim-kiem-bai-giang.html");
  const db = moCsdl(DB_PATH, { readOnly: true });
  const t0 = Date.now();
  const D = taoDuLieu(db, LIB_ROOT, { goiY: coGoiY });
  const json = Buffer.from(JSON.stringify(D));
  const gz = gzipSync(json, { level: 9 });
  const html = readFileSync(
    join(TOOL_DIR, "giao-dien", "mot-file.html"),
    "utf8",
  )
    .replace("/*__BO_MAY__*/", () =>
      gopMa().replace(/<\/script/gi, "<\\/script"),
    )
    .replace("__NGAY_DONG_GOI__", new Date().toLocaleDateString("vi-VN"))
    .replace("__DU_LIEU__", () => gz.toString("base64"));
  mkdirSync(join(out, ".."), { recursive: true });
  writeFileSync(out, html);
  console.log(`Xong sau ${((Date.now() - t0) / 1000).toFixed(1)} giây: ${out}
  ${D.bai.length} bài, ${D.doan.length} đoạn · dữ liệu ${(json.length / 1e6).toFixed(0)} MB → nén ${(gz.length / 1e6).toFixed(0)} MB · file HTML ${(Buffer.byteLength(html) / 1e6).toFixed(0)} MB.
  Chỉ mục cập nhật lúc: ${thongTin(db, "cap_nhat")}.${D.goi_y ? `
  Gợi ý bài giảng: ${D.goi_y.bo.length} mã lễ, ${D.goi_y.bo.reduce((n, b) => n + b.goi_y.length, 0)} gợi ý.` : ""}`);
}

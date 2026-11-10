#!/usr/bin/env node
// Tạo vector (embedding) cho các đoạn chưa có, bằng Ollama chạy trên máy.
//
//   ollama pull bge-m3                         (một lần; mô hình đa ngôn ngữ, hiểu tiếng Việt)
//   node TIM-KIEM/tao-vector.mjs               chỉ làm các đoạn chưa có vector (chạy lại được, dừng giữa chừng không sao)
//   node TIM-KIEM/tao-vector.mjs --mo-hinh nomic-embed-text --lam-lai   đổi mô hình: xóa vector cũ, làm lại
//   node TIM-KIEM/tao-vector.mjs --lo 64       số đoạn gửi một lần (mặc định 32)
//
// Biến môi trường: OLLAMA_HOST (mặc định http://127.0.0.1:11434)
import { moCsdl, DB_PATH, thongTin, ghiThongTin } from "./lib/csdl.mjs";
import {
  taoVector,
  ollamaSanSang,
  vanBanDoan,
  MO_HINH_MAC_DINH,
  ollamaHost,
} from "./lib/ollama.mjs";
import { existsSync } from "node:fs";

const a = process.argv.slice(2);
const opt = (k, d) => (a.includes(k) ? a[a.indexOf(k) + 1] : d);
if (!existsSync(DB_PATH)) {
  console.error("Chưa có chỉ mục. Chạy trước: node TIM-KIEM/lap-chi-muc.mjs");
  process.exit(1);
}
const db = moCsdl();
const cu = thongTin(db, "embed_model");
const model = opt("--mo-hinh", cu ?? MO_HINH_MAC_DINH);
const lo = +opt("--lo", 32);

if (cu && cu !== model && !a.includes("--lam-lai")) {
  console.error(
    `Chỉ mục đang dùng mô hình "${cu}". Muốn đổi sang "${model}" thì thêm --lam-lai (xóa toàn bộ vector cũ).`,
  );
  process.exit(1);
}
const s = await ollamaSanSang(model);
if (!s.ok) {
  console.error(s.ly_do);
  process.exit(1);
}
if (a.includes("--lam-lai")) {
  db.exec(
    "DELETE FROM vector; DELETE FROM thong_tin WHERE k IN ('embed_model','embed_dim');",
  );
  console.log("Đã xóa vector cũ.");
}

const can = db
  .prepare(
    `SELECT d.id, d.bam, d.noi_dung, b.chu_de FROM doan d JOIN bai b ON b.id=d.bai_id
                        WHERE d.id NOT IN (SELECT doan_id FROM vector) ORDER BY d.id`,
  )
  .all();
const tong = db.prepare("SELECT count(*) n FROM doan").get().n;
console.log(
  `Mô hình ${model} tại ${ollamaHost()}. Cần tạo ${can.length} / ${tong} đoạn.`,
);
if (!can.length) process.exit(0);

const ins = db.prepare(
  "INSERT OR REPLACE INTO vector(doan_id, bam, vec) VALUES (?,?,?)",
);
const t0 = Date.now();
let dim = +(thongTin(db, "embed_dim") ?? 0),
  xong = 0;
for (let i = 0; i < can.length; i += lo) {
  const batch = can.slice(i, i + lo);
  let vs;
  for (let thu = 1; ; thu++) {
    try {
      vs = await taoVector(
        batch.map((d) => vanBanDoan(d.chu_de, d.noi_dung)),
        model,
      );
      break;
    } catch (e) {
      if (thu >= 3) {
        console.error(
          `\nDừng: ${e.message}. Chạy lại lệnh để làm tiếp từ chỗ dừng.`,
        );
        process.exit(1);
      }
      await new Promise((r) => setTimeout(r, 3000 * thu));
    }
  }
  if (!dim) {
    dim = vs[0].length;
    ghiThongTin(db, "embed_dim", dim);
    ghiThongTin(db, "embed_model", model);
  }
  if (vs[0].length !== dim) {
    console.error(
      `Mô hình trả vector ${vs[0].length} chiều, chỉ mục đang ${dim} chiều. Dùng --lam-lai.`,
    );
    process.exit(1);
  }
  db.exec("BEGIN");
  batch.forEach((d, j) => ins.run(d.id, d.bam, new Uint8Array(vs[j].buffer)));
  db.exec("COMMIT");
  xong += batch.length;
  const giay = (Date.now() - t0) / 1000;
  process.stdout.write(
    `  ${xong}/${can.length} đoạn · ${(xong / giay).toFixed(1)} đoạn/giây · còn khoảng ${Math.round((can.length - xong) / (xong / giay) / 60)} phút   \r`,
  );
}
ghiThongTin(db, "embed_model", model);
ghiThongTin(db, "embed_dim", dim);
console.log(
  `\nXong: ${xong} đoạn trong ${Math.round((Date.now() - t0) / 1000)} giây.`,
);

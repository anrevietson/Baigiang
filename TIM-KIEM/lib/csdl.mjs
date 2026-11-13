// Mở cơ sở dữ liệu tìm kiếm (SQLite có sẵn trong Node ≥ 22.13, không cần cài gói).
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Ẩn cảnh báo "SQLite is an experimental feature" của Node.
const emit = process.emitWarning;
process.emitWarning = (w, ...a) => (String(w).includes('SQLite') ? undefined : emit.call(process, w, ...a));
const { DatabaseSync } = await import('node:sqlite');

export const TOOL_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');
export const LIB_ROOT = join(TOOL_DIR, '..');                 // thư mục PhungVu-MD
export const DB_PATH = process.env.TIM_KIEM_DB ?? join(TOOL_DIR, 'du-lieu', 'tim-kiem.sqlite');
export const SCHEMA_VERSION = '1';

export function moCsdl(path = DB_PATH, { readOnly = false } = {}) {
  if (!readOnly) mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path, { readOnly });
  if (!readOnly) {
    db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL; PRAGMA foreign_keys=ON;`);
    db.exec(SCHEMA);
    db.prepare(`INSERT OR IGNORE INTO thong_tin(k, v) VALUES ('schema', ?)`).run(SCHEMA_VERSION);
  }
  return db;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS thong_tin (k TEXT PRIMARY KEY, v TEXT);

-- Tầng 1: chỉ mục bài giảng
CREATE TABLE IF NOT EXISTS bai (
  id INTEGER PRIMARY KEY,
  duong_dan TEXT NOT NULL UNIQUE,      -- vd "1010-A/001.md"
  sha256 TEXT NOT NULL,
  ma_le TEXT, nam TEXT, ten_le TEXT, tin_mung TEXT,   -- ma_le, nam, tin_mung: mảng JSON như trong YAML
  tac_gia TEXT, chu_de TEXT,
  so_doan INTEGER
);
CREATE TABLE IF NOT EXISTS bai_ma (bai_id INTEGER NOT NULL REFERENCES bai(id) ON DELETE CASCADE, ma TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS bai_ma_ma ON bai_ma(ma);
CREATE VIRTUAL TABLE IF NOT EXISTS bai_fts USING fts5(chu_de, tac_gia, ten_le, khong_dau,
  content='', contentless_delete=1, tokenize='unicode61 remove_diacritics 0');

-- Tầng 2: chỉ mục đoạn văn (nguyên văn, kèm vị trí dòng trong file gốc)
CREATE TABLE IF NOT EXISTS doan (
  id INTEGER PRIMARY KEY,
  bai_id INTEGER NOT NULL REFERENCES bai(id) ON DELETE CASCADE,
  thu_tu INTEGER NOT NULL,
  dong_dau INTEGER NOT NULL, dong_cuoi INTEGER NOT NULL,
  so_tu INTEGER NOT NULL,
  bam TEXT NOT NULL,                   -- sha1 nội dung đoạn: dùng lại vector khi bài sửa
  noi_dung TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS doan_bai ON doan(bai_id);
CREATE INDEX IF NOT EXISTS doan_bam ON doan(bam);
-- noi_dung: có dấu (tìm đúng dấu); khong_dau: bản bỏ dấu (khi người dùng gõ không dấu)
CREATE VIRTUAL TABLE IF NOT EXISTS doan_fts USING fts5(noi_dung, khong_dau,
  content='', contentless_delete=1, tokenize='unicode61 remove_diacritics 0');

-- Tham chiếu Kinh Thánh. nguon='van-ban': có trong đoạn văn; nguon='yaml': tin_mung của bài.
CREATE TABLE IF NOT EXISTS tham_chieu (
  bai_id INTEGER NOT NULL REFERENCES bai(id) ON DELETE CASCADE,
  doan_id INTEGER REFERENCES doan(id) ON DELETE CASCADE,
  sach TEXT NOT NULL, chuong INTEGER NOT NULL, tu INTEGER, den INTEGER,
  raw TEXT, khong_chac INTEGER NOT NULL DEFAULT 0, nguon TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS tham_chieu_sc ON tham_chieu(sach, chuong);

-- Chỉ mục ý nghĩa: vector Float32 đã chuẩn hóa độ dài 1 (mô hình ghi ở thong_tin.embed_model)
CREATE TABLE IF NOT EXISTS vector (
  doan_id INTEGER PRIMARY KEY REFERENCES doan(id) ON DELETE CASCADE,
  bam TEXT NOT NULL,
  vec BLOB NOT NULL
);

-- Tầng 3: gợi ý bài giảng do AI biên soạn (nguồn: AI-DAN-Y/OUTPUT/<thư mục>/goi-y.json).
-- Tách riêng khỏi bài giảng gốc. Nạp bằng AI-DAN-Y/CONG-CU/nap-csdl.mjs.
CREATE TABLE IF NOT EXISTS goi_y_bo (
  thu_muc TEXT PRIMARY KEY,            -- vd "1010-A"
  celebration_code TEXT NOT NULL,
  ten_le TEXT, loai_ngay TEXT,
  chu_ky TEXT NOT NULL,                -- JSON, vd ["A"], ["I","II"], [null]
  sha256_file TEXT NOT NULL,           -- hash file goi-y.json: không đổi thì không nạp lại
  van_tay_nguon TEXT,
  trang_thai_nguon TEXT NOT NULL DEFAULT 'khop',   -- khop | nguon-da-doi
  chi_tiet_nguon TEXT,                 -- JSON: các nguồn đã đổi
  nap_luc TEXT
);
CREATE TABLE IF NOT EXISTS goi_y (
  id INTEGER PRIMARY KEY,
  ma TEXT NOT NULL UNIQUE,             -- "1010-A/01"
  thu_muc TEXT NOT NULL REFERENCES goi_y_bo(thu_muc) ON DELETE CASCADE,
  so INTEGER NOT NULL,
  loai_nguon TEXT NOT NULL,            -- kim-chi-nam-phu-luc | kim-chi-nam-nguyen-tac | bai-giang
  ap_dung_nam TEXT NOT NULL,           -- JSON
  tieu_de TEXT NOT NULL, chu_de TEXT, luan_de TEXT,
  loi_chua_nen TEXT,                   -- JSON
  lien_he_bai_doc TEXT, su_diep TEXT, ap_dung TEXT,  -- ap_dung: JSON
  trang_thai_duyet TEXT NOT NULL DEFAULT 'draft',    -- draft | da-duyet | can-sua | tu-choi
  duyet TEXT                           -- JSON đầy đủ (người, lúc, ghi chú)
);
CREATE INDEX IF NOT EXISTS goi_y_thu_muc ON goi_y(thu_muc);
-- tra theo mã lễ + năm, không cần AI: SELECT ... FROM goi_y_ma WHERE ma=? AND (nam IS NULL OR nam=?)
CREATE TABLE IF NOT EXISTS goi_y_ma (
  goi_y_id INTEGER NOT NULL REFERENCES goi_y(id) ON DELETE CASCADE,
  ma TEXT NOT NULL, nam TEXT
);
CREATE INDEX IF NOT EXISTS goi_y_ma_ma ON goi_y_ma(ma);
CREATE TABLE IF NOT EXISTS luan_diem (
  id INTEGER PRIMARY KEY,
  goi_y_id INTEGER NOT NULL REFERENCES goi_y(id) ON DELETE CASCADE,
  so INTEGER NOT NULL,
  tieu_de TEXT NOT NULL, giai_thich TEXT,
  kinh_thanh TEXT                      -- JSON
);
CREATE INDEX IF NOT EXISTS luan_diem_goi_y ON luan_diem(goi_y_id);
CREATE TABLE IF NOT EXISTS nguon_goi_y (
  id INTEGER PRIMARY KEY,
  luan_diem_id INTEGER NOT NULL REFERENCES luan_diem(id) ON DELETE CASCADE,
  loai TEXT NOT NULL,                  -- bai-giang | kim-chi-nam | glhtcg | loi-chua
  duong_dan TEXT, dong_dau INTEGER, dong_cuoi INTEGER,   -- bài giảng gốc
  so TEXT,                             -- số đoạn Kim Chỉ Nam / số GLHTCG
  trich TEXT, ghi_chu TEXT,
  sha256 TEXT, bam_dong TEXT
);
CREATE INDEX IF NOT EXISTS nguon_goi_y_ld ON nguon_goi_y(luan_diem_id);
CREATE INDEX IF NOT EXISTS nguon_goi_y_dd ON nguon_goi_y(duong_dan);
CREATE VIRTUAL TABLE IF NOT EXISTS goi_y_fts USING fts5(tieu_de, chu_de, noi_dung, khong_dau,
  content='', contentless_delete=1, tokenize='unicode61 remove_diacritics 0');
CREATE VIRTUAL TABLE IF NOT EXISTS luan_diem_fts USING fts5(tieu_de, giai_thich, khong_dau,
  content='', contentless_delete=1, tokenize='unicode61 remove_diacritics 0');
`;

export const thongTin = (db, k) => db.prepare('SELECT v FROM thong_tin WHERE k=?').get(k)?.v ?? null;
export const ghiThongTin = (db, k, v) => db.prepare('INSERT INTO thong_tin(k,v) VALUES(?,?) ON CONFLICT(k) DO UPDATE SET v=excluded.v').run(k, String(v));

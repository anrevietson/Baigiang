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
`;

export const thongTin = (db, k) => db.prepare('SELECT v FROM thong_tin WHERE k=?').get(k)?.v ?? null;
export const ghiThongTin = (db, k, v) => db.prepare('INSERT INTO thong_tin(k,v) VALUES(?,?) ON CONFLICT(k) DO UPDATE SET v=excluded.v').run(k, String(v));

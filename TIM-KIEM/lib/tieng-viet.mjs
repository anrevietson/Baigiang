// Chuẩn hóa chữ Việt cho chỉ mục và truy vấn.

/** NFC, và đổi chữ Ð/ð Latin (Eth, hay gặp khi gõ sai) thành Đ/đ tiếng Việt. */
export function nfc(s) {
  return String(s ?? '').normalize('NFC').replace(/Ð/g, 'Đ').replace(/ð/g, 'đ');
}

/**
 * Bỏ dấu, viết thường, GIỮ NGUYÊN độ dài (mỗi ký tự → một ký tự),
 * để vị trí trong chuỗi bỏ dấu trùng vị trí trong nguyên văn (dùng khi tô sáng).
 */
export function boDau(s) {
  let out = '';
  for (const ch of nfc(s)) {
    if (ch === 'đ' || ch === 'Đ') { out += 'd'; continue; }
    const base = ch.normalize('NFD')[0];
    out += (base.length === ch.length ? base : ch).toLowerCase();
  }
  return out;
}

const TONE_RE = /[̀-ͯ]/;
/** Truy vấn có dấu tiếng Việt không? (không có dấu → tìm trên cột bỏ dấu) */
export function coDau(s) {
  const t = nfc(s);
  return /[đĐ]/.test(t) || TONE_RE.test(t.normalize('NFD'));
}

/** Tách từ (âm tiết) như tokenizer unicode61: chuỗi chữ/số liền nhau. */
export function tach(s) {
  return nfc(s).match(/[\p{L}\p{N}]+/gu) ?? [];
}

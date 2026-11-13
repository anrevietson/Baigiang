# Cấu trúc `goi-y.json` (schema `goi-y/1`)

Bản nháp tác giả viết: `LAM-VIEC/<tm>/goi-y.nhap.json`. Các trường đánh dấu (tự động) do `ghi-goi-y.mjs` thêm khi ghi vào `OUTPUT/<tm>/goi-y.json`.

```jsonc
{
  "schema": "goi-y/1",
  "thu_muc": "1010-A",                 // tên thư mục bài giảng
  "celebrationCode": "1010",
  "ten_le": "Chúa Nhật I Mùa Vọng",
  "loai_ngay": "chua-nhat",            // chua-nhat | le-trong | ngay-thuong | le-thanh
  "chu_ky": ["A"],                     // ["I","II"] cho ngày thường; [null] khi không theo chu kỳ
  "bien_soan": { "boi": "...", "luc": "YYYY-MM-DD", "ghi_chu": "..." },
  "khong_dung": [ { "duong_dan": "1010-A/117-tach-03.md", "ly_do": "..." } ],
  "goi_y": [
    {
      "so": 1,
      "loai_nguon": "kim-chi-nam-phu-luc",   // kim-chi-nam-phu-luc | kim-chi-nam-nguyen-tac | bai-giang
      "ap_dung_nam": ["A"],                   // tập con của chu_ky
      "tieu_de": "...",
      "chu_de": "...",                        // chủ đề xuyên suốt, 1 câu
      "loi_chua_nen": { "ref": "Mt 24,42", "doan": "gospel", "nam": "A", "trich": "<nguyên văn trong loi-chua.json>" },
      "luan_de": "...",
      "luan_diem": [
        {
          "so": 1,
          "tieu_de": "...",
          "giai_thich": "...",
          "kinh_thanh": [
            { "ref": "Is 2,5", "doan": "firstReading", "nam": "A", "trich": "<nguyên văn>" },
            { "ref": "1Tx 5,2", "qua": { "duong_dan": "1010-A/097.md", "dong": [20, 20] } }   // ngoài bộ bài đọc: chỉ nêu, không chép
          ],
          "nguon": [
            { "loai": "bai-giang", "duong_dan": "1010-A/093.md", "dong": [24, 26], "trich": "<nguyên văn>" },
            { "loai": "kim-chi-nam", "so": "82", "trich": "<nguyên văn tiếng Anh>" },
            { "loai": "glhtcg", "so": "668-677, 769", "theo": "Phụ lục I Kim Chỉ Nam" },
            { "loai": "loi-chua", "doan": "gospel", "nam": "A" }
          ]
        }
      ],
      "lien_he_bai_doc": "...",
      "su_diep": "...",
      "ap_dung": ["...", "..."],
      "duyet": { "trang_thai": "draft", "nguoi": null, "luc": null, "ghi_chu": null }
    }
  ],
  // (tự động)
  "loi_chua": { "file": "OUTPUT/1010-A/loi-chua.json", "sha256": "...", "lich_commit": "..." },
  "nguon_bai_giang": { "so_bai": 110, "so_doc_lap": 96, "van_tay": "..." },
  "van_tay_nguon": "...",              // hash của: Lời Chúa + mọi file bài giảng được trích + Kim Chỉ Nam
  "ghi_luc": "ISO time"
}
```

Mỗi nguồn `bai-giang` được gắn tự động `sha256` (cả file) và `bam_dong` (sha1 của các dòng được trích) để phát hiện thay đổi đúng chỗ.

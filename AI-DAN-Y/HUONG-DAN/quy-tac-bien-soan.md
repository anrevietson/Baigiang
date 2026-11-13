# Quy tắc biên soạn gợi ý bài giảng (AI-DAN-Y)

Áp dụng cho mọi gợi ý trong `AI-DAN-Y/OUTPUT/<thư mục>/goi-y.json`. Kiểm tra máy: `node AI-DAN-Y/CONG-CU/kiem-tra.mjs`.

## 1. Thứ tự làm việc cho một mã lễ
1. `doi-chieu-loi-chua.mjs <tm>` — lấy đúng bộ Lời Chúa theo quy tắc của `catholic-cal-vn` (celebrationCode → readingCode qua `TRA-CUU/lich-ngay.json`, rồi `resolveReadingSource`). Lưu `loi-chua.json` nguyên văn.
2. `chuan-bi.mjs <tm>` — thu thập MỌI bài có mã lễ đó (theo `bai_ma` + năm), gom bài trùng theo nội dung (shingle 6 từ, ngưỡng 80%), xuất gói đọc có số dòng gốc.
3. Đọc hết từng gói. Ghi `LAM-VIEC/<tm>/trich-y.md`: mỗi bài một dòng (hướng chính, ý + số dòng), đánh dấu bài xếp nhầm ngày, bài không phải bài giảng, dữ liệu cá nhân.
4. Gom các hướng thực sự độc lập → 1–5 gợi ý. Không thêm gợi ý chỉ để đủ số.
5. Viết bản nháp `LAM-VIEC/<tm>/goi-y.nhap.json` theo `SCHEMA/goi-y.md`.
6. `ghi-goi-y.mjs <tm>` — kiểm tra, gắn hash nguồn, ghi vào OUTPUT (không ghi đè gợi ý đã duyệt).

## 2. Gợi ý 01
- Có mục Phụ lục I Kim Chỉ Nam: `loai_nguon = "kim-chi-nam-phu-luc"`; dùng đúng các số GLHTCG của mục đó (xem `kim-chi-nam-tham-chieu.json`).
- Không có mục: `loai_nguon = "kim-chi-nam-nguyen-tac"`; chỉ viện dẫn các số đoạn Kim Chỉ Nam đã đối chiếu; ghi rõ đây KHÔNG phải dàn ý chính thức.
- Gợi ý 02–05: `loai_nguon = "bai-giang"`.

## 3. Nguồn và trích dẫn
- Mỗi luận điểm có ít nhất một nguồn. Mỗi nguồn `bai-giang` có `duong_dan`, `dong` [đầu, cuối] theo file gốc, và `trich` là **nguyên văn** một đoạn ngắn trong các dòng đó.
- Lời Chúa trích từ `loi-chua.json` (`doan` + `trich` nguyên văn). Câu Kinh Thánh ngoài bộ bài đọc chỉ được nêu khi một bài giảng nguồn có nêu; không chép nguyên văn từ trí nhớ.
- GLHTCG: chỉ ghi số theo Phụ lục I; không trích nguyên văn khi chưa có bản tiếng Việt đã xác minh (`nguyen_van: "chua-xac-minh"`).
- Kim Chỉ Nam: ghi số đoạn; `trich` là nguyên văn tiếng Anh; phần tiếng Việt là diễn ý.
- Không dùng: bài trùng (trích bản chính), bài xếp nhầm ngày, thông báo/tài liệu không phải bài giảng, dữ liệu cá nhân (tên người thật trong thông báo, email).
- Giai thoại, số liệu, dữ kiện lịch sử trong bài giảng: chỉ dẫn lại kèm nguồn, không khẳng định là đã kiểm chứng.

## 4. Nội dung
- Chúa nhật/lễ trọng: chủ đề xuyên suốt dưới ánh sáng Mầu nhiệm Đức Kitô; liên hệ các bài đọc khi có thật; không ép Bài đọc I thành tiên báo trực tiếp.
- Ngày thường: Tin Mừng làm trục; gợi ý dựa trên Bài đọc I phải ghi `ap_dung_nam` (I hoặc II).
- Lễ thánh: ý nghĩa phụng vụ + chứng tá; không suy diễn rằng mọi chi tiết Kinh Thánh mô tả đời vị thánh.
- Đây là **gợi ý có cấu trúc**, không phải bài giảng hoàn chỉnh.

## 5. Trạng thái
- `duyet.trang_thai`: `draft` (mặc định) · `da-duyet` · `can-sua` · `tu-choi`. Chỉ người phụ trách đổi.
- Trạng thái nguồn tách riêng (`trang_thai_nguon` trong SQLite / báo cáo): `khop` · `nguon-da-doi`. Công cụ không bao giờ sửa nội dung đã duyệt; chỉ gắn cờ.

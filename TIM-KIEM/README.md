# TIM-KIEM — tìm trong kho bài giảng theo từ khóa, ý nghĩa và Kinh Thánh

Công cụ tự đủ: chỉ cần **Node.js ≥ 22.13** (có sẵn SQLite), không cài thêm gói npm nào. Muốn tìm theo ý nghĩa thì cần thêm **Ollama** chạy trên máy.
Công cụ chỉ đọc các file Markdown, không sửa file nào. Mọi chỉ mục nằm trong `TIM-KIEM/du-lieu/tim-kiem.sqlite`; có thể xóa và tạo lại bất cứ lúc nào.

## Dùng nhanh

```bash
# 1. Lập chỉ mục từ khóa + Kinh Thánh (~1 phút cho 15.000 bài; lần sau chỉ làm lại file đã sửa)
node TIM-KIEM/lap-chi-muc.mjs

# 2. (Tùy chọn) chỉ mục ý nghĩa — cần Ollama
ollama pull bge-m3
node TIM-KIEM/tao-vector.mjs          # dừng giữa chừng được; chạy lại sẽ làm tiếp

# 3. Mở giao diện: http://localhost:8686
node TIM-KIEM/server.mjs

# hoặc tìm ngay trên dòng lệnh
node TIM-KIEM/tim.mjs "tỉnh thức"
node TIM-KIEM/tim.mjs "Con người phải chuẩn bị để gặp Chúa" --y-nghia
node TIM-KIEM/tim.mjs "Mt 25,1-13"
node TIM-KIEM/tim.mjs "" --ngay 2026-11-22
```

Sau khi thêm hoặc sửa bài, chạy lại bước 1, rồi bước 2 nếu có dùng tìm theo ý nghĩa. Mỗi bước chỉ làm phần đã thay đổi. Đoạn nào không đổi nội dung thì giữ nguyên vector cũ.

## Bản một-file HTML để gửi người khác

```bash
node TIM-KIEM/lap-chi-muc.mjs        # cập nhật chỉ mục trước
node TIM-KIEM/dong-goi-html.mjs      # → TIM-KIEM/xuat/Tim-kiem-bai-giang.html (khoảng 38 MB)
```

Người nhận chỉ cần mở file này bằng Chrome, Edge, Firefox hoặc Safari bản mới. Không cài gì, không cần mạng, không cần Ollama.

- **Có:** tìm từ khóa (có dấu hoặc không dấu, `"cụm" "cụm"`, `OR`, `-loại trừ`), câu Kinh Thánh, tên ngày lễ, ngày, các bộ lọc, và mở cả bài.
- **Không có:** tìm theo ý nghĩa.
- **Hiệu năng:** mở mất vài giây; trình duyệt dùng khoảng 500 MB bộ nhớ.
- **Cập nhật:** mỗi khi thư viện thay đổi thì đóng gói lại và gửi lại file. File có toàn văn các bài, nên chỉ gửi trong nhóm.

### Bản có gợi ý bài giảng (chỉ dùng local)

```bash
node AI-DAN-Y/CONG-CU/nap-csdl.mjs                  # nạp gợi ý từ AI-DAN-Y/OUTPUT vào SQLite
node TIM-KIEM/dong-goi-html.mjs --goi-y             # → baigiang-goi-y.html (đã có trong .gitignore)
```

Khi chọn ngày, chọn mã lễ hoặc gõ tên lễ, trang hiện khối **Gợi ý bài giảng** phía trên **Bài giảng đã có**. Mỗi luận điểm có checkbox; các luận điểm đã chọn (có thể lấy từ nhiều gợi ý) được gom lại để sao chép. Bấm vào nguồn thì mở bài gốc đúng đoạn. Tất cả chạy offline, không gọi AI. Nếu đóng gói không có `--goi-y` thì trang giống hệt trước. Xem `AI-DAN-Y/README.md`.

## Ba cách tìm

| Cách           | Gõ gì                                                          | Tìm thế nào                                                                                                                                                                                                                                             |
| -------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Từ khóa**    | `tỉnh thức`                                                    | Tìm đúng cụm từ, có dấu hay không dấu (`tinh thuc`) đều được. Nếu có dưới 5 đoạn khớp đúng cụm, tìm thêm các đoạn có các từ đứng gần nhau. Nhiều cụm: `"đèn" "dầu"`. Một trong hai cụm: `"hoán cải" OR "sám hối"`. Loại trừ: `"tỉnh thức" -"mùa vọng"`. |
| **Ý nghĩa**    | một câu, một ý                                                 | So vector của câu tìm với vector từng đoạn (mô hình `bge-m3` qua Ollama `/api/embed`). Tìm được đoạn cùng ý dù dùng chữ khác.                                                                                                                           |
| **Kinh Thánh** | `Mt 25,1-13`, `Mt 25, 1-13`, `Mt. 25:1-13`, `Jn 3:16`, `Lc 15` | Ra các đoạn có trích dẫn trùng hoặc chồng lên khoảng câu đó, và các bài có `tin_mung` trùng.                                                                                                                                                            |

Chế độ **Tất cả** (mặc định) kết hợp từ khóa và ý nghĩa bằng Reciprocal Rank Fusion. Kết quả được gom theo bài, mỗi bài hiện tối đa 3 đoạn.

**Tên ngày lễ** gõ thẳng vào ô tìm cũng được: `thứ ba tuần 32 thường niên`, `Thứ Ba tuần XXXII TN`, `CN 32 TN năm A tỉnh thức`, `chúa nhật 2 phục sinh`, `lễ các thánh`, `22/11/2026`. Công cụ nhận ra tên lễ (số La Mã hay số thường, `CN`, `TN`, có dấu hay không), đổi thành bộ lọc theo mã lễ, rồi tìm phần còn lại trong các bài của lễ đó. Danh sách tên lễ lấy từ `ten_le` của chính các bài.

Có thể lọc theo **ngày** (lấy mã lễ từ `TRA-CUU/lich-ngay.json`), **mã lễ**, **năm** A/B/C/I/II, **tác giả** và **sách Kinh Thánh**.

Kết quả luôn là **nguyên văn** trong file Markdown, kèm số dòng. Bấm vào để mở cả bài tại đúng chỗ. Công cụ không viết đoạn trích mới bằng AI.

## Cấu trúc chỉ mục (SQLite)

| Bảng         | Nội dung                                                                                                                                                                                                                                                                   |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bai`        | Mỗi file một dòng: `duong_dan`, `sha256`, `ma_le`, `nam`, `ten_le`, `tin_mung`, `tac_gia`, `chu_de`                                                                                                                                                                        |
| `bai_fts`    | Tìm theo chủ đề, tác giả, tên lễ                                                                                                                                                                                                                                           |
| `doan`       | Từng đoạn khoảng 100–300 từ, chia theo đoạn văn có sẵn. Đoạn văn dài hơn 400 từ được cắt ở cuối câu. Có `dong_dau` và `dong_cuoi` là số dòng trong file gốc, và `bam` là băm nội dung                                                                                      |
| `doan_fts`   | FTS5 (`unicode61`, giữ dấu) gồm hai cột: nguyên văn và bản bỏ dấu                                                                                                                                                                                                          |
| `tham_chieu` | Trích dẫn Kinh Thánh đã chuẩn hóa (`sach`, `chuong`, `tu`, `den`). `nguon` = `van-ban` (có trong đoạn văn) hoặc `yaml` (lấy từ `tin_mung`). `khong_chac = 1` khi không chắc, ví dụ `Mk` có thể là Mikha (cách viết Việt) hoặc Máccô (cách viết Anh), hay chỉ ghi số chương |
| `vector`     | Vector Float32 đã chuẩn hóa của từng đoạn. Tên mô hình và số chiều ghi trong `thong_tin`                                                                                                                                                                                   |

Khi tạo vector, công cụ đưa vào mô hình **chủ đề bài + nội dung đoạn**, để đoạn ngắn không mất ngữ cảnh.

## Kiểm thử

```bash
node TIM-KIEM/kiem-thu.mjs          # kho mẫu nhỏ: chữ Việt có/không dấu, Ð/Đ, NFD, cụm từ, OR/NOT,
                                    # Kinh Thánh, bộ lọc, cập nhật từng phần, vector (Ollama giả)
node TIM-KIEM/kiem-thu.mjs --kho    # thêm bộ câu hỏi kiem-thu-kho.json trên chỉ mục thật
```

Có thể thêm câu hỏi vào `kiem-thu-kho.json` để theo dõi chất lượng tìm kiếm mỗi khi đổi mô hình hoặc cách chia đoạn.

## Tùy chỉnh

| Biến môi trường  | Mặc định                                                                         |
| ---------------- | -------------------------------------------------------------------------------- |
| `OLLAMA_HOST`    | `http://127.0.0.1:11434`                                                         |
| `TIM_KIEM_MODEL` | `bge-m3` (đổi mô hình: `node TIM-KIEM/tao-vector.mjs --mo-hinh <tên> --lam-lai`) |
| `TIM_KIEM_DB`    | `TIM-KIEM/du-lieu/tim-kiem.sqlite`                                               |
| `PORT`, `HOST`   | `8686`, `127.0.0.1` (giao diện chỉ mở trên máy mình)                             |

## Chưa làm

Chưa có việc gán nhãn chủ đề thần học bằng AI (bước 3 của kế hoạch). Khi làm, nhãn do AI đề xuất phải nằm riêng và có ghi rõ nguồn, không lẫn với dữ kiện lấy từ bản văn.

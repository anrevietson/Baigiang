# LỆNH: soạn gợi ý bài giảng (AI-DAN-Y)

Người dùng chỉ cần nói: **"AI hãy soạn gợi ý trong AI-DAN-Y"**. Áp dụng như nhau cho Copilot, Codex, Claude Code.
Trang này là đủ để làm. **Không đọc lại các mã đã xong**, không đọc cả `DA-LAM.md`, không đọc mọi `OUTPUT/`. Chỉ đọc đúng những file ghi dưới đây.

## 0. Đọc gì (một lần mỗi phiên, theo thứ tự)
1. Trang này.
2. `AI-DAN-Y/HUONG-DAN/quy-tac-bien-soan.md` (35 dòng) và `AI-DAN-Y/SCHEMA/goi-y.md` (55 dòng).
3. **Một** mẫu chuẩn, đúng loại ngày của mã sắp làm (chỉ để xem độ sâu và văn phong):
   - ngày thường 2 năm I/II → `AI-DAN-Y/OUTPUT/5321-I-II/goi-y.json` (có gợi ý riêng năm I, năm II)
   - Chúa nhật / lễ trọng có Phụ lục I → `AI-DAN-Y/OUTPUT/1010-C/goi-y.json`
   - lễ thánh → `AI-DAN-Y/OUTPUT/82612/goi-y.json`

## 1. Biết làm mã nào (không cần dò)
```bash
node AI-DAN-Y/CONG-CU/tiep-theo.mjs                                   # mã làm dở → làm trước; rồi mã chưa làm, gần hôm nay nhất
node AI-DAN-Y/CONG-CU/tiep-theo.mjs --nhan <tm> --ai "<Copilot|Codex|Claude>"   # giữ chỗ 6 giờ
node AI-DAN-Y/CONG-CU/tiep-theo.mjs --xem <tm>                        # chỗ dừng + lệnh kế tiếp của mã đó
```
Mã làm dở: `--xem` cho biết gói nào đã ghi trích ý → chỉ đọc các gói còn lại. Mã phiên khác đang giữ: không đụng.
Mỗi phiên làm **1–3 mã cho kỹ**, không chạy đua số lượng.

## 2. Làm một mã — 8 bước, mỗi bước có điểm dừng an toàn
| # | Việc | Xong khi |
|---|---|---|
| 1 | `node AI-DAN-Y/CONG-CU/doi-chieu-loi-chua.mjs <tm>` rồi `node AI-DAN-Y/CONG-CU/chuan-bi.mjs <tm>` | có `LAM-VIEC/<tm>/goi-NN.txt` |
| 2 | Đọc `OUTPUT/<tm>/loi-chua.json` (bài đọc từng năm). Tra `phu_luc_1["<tm>"]` trong `HUONG-DAN/kim-chi-nam-tham-chieu.json` | biết bài đọc + các số GLHTCG |
| 3 | Đọc **hết** từng gói theo thứ tự, theo đoạn (offset/limit) đến dòng cuối. Đọc xong gói nào ghi ngay `## goi-NN` vào `LAM-VIEC/<tm>/trich-y.md` (mẫu ở mục 3) | mỗi `## goi-NN` |
| 4 | Thêm `## Gom hướng`: `1. …`, `2. …` — 1–5 hướng thật sự độc lập. **Mỗi hướng = một gợi ý** | có `## Gom hướng` |
| 5 | Soạn `LAM-VIEC/<tm>/goi-y.nhap.json` (UTF-8, bằng Write/Node) | có bản nháp |
| 6 | `node AI-DAN-Y/CONG-CU/ghi-goi-y.mjs <tm> --thu` → sửa tới **0 lỗi**; mỗi cảnh báo `!` phải sửa, hoặc ghi lý do ngắn dưới `## Gom hướng` | 0 lỗi |
| 7 | `node AI-DAN-Y/CONG-CU/ghi-goi-y.mjs <tm>` rồi `node AI-DAN-Y/CONG-CU/nap-csdl.mjs` | **XONG** |
| 8 | `git add AI-DAN-Y/OUTPUT/<tm>/goi-y.json AI-DAN-Y/DA-LAM.json AI-DAN-Y/DA-LAM.md` → commit "Thêm gợi ý bài giảng <tm>". **Không push. Không đóng gói `baigiang.html` ở đây.** | — |

Sắp hết token giữa chừng: đọc xong gói đang đọc, ghi trích ý gói đó, dừng. Trích ý dở của một gói thì xóa. Không ghi OUTPUT khi chưa xong.

## 3. Mẫu trích ý (`ghi-goi-y.mjs` kiểm tra máy định dạng này)
```markdown
# Trích ý — 5330-A
Bài đọc: Cn 31,10-13.19-20.30-31 · 1 Tx 5,1-6 · Mt 25,14-30. Phụ lục I: 2006-2011, 1038-1041, 1048-1050, 1936-1937, 2331/2334, 1603-1605.

## goi-01
- `5330-A/041.md`: chú giải — dụ ngôn đối ngẫu, trọng tâm ở người tôi tớ bất hảo (L30-L32); "vì chưng" nối với lời khuyên tỉnh thức (L34-L36); "talent" không phải năng khiếu tự nhiên (L52-L58); "tôi sợ" = thiếu tình yêu với chủ (L62).
- `5330-A/060.md`: không dùng — bài lễ Các Thánh Tử đạo Việt Nam, xếp nhầm ngày.
```
- Mỗi bài không trùng: **một dòng**, mở đầu bằng đường dẫn trong dấu \`…\`, ghi **các ý cụ thể kèm số dòng `L..`** (bài ≥ 40 dòng: ít nhất 2 chỗ). Hoặc ghi `không dùng — <lý do>`.
- Cấm ghi chung chung không số dòng ("dùng như hướng phụ", "dùng như đối chiếu", "bài trùng hướng"). Đó là dấu hiệu chưa đọc.
- Bản trùng: gói ghi `(TRÙNG x% với <bản chính>)` → bài trùng bỏ qua, **bản chính vẫn đọc và dùng bình thường**.

## 4. Lỗi đã gặp — đừng lặp lại
| Lỗi | Mã | Đúng là |
|---|---|---|
| Đọc lướt gói 80 KB, 10/27 bài không có số dòng | 5330-A (Copilot) | đọc hết, ghi ý + `L..` |
| Không nhận ra bài lễ khác (Tử đạo VN) nằm trong thư mục | 5330-A/060 | `khong_dung` + lý do |
| Loại cả bản chính 061 vì thấy 051 là trùng | 5330-A | chỉ loại bản trùng |
| Dùng 4/6 chủ đề Phụ lục I, bỏ 2331/2334, 1603-1605 (gắn Bài đọc I) | 5330-A | dùng **hết** các số Phụ lục I |
| Gom 3 hướng rồi nhét vào 3 luận điểm của **1** gợi ý | 5326-I-II | 3 hướng → 3 gợi ý |
| Ngày thường không có gợi ý riêng năm I; dùng Kn (năm I) trong gợi ý chung I/II | 5326-I-II | gợi ý `ap_dung_nam: ["I"]` riêng |
| Tự viết liên hệ năm II (3 Ga) khi kho không có bài nào | 5326-I-II | ghi "Năm II: kho chưa có bài giảng về <bài đọc>" |
| Một dòng nguồn dùng cho 2 luận điểm | 5330-A | mỗi luận điểm dòng nguồn riêng |
| Đóng gói + commit `baigiang.html` (38 MB) sau từng mã | 5326, 5330 | một lần cuối phiên |
| Ghi JSON tiếng Việt qua PowerShell → mất dấu | 1016 cũ | chỉ Write / Node |
| Viết bằng tiếng Anh, câu đệm lặp | 1010-C, 1015 cũ | tiếng Việt có dấu, giải thích rút từ dòng được trích |
| Hướng dẫn cử hành / lời nguyện tín hữu coi là bài giảng | — | `khong_dung` |
| Đoạn của ngày khác nằm trong file | — | `khong_dung` với `dong: [a, b]` |
| Chép Lời Chúa từ trí nhớ | — | chép từ `loi-chua.json` (chữ `Ð` U+00D0) |

## 5. Kết thúc phiên (một lần)
```bash
node AI-DAN-Y/CONG-CU/kiem-thu-goi-y.mjs                      # phải đạt hết
node TIM-KIEM/dong-goi-html.mjs --goi-y --ra baigiang.html     # MỘT lần
node AI-DAN-Y/CONG-CU/kiem-thu-html.mjs baigiang.html          # phải đạt hết
```
Commit `baigiang.html` một lần. Trả mã đã nhận mà chưa làm: `tiep-theo.mjs --tra <tm>`. Báo lại người dùng: mã đã xong, số gợi ý, cảnh báo còn lại và lý do.

## Không được
Sửa Markdown bài giảng · sửa tay `baigiang.html` · đổi `duyet.trang_thai` · push · dùng cờ `--khong-kiem-trich-y` (chỉ cho kiểm thử) · dùng nhãn "bản nháp AI".

# Định dạng bảng đối chiếu (nhập lô từ sổ)

File JSON một lô nhập. Ticket 12 để Claude đọc ảnh sổ rồi xuất đúng định dạng này; màn "Nhập lô từ sổ" cho dán hoặc chọn file này, và sửa từng ô. Ví dụ dưới đây là dữ liệu giả.

```json
{
  "dinhDang": "bang-doi-chieu-so",
  "phienBan": 1,
  "lo": "so-2026-11-a",
  "nhomNgay": [
    {
      "ngayNhan": "2026-11-02",
      "dong": [
        { "ma": "t1-01", "khach": "Mẫu An", "viTri": "tầng 2", "moTa": "1 túi quần áo", "tien": 50000,
          "ngayTra": "2026-11-05", "tienMat": true },
        { "ma": "t1-02", "nhom": "n1", "khach": "Mẫu Bình", "moTa": "2 chăn", "tien": 120000 },
        { "ma": "t1-03", "nhom": "n1", "khach": "Mẫu Bình", "moTa": "1 gối tựa" },
        { "ma": "t1-04", "khach": "Mẫu Cúc", "moTa": "1 túi quần áo", "khongChac": ["tien"] }
      ]
    }
  ]
}
```

## Trường cấp lô

| Trường | Ý nghĩa |
| --- | --- |
| `dinhDang` | Luôn là `"bang-doi-chieu-so"`. |
| `phienBan` | Luôn là `1`. |
| `lo` | Mã lô, bắt buộc. Cùng `lo` và cùng `ma` là cùng một dòng sổ: nhập lại không tạo phiếu trùng. Mỗi trang sổ nên có một `lo` riêng và không đổi giữa các lần nhập. |
| `nhomNgay` | Danh sách `{ "ngayNhan": "YYYY-MM-DD", "dong": [...] }`: ngày nhận ghi ở đầu nhóm dòng trong sổ, các dòng trong nhóm kế thừa. |
| `dong` | Tùy chọn: danh sách dòng phẳng (mỗi dòng tự ghi `ngayNhan`). Dùng được cùng hoặc thay cho `nhomNgay`. |

## Trường của một dòng

| Trường | Kiểu | Ý nghĩa |
| --- | --- | --- |
| `ma` | chữ | Mã dòng, duy nhất trong lô, **ổn định** giữa các lần xuất (ví dụ "trang-ngày-số thứ tự"). Thiếu thì app đánh `d1`, `d2`... theo thứ tự. |
| `nhom` | chữ | Các dòng cùng `nhom` là một phiếu (dấu ngoặc nhọn trong sổ). Khách, ngày nhận, ngày trả, dấu phải giống nhau; chỉ **một** dòng của nhóm ghi `tien` (tổng tiền). Mô tả của các dòng được nối lại. |
| `khach` | chữ | Tên khách như mẹ ghi. |
| `viTri` | chữ | Ghi chú vị trí (tầng 2, B5, bách khoa...). |
| `moTa` | chữ | Mô tả đồ ("1 túi quần áo", "2 chăn"), kể cả chữ phụ thu như "tẩy 50". |
| `tien` | số nguyên | Tổng tiền theo sổ, đồng, dương. Không ghi "50K": đổi thành `50000`. Bỏ trống nếu sổ chưa ghi tiền. |
| `ngayNhan` | `YYYY-MM-DD` | Ngày nhận (thừa hưởng từ tiêu đề nhóm ngày nếu bỏ trống). |
| `ngayTra` | `YYYY-MM-DD` | Ngày trả ghi trên dòng. |
| `tienMat` | `true` | Có dấu ở cột tiền mặt. Không có dấu thì bỏ trường. |
| `chuyenKhoan` | `true` | Có dấu ở cột chuyển khoản. |
| `khongChac` | danh sách | Tên các ô khó đọc hoặc không chắc: `khach`, `viTri`, `moTa`, `tien`, `ngayNhan`, `ngayTra`, `tienMat`, `chuyenKhoan`. |

## Quy tắc quan trọng

- **Không đoán.** Ô khó đọc thì để trống và liệt kê trong `khongChac`. App tô vàng ô đó, bỏ mọi giá trị còn sót trong ô, và dòng đó **dừng hỏi** cho đến khi chủ tiệm điền. Ô có giá trị sai kiểu (ví dụ `"tien": "50K"`) cũng bị tô vàng và để trống.
- Phân loại (do app làm, file không cần ghi loại): không có tiền là phiếu tạm; có tiền, chưa dấu là chờ trả khách; có tiền, ngày trả và đúng một dấu là đã trả; có dấu mà thiếu tiền hoặc ngày trả, hoặc dấu ở cả hai cột, là dừng hỏi.
- Mốc ngày KiotViet (mặc định, đổi được trong `THAM_SO_MAC_DINH`, `src/core/nhap-lo-service.ts`): ngày trả đến 30/10/2026 bỏ qua; nhận đến 29/10 và trả từ 1/11 (hoặc chưa trả) thì chủ tiệm xác nhận ghép với phiếu tạm KiotViet; nhận từ 30/10 tạo phiếu mới.
- File không chứa dữ liệu thật khi đưa vào kho mã: lô thật chỉ nằm trên máy của chủ tiệm.

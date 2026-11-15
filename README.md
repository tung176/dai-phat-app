# Đại Phát: app quản lý tiệm giặt là

Kho này chỉ chứa **mã nguồn**. Không chứa dữ liệu khách, số liệu kinh doanh, địa chỉ Apps Script hay mã bí mật.
Mọi dữ liệu nằm trong Google Sheet riêng của chủ tiệm và trong bộ nhớ trình duyệt của máy đang dùng.

## Chạy thử

```bash
npm install
npm run dev      # chạy app
npm test         # kiểm thử
npm run build    # đóng gói
```

## Nối với Google Sheet

Mã Apps Script nằm ở `apps-script/Code.gs`. Mã bí mật không nằm trong mã nguồn: đặt trong Script properties với tên `MA_BI_MAT`.
App dùng "mã cài đặt" (địa chỉ Web app cộng mã bí mật) dán vào màn Cài đặt, lưu cục bộ trên máy.

## Nhập dữ liệu cũ từ KiotViet

`tools/nhap-kiotviet.mjs` đọc các file Excel xuất từ KiotViet và tạo một file JSON để nhập vào app. File này chứa dữ liệu khách,
phải lưu ngoài kho và không bao giờ commit.

## Triển khai

Đẩy lên nhánh `main` thì GitHub Actions chạy kiểm thử, đóng gói và đưa lên GitHub Pages.

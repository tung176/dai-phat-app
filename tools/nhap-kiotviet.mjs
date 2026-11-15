// Công cụ chạy một lần trên máy chủ tiệm: đọc 4 file Excel xuất từ KiotViet rồi ghi MỘT file JSON "gói nhập lịch sử"
// (kèm báo cáo kiểm tra) để app nhập qua màn "Nhập lịch sử".
//
// Cách chạy (Node 24 trở lên đọc thẳng được TypeScript):
//   node tools/nhap-kiotviet.mjs <thư-mục-chứa-file-Excel> [<file-ra.json>] [--khong-doi-chieu]
// Mặc định file ra nằm ở thư mục "import" cạnh thư mục Excel, NGOÀI kho mã.
//
// Các file cần có (tìm theo phần đầu tên): DanhSachChiTietHoaDon, DanhSachChiTietDatHang, DanhSachKhachHang, DanhSachSanPham.
// File sổ quỹ không đọc: thu chi suy ra từ phiếu.
// Công cụ chỉ in số liệu tổng hợp và mã hóa đơn, không bao giờ in tên hay số điện thoại khách. Chỉ đọc file Excel, không sửa.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import XLSX from 'xlsx'
import { chuyenKiotViet } from '../src/core/kiotviet-chuyen.ts'

/** Số liệu KiotViet đã đối chiếu ngày 15/11/2026 (12 tháng 01/11/2025 đến 14/11/2026). */
export const SO_MONG_KIOTVIET = {
  soPhieuDaTra: 1488,
  soPhieuChuaThanhToan: 29,
  soKhach: 263,
  soDichVu: 42,
  tienMat: 53_875_182,
  chuyenKhoan: 92_090_496,
}

const FILE = {
  hoaDon: 'DanhSachChiTietHoaDon',
  datHang: 'DanhSachChiTietDatHang',
  khach: 'DanhSachKhachHang',
  sanPham: 'DanhSachSanPham',
}

function docMotFile(thuMuc, tienTo) {
  const ten = readdirSync(thuMuc).filter((f) => f.startsWith(tienTo) && f.toLowerCase().endsWith('.xlsx'))
  if (ten.length === 0) throw new Error(`Không thấy file ${tienTo}*.xlsx trong thư mục.`)
  if (ten.length > 1) throw new Error(`Có nhiều file ${tienTo}*.xlsx, giữ lại đúng một file.`)
  const wb = XLSX.read(readFileSync(path.join(thuMuc, ten[0])))
  return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { raw: true, defval: '' })
}

/** Đọc các file Excel trong thư mục thành các bảng cho bộ chuyển đổi. */
export function docThuMuc(thuMuc) {
  return {
    hoaDon: docMotFile(thuMuc, FILE.hoaDon),
    datHang: docMotFile(thuMuc, FILE.datHang),
    khach: docMotFile(thuMuc, FILE.khach),
    sanPham: docMotFile(thuMuc, FILE.sanPham),
  }
}

const so = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.')

/**
 * @param {string[]} argv đối số dòng lệnh (không gồm node và đường dẫn script)
 * @param {{ in?: (s: string) => void }} [dau] nơi in (để thử); mặc định console.log
 * @returns {number} mã thoát: 0 khớp và không lỗi, 1 có lỗi chặn hoặc số lệch, 2 dùng sai
 */
export function chay(argv, dau = {}) {
  const in_ = dau.in ?? ((s) => console.log(s))
  const doiSo = argv.filter((a) => !a.startsWith('--'))
  const khongDoiChieu = argv.includes('--khong-doi-chieu')
  if (doiSo.length < 1) {
    in_('Cách dùng: node tools/nhap-kiotviet.mjs <thư-mục-Excel> [<file-ra.json>] [--khong-doi-chieu]')
    return 2
  }
  const thuMuc = path.resolve(doiSo[0])
  const fileRa = path.resolve(doiSo[1] ?? path.join(path.dirname(thuMuc), 'import', 'goi-nhap-lich-su.json'))

  const goi = chuyenKiotViet(docThuMuc(thuMuc), khongDoiChieu ? {} : { mong: SO_MONG_KIOTVIET })
  mkdirSync(path.dirname(fileRa), { recursive: true })
  writeFileSync(fileRa, JSON.stringify(goi), 'utf8')

  const b = goi.baoCao
  in_('BÁO CÁO KIỂM TRA (chỉ số liệu tổng hợp)')
  in_(`  Phiếu đã trả:           ${so(b.soPhieuDaTra)}`)
  in_(`  Phiếu chưa thanh toán:  ${so(b.soPhieuChuaThanhToan)}`)
  in_(`  Khách:                  ${so(b.soKhach)}`)
  in_(`  Dịch vụ:                ${so(b.soDichVu)}`)
  in_(`  Tiền mặt:               ${so(b.tienMat)}đ`)
  in_(`  Chuyển khoản:           ${so(b.chuyenKhoan)}đ`)
  in_(`  Hóa đơn nhập sai quy trình (không qua đặt hàng): ${so(b.soNhapSaiQuyTrinh)}`)
  in_(`  Phiếu gắn khách lẻ giữ chỗ (không có mã khách):   ${so(b.soKhachLe)}`)
  in_(
    `  Số điện thoại: hợp lệ ${b.soDienThoai.hopLe}, sai độ dài ${b.soDienThoai.saiDoDai}, có chữ ${b.soDienThoai.coChu}, trống ${b.soDienThoai.trong}`,
  )
  let lech = false
  if (b.doiChieu.length > 0) {
    in_('ĐỐI CHIẾU VỚI KIOTVIET')
    for (const m of b.doiChieu) {
      if (!m.khop) lech = true
      in_(`  ${m.khop ? 'KHỚP' : 'LỆCH'}  ${m.ten}: có ${so(m.co)}, mong ${so(m.mong)}`)
    }
  }
  for (const c of b.canhBao) in_(`CẢNH BÁO: ${c}`)
  for (const l of b.loi) in_(`LỖI: ${l}`)
  in_(`Đã ghi gói nhập: ${fileRa}`)
  return b.loi.length > 0 || lech ? 1 : 0
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  try {
    process.exitCode = chay(process.argv.slice(2))
  } catch (e) {
    console.error(`Lỗi: ${e instanceof Error ? e.message : 'không đọc được file'}`)
    process.exitCode = 1
  }
}

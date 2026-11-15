import type { BangKiotViet, DongKiotViet } from './kiotviet-chuyen.ts'

/**
 * Dữ liệu giả có cùng cấu trúc cột với các file Excel KiotViet (tên và số điện thoại đều là giả).
 * Chỉ dùng cho kiểm thử và dữ liệu thử giao diện.
 */

/** Số ngày Excel (kể từ 30/12/1899) của một ngày ISO cộng giờ trong ngày. */
export function soNgayExcel(iso: string, gio = 0.5): number {
  return Date.parse(`${iso}T00:00:00Z`) / 86_400_000 + 25569 + gio
}

export interface DongHang {
  ma: string
  ten: string
  soLuong: number
  donGia: number
}

const tong = (d: DongHang[]) => d.reduce((s, x) => s + Math.round(x.soLuong * x.donGia), 0)

export function dongHoaDon(o: {
  ma: string
  ngay: string
  khach?: string
  tenKhach?: string
  datHang?: string
  tienMat?: number
  chuyenKhoan?: number
  trangThai?: string
  giamGia?: number
  dong: DongHang[]
}): DongKiotViet[] {
  const hang = tong(o.dong)
  const canTra = hang - (o.giamGia ?? 0)
  const daTra = (o.tienMat ?? 0) + (o.chuyenKhoan ?? 0)
  return o.dong.map((d) => ({
    'Mã hóa đơn': o.ma,
    'Thời gian': soNgayExcel(o.ngay, 0.9),
    'Mã đặt hàng': o.datHang ?? '',
    'Mã khách hàng': o.khach ?? '',
    'Tên khách hàng': o.tenKhach ?? '',
    'Tổng tiền hàng': hang,
    'Giảm giá hóa đơn': o.giamGia ?? 0,
    'Khách cần trả': canTra,
    'Khách đã trả': daTra,
    'Tiền mặt': o.tienMat ?? 0,
    'Chuyển khoản': o.chuyenKhoan ?? 0,
    'Trạng thái': o.trangThai ?? 'Hoàn thành',
    'Mã hàng': d.ma,
    'Tên hàng': d.ten,
    'Số lượng': d.soLuong,
    'Đơn giá': d.donGia,
    'Thành tiền': Math.round(d.soLuong * d.donGia),
  }))
}

export function dongDatHang(o: {
  ma: string
  ngay: string
  khach: string
  hoaDon?: string
  trangThai: string
  dong: DongHang[]
}): DongKiotViet[] {
  const hang = tong(o.dong)
  return o.dong.map((d) => ({
    'Mã đặt hàng': o.ma,
    'Mã hóa đơn': o.hoaDon ?? '',
    'Thời gian': soNgayExcel(o.ngay, 0.8),
    'Mã khách hàng': o.khach,
    'Khách cần trả': hang,
    'Khách đã trả': 0,
    'Trạng thái': o.trangThai,
    'Mã hàng': d.ma,
    'Tên hàng': d.ten,
    'Số lượng': d.soLuong,
    'Đơn giá': d.donGia,
    'Thành tiền': Math.round(d.soLuong * d.donGia),
  }))
}

export const QUAN_AO: DongHang = { ma: 'SP000001', ten: 'Giặt & Sấy quần áo thông thường', soLuong: 3.5, donGia: 14000 }
export const CHAN: DongHang = { ma: 'SP000022', ten: 'Giặt Chăn-Màn-Rèm-Ga mỏng', soLuong: 2, donGia: 25000 }
export const GIAY: DongHang = { ma: 'SP000024', ten: 'Vệ sinh giày phổ thông', soLuong: 1, donGia: 40000 }

function sanPham(ma: string, ten: string, nhom: string, gia: number, dvt: string): DongKiotViet {
  return {
    'Loại hàng': 'Dịch vụ',
    'Nhóm hàng(3 Cấp)': nhom,
    'Mã hàng': ma,
    'Tên hàng': ten,
    'Giá bán': gia,
    'Giá vốn': 99999, // KiotViet điền sai cột này, công cụ phải bỏ qua
    ĐVT: dvt,
    'Đang kinh doanh': 1,
  }
}

export const sanPhamGia: DongKiotViet[] = [
  sanPham('SP000001', 'Giặt & Sấy quần áo thông thường', 'Quần áo', 14000, 'kg'),
  sanPham('SP000022', 'Giặt Chăn-Màn-Rèm-Ga mỏng ( dưới 2kg tính thành 2kg)', 'Chăn', 25000, ''),
  sanPham('SP000023', 'Giặt Topper ( Dưới 3 kg tính 100k & chỉ nhận dưới 6 kg )', 'Chăn', 35000, ''),
  sanPham('SP000024', 'Vệ sinh giày phổ thông', 'Giầy - Dép', 40000, ''),
]

const khachGia = (ma: string, ten: string, sdt: string, ngay: string): DongKiotViet => ({
  'Mã khách hàng': ma,
  'Tên khách hàng': ten,
  'Điện thoại': sdt,
  'Ngày tạo': soNgayExcel(ngay),
})

/**
 * Bộ nhỏ có đủ các trường hợp: số điện thoại hợp lệ, hợp lệ sau khi bỏ khoảng trắng, sai độ dài, có chữ, trống;
 * hóa đơn có và không có phiếu đặt hàng, tiền mặt và chuyển khoản, khách lẻ, hóa đơn đã hủy, phiếu tạm.
 * Tiền mặt 98.000 + 140.000 = 238.000đ; chuyển khoản 60.000đ.
 */
export function boKiotVietGia(): BangKiotViet {
  return {
    sanPham: sanPhamGia,
    khach: [
      khachGia('KH000001', 'Khách Giả Một', '0900000001', '2026-09-01'),
      khachGia('KH000002', 'Khách Giả Hai', '090 000 0002', '2026-09-02'),
      khachGia('KH000003', 'Khách Giả Ba', '09000003', '2026-09-03'),
      khachGia('KH000004', 'Khách Giả Bốn', 'gần chợ giả', '2026-09-04'),
      khachGia('KH000005', 'Khách Giả Năm (chưa mua)', '', '2026-09-05'),
    ],
    datHang: [
      ...dongDatHang({ ma: 'DH000001', ngay: '2026-10-01', khach: 'KH000001', hoaDon: 'HD000001', trangThai: 'Hoàn thành', dong: [QUAN_AO, CHAN] }),
      ...dongDatHang({ ma: 'DH000002', ngay: '2026-10-02', khach: 'KH000002', hoaDon: 'HD000002', trangThai: 'Hoàn thành', dong: [GIAY, { ...GIAY, soLuong: 0.5 }] }),
      ...dongDatHang({ ma: 'DH000003', ngay: '2026-10-20', khach: 'KH000003', trangThai: 'Phiếu tạm', dong: [CHAN] }),
    ],
    hoaDon: [
      // 3,5kg x 14.000 + 2 x 25.000 = 99.000; giảm 1.000, khách đưa 98.000
      ...dongHoaDon({ ma: 'HD000001', ngay: '2026-10-04', khach: 'KH000001', datHang: 'DH000001', tienMat: 98000, giamGia: 1000, dong: [QUAN_AO, CHAN] }),
      ...dongHoaDon({ ma: 'HD000002', ngay: '2026-10-05', khach: 'KH000002', datHang: 'DH000002', chuyenKhoan: 60000, dong: [GIAY, { ...GIAY, soLuong: 0.5 }] }),
      // Không qua phiếu đặt hàng, không có mã khách (khách lẻ).
      ...dongHoaDon({ ma: 'HD000003', ngay: '2026-10-06', tenKhach: 'Khách Lẻ Giả', tienMat: 140000, dong: [{ ...QUAN_AO, soLuong: 10 }] }),
      // Đã hủy: không nhập.
      ...dongHoaDon({ ma: 'HD000004', ngay: '2026-10-07', khach: 'KH000001', tienMat: 28000, trangThai: 'Đã hủy', dong: [{ ...QUAN_AO, soLuong: 2 }] }),
    ],
  }
}

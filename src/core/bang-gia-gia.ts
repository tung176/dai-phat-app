import type { DichVu } from './bang-gia.ts'

/** Bảng giá giả cho kiểm thử và dữ liệu mẫu. Bảng giá thật do ticket 07 nhập. */
export const bangGiaGia = {
  quanAoThuong: {
    ma: 'GIAT-SAY-QA',
    ten: 'Giặt sấy quần áo thường',
    kieu: 'kg',
    donGia: 14000,
    toiThieu: { duoiKg: 2, tien: 28000 },
  },
  chanGa: {
    ma: 'CHAN-GA',
    ten: 'Chăn ga',
    kieu: 'kg',
    donGia: 25000,
    toiThieu: { duoiKg: 2, tien: 50000 },
  },
  topper: {
    ma: 'TOPPER',
    ten: 'Topper',
    kieu: 'kg',
    donGia: 35000,
    toiThieu: { duoiKg: 3, tien: 100000 },
    canhBaoTuKg: 6,
  },
  giay: { ma: 'GIAY', ten: 'Giặt giày', kieu: 'so-luong', donGia: 60000 },
} satisfies Record<string, DichVu>

export const danhSachDichVuGia: DichVu[] = Object.values(bangGiaGia)

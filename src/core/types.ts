import type { ChiTietTien } from './tinh-tien.ts'

/** Ngày dạng ISO "YYYY-MM-DD". Hiển thị dd/mm/yyyy là việc của lớp giao diện. */
export type NgayIso = string

export type TrangThai = 'chua-thanh-toan' | 'da-tra'
// Ticket 05 sẽ thêm 'da-huy'.

/** Danh mục mở rộng được: bản đầu chỉ có hai phương thức. */
export type PhuongThuc = 'tien-mat' | 'chuyen-khoan'

export type NhanPhieu = 'Chưa tính tiền' | 'Chờ trả khách' | 'Đã trả'

export interface KhachTrongPhieu {
  ten: string
  soDienThoai?: string
}

/** Bản ghi lưu trữ. Nhãn là giá trị suy ra, không lưu. */
export interface BanGhiPhieu {
  id: string
  khach: KhachTrongPhieu
  ngayNhan: NgayIso
  moTa: string
  ghiChu?: string
  tongTien?: number
  /** Dòng dịch vụ, phụ thu, giảm giá lúc chốt tiền (tùy chọn, ticket 03). */
  chiTietTien?: ChiTietTien
  ngayTra?: NgayIso
  phuongThuc?: PhuongThuc
  trangThai: TrangThai
}

export interface Phieu extends BanGhiPhieu {
  nhan: NhanPhieu
}

export type MaLoi =
  | 'DU_LIEU_KHONG_HOP_LE'
  | 'KHONG_TIM_THAY'
  | 'SAI_TRANG_THAI'

export class LoiNghiepVu extends Error {
  readonly ma: MaLoi
  constructor(ma: MaLoi, thongBao: string) {
    super(thongBao)
    this.name = 'LoiNghiepVu'
    this.ma = ma
  }
}

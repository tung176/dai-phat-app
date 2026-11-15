import type { ChiTietTien } from './tinh-tien.ts'

/** Ngày dạng ISO "YYYY-MM-DD". Hiển thị dd/mm/yyyy là việc của lớp giao diện. */
export type NgayIso = string

export type TrangThai = 'chua-thanh-toan' | 'da-tra' | 'da-huy'

/** Danh mục mở rộng được: bản đầu chỉ có hai phương thức. */
export type PhuongThuc = 'tien-mat' | 'chuyen-khoan'

export type NhanPhieu = 'Chưa tính tiền' | 'Chờ trả khách' | 'Đã trả' | 'Đã hủy'

/** Khung nhìn khách gắn vào phiếu (suy ra từ khách tham chiếu, không lưu trong phiếu). */
export interface KhachTrongPhieu {
  id: string
  /** Tên gốc, tương thích ticket 01. */
  ten: string
  tenHienThi: string
  soDienThoai?: string
}

/** Bản ghi lưu trữ. Nhãn là giá trị suy ra, không lưu. */
export interface BanGhiPhieu {
  id: string
  /** Mã khách (ticket 04). */
  khachId: string
  /** Phiếu nhập lịch sử mà hóa đơn không qua phiếu đặt hàng thì để chuỗi trống (chưa biết ngày nhận). */
  ngayNhan: NgayIso
  moTa: string
  ghiChu?: string
  tongTien?: number
  /** Dòng dịch vụ, phụ thu, giảm giá lúc chốt tiền (tùy chọn, ticket 03). */
  chiTietTien?: ChiTietTien
  ngayTra?: NgayIso
  phuongThuc?: PhuongThuc
  trangThai: TrangThai
  /** Ticket 05: xóa mềm. Phiếu vẫn lưu nhưng ẩn khỏi danh sách và báo cáo. */
  daXoa?: boolean
  /** Ticket 05: phiếu này thay thế phiếu cũ có mã này. */
  thayTheCho?: string
  /** Ticket 05: phiếu này đã được thay bằng phiếu mới có mã này. */
  thayTheBoi?: string
  /** Ticket 09: khóa ổn định của dòng sổ đã sinh ra phiếu này ("lô:mã dòng"), để nhập lại không trùng. */
  khoaNhapLo?: string
  /**
   * Nhãn nguồn của phiếu nhập từ KiotViet (ticket 07): "kiotviet" cho phiếu qua phiếu đặt hàng,
   * "nhap-sai-quy-trinh" cho hóa đơn không qua phiếu đặt hàng. Báo cáo không lọc theo trường này:
   * phiếu đã trả nào cũng tính vào thu.
   */
  nguon?: string
  /** Ticket 07: mã hóa đơn KiotViet (phiếu đã trả), để nhập lại không trùng. */
  maHoaDonCu?: string
  /** Ticket 07: mã đặt hàng KiotViet (phiếu tạm, hoặc phiếu đặt hàng gắn với hóa đơn). */
  maDatHangCu?: string
  /** Ticket 07: ngày trả là giờ nhập KiotViet, không phải ngày khách lấy đồ thật. */
  nguonNgayTra?: 'gio-nhap-kiotviet'
  /** Ticket 07: dòng hàng gốc của KiotViet (lịch sử, không dùng để tính lại tiền). */
  dongCu?: DongCu[]
}

export interface DongCu {
  maHang: string
  soLuong: number
  donGia: number
  thanhTien: number
}

export interface Phieu extends BanGhiPhieu {
  khach: KhachTrongPhieu
  nhan: NhanPhieu
}

export type MaLoi =
  | 'DU_LIEU_KHONG_HOP_LE'
  | 'KHONG_TIM_THAY'
  | 'SAI_TRANG_THAI'
  | 'THIEU_LY_DO'
  | 'CHUC_NANG_TAT'

export class LoiNghiepVu extends Error {
  readonly ma: MaLoi
  constructor(ma: MaLoi, thongBao: string) {
    super(thongBao)
    this.name = 'LoiNghiepVu'
    this.ma = ma
  }
}

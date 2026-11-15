/**
 * Ticket 05: nhật ký thay đổi phiếu, cài đặt và cổng lưu trữ của chúng.
 * Mọi kiểu ở đây là JSON thuần để ticket 02 lưu thẳng vào Google Sheets.
 */
import type { NgayIso } from './types.ts'

/** Giá trị JSON thuần (trước và sau của một trường). */
export type GiaTriJson = string | number | boolean | null | GiaTriJson[] | { [khoa: string]: GiaTriJson }

/** Thời điểm theo giờ địa phương, dạng "YYYY-MM-DDTHH:mm:ss" (có cả giờ). */
export type ThoiDiem = string

export type LoaiThaoTac =
  | 'sua'
  | 'huy'
  | 'xoa-mem'
  | 'lui-ngay'
  | 'thay-the'
  | 'doi-cai-dat'
  | 'doi-nguoi-dung'
  | 'doi-dong-y-nhan-tin'

export type QuyTacBatThuong =
  | 'sua-tien-hoac-phuong-thuc-da-tra'
  | 'huy-hoac-xoa-da-tra-tien-mat'
  | 'lui-ngay-qua-nguong'
  | 'thang-da-khoa'
  | 'qua-nhieu-thay-doi-trong-ngay'
  | 'giam-tong-tien-qua-nguong'

export type MucDo = 'cao' | 'trung-binh'

export interface BatThuong {
  quyTac: QuyTacBatThuong
  mucDo: MucDo
  moTa: string
}

/** Người thực hiện. xacThuc luôn là false ở giai đoạn này: chỉ là lựa chọn trong cài đặt, chưa đăng nhập. */
export interface NguoiThucHien {
  id: string
  ten: string
  xacThuc: false
}

export interface DongThayDoi {
  truong: string
  truoc: GiaTriJson
  sau: GiaTriJson
}

/** Một dòng nhật ký. Chỉ thêm, không sửa, không xóa. */
export interface NhatKyPhieu {
  id: string
  luc: ThoiDiem
  ngay: NgayIso
  nguoi: NguoiThucHien
  loai: LoaiThaoTac
  /** Phiếu bị tác động; null với thao tác không thuộc phiếu nào (đổi cài đặt, đổi người dùng). */
  phieuId: string | null
  /** Phiếu liên quan (ví dụ phiếu thay thế mới tạo). */
  phieuLienKetId?: string
  thayDoi: DongThayDoi[]
  lyDo: string
  batThuong: BatThuong[]
}

/** Đánh dấu "đã xem" nằm riêng để nhật ký không bao giờ bị sửa. */
export interface DaXem {
  nhatKyId: string
  nguoi: NguoiThucHien
  luc: ThoiDiem
}

export interface NguoiDungCaiDat {
  id: string
  ten: string
}

export interface CongTacChucNang {
  suaTaiCho: boolean
  huy: boolean
  xoaMem: boolean
  luiNgay: boolean
  thayThe: boolean
}

export interface NguongBatThuong {
  /** Lùi ngày quá số ngày này so với ngày thao tác thì bất thường (đúng ngưỡng chưa). */
  luiNgayQuaNgay: number
  /** Hơn số thay đổi này trong một ngày của một người thì bất thường (thay đổi thứ N+1 trở đi). */
  thayDoiMoiNgay: number
  /** Giảm tổng tiền quá số phần trăm này thì bất thường (đúng ngưỡng chưa). */
  giamTienPhanTram: number
}

export interface CaiDatPhieu {
  nguoiHienTai: string
  danhSachNguoi: NguoiDungCaiDat[]
  congTac: CongTacChucNang
  nguong: NguongBatThuong
  /** Khóa tháng là tùy chọn, mặc định tắt. cacThang dạng "YYYY-MM". */
  khoaThang: { bat: boolean; cacThang: string[] }
}

export const CAI_DAT_MAC_DINH: CaiDatPhieu = {
  nguoiHienTai: 'chu',
  danhSachNguoi: [
    { id: 'chu', ten: 'Chủ' },
    { id: 'me', ten: 'Mẹ' },
    { id: 'nhan-vien', ten: 'Nhân viên' },
  ],
  congTac: { suaTaiCho: true, huy: true, xoaMem: true, luiNgay: true, thayThe: true },
  nguong: { luiNgayQuaNgay: 7, thayDoiMoiNgay: 5, giamTienPhanTram: 30 },
  khoaThang: { bat: false, cacThang: [] },
}

/** Cổng lưu nhật ký: chỉ thêm và đọc. Cố ý không có sửa hoặc xóa. */
export interface KhoNhatKyPhieu {
  them(nhatKy: Omit<NhatKyPhieu, 'id'>): Promise<NhatKyPhieu>
  tatCa(): Promise<NhatKyPhieu[]>
  themDaXem(daXem: DaXem): Promise<void>
  tatCaDaXem(): Promise<DaXem[]>
}

/** Cổng lưu cài đặt (một bản duy nhất). Chưa có thì dùng mặc định. */
export interface KhoCaiDatPhieu {
  doc(): Promise<CaiDatPhieu | undefined>
  ghi(caiDat: CaiDatPhieu): Promise<void>
}

export function taoKhoNhatKyTrongBoNho(): KhoNhatKyPhieu {
  const ds: NhatKyPhieu[] = []
  const daXem: DaXem[] = []
  const sao = <T>(x: T): T => structuredClone(x)
  return {
    async them(n) {
      const moi: NhatKyPhieu = { ...sao(n), id: `N${String(ds.length + 1).padStart(5, '0')}` }
      ds.push(moi)
      return sao(moi)
    },
    async tatCa() {
      return sao(ds)
    },
    async themDaXem(x) {
      daXem.push(sao(x))
    },
    async tatCaDaXem() {
      return sao(daXem)
    },
  }
}

export function taoKhoCaiDatTrongBoNho(): KhoCaiDatPhieu {
  let hienTai: CaiDatPhieu | undefined
  return {
    async doc() {
      return hienTai ? structuredClone(hienTai) : undefined
    },
    async ghi(c) {
      hienTai = structuredClone(c)
    },
  }
}

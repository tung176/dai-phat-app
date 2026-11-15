import { chuanHoaSoDienThoai } from './khach.ts'
import { LoiNghiepVu, type NgayIso, type PhuongThuc } from './types.ts'

/**
 * "Gói nhập lịch sử": một file JSON do công cụ `tools/nhap-kiotviet.mjs` tạo từ các file Excel KiotViet,
 * để ngoài kho mã (chứa tên và số điện thoại khách thật). App chỉ đọc gói này, không đọc Excel.
 */
export const DINH_DANG_GOI = 'giatla-nhap-lich-su'
export const PHIEN_BAN_GOI = 1

export type KieuDichVu = 'kg' | 'so-luong'

export interface GoiDichVu {
  /** Mã hàng KiotViet, ví dụ "SP000001". */
  maCu: string
  ten: string
  nhom?: string
  kieu: KieuDichVu
  donGia: number
  toiThieu?: { duoiKg: number; tien: number }
  canhBaoTuKg?: number
  dangDung: boolean
}

export interface GoiKhach {
  /** Mã khách KiotViet, ví dụ "KH000263". */
  maCu: string
  ten: string
  /** Giữ nguyên như KiotViet (đã bỏ khoảng trắng đầu cuối). Số sai vẫn giữ để anh sửa. */
  soDienThoai?: string
  ngayTao: NgayIso
}

export interface GoiDongPhieu {
  maHang: string
  soLuong: number
  donGia: number
  thanhTien: number
}

export interface GoiPhieu {
  loai: 'da-tra' | 'chua-thanh-toan'
  /** Mã hóa đơn KiotViet (phiếu đã trả). */
  maHoaDonCu?: string
  /** Mã đặt hàng KiotViet (phiếu tạm, hoặc phiếu đặt hàng gắn với hóa đơn). */
  maDatHangCu?: string
  /** Trống khi hóa đơn không gắn mã khách (khách lẻ). */
  khachMaCu?: string
  /** Lấy từ phiếu đặt hàng; trống nếu hóa đơn không qua đặt hàng. */
  ngayNhan?: NgayIso
  /** Giờ nhập KiotViet, không phải ngày trả thật. Chỉ có với phiếu đã trả. */
  ngayTra?: NgayIso
  phuongThuc?: PhuongThuc
  tongTien: number
  moTa: string
  ghiChu?: string
  /** Hóa đơn không qua phiếu đặt hàng. */
  nhapSaiQuyTrinh?: boolean
  dong: GoiDongPhieu[]
}

export interface MucDoiChieu {
  ten: string
  co: number
  mong: number
  khop: boolean
}

export interface BaoCaoGoi {
  soPhieuDaTra: number
  soPhieuChuaThanhToan: number
  soKhach: number
  soDichVu: number
  tienMat: number
  chuyenKhoan: number
  soNhapSaiQuyTrinh: number
  soKhachLe: number
  soDienThoai: { hopLe: number; saiDoDai: number; coChu: number; trong: number }
  /** Số đối chiếu với con số mong đợi (nếu người chạy công cụ có truyền). */
  doiChieu: MucDoiChieu[]
  /** Việc đáng chú ý, không chặn nhập. Không chứa tên hay số điện thoại. */
  canhBao: string[]
  /** Lỗi chặn nhập. */
  loi: string[]
}

export interface GoiNhapLichSu {
  dinhDang: typeof DINH_DANG_GOI
  phienBan: typeof PHIEN_BAN_GOI
  nguon: 'kiotviet'
  dichVu: GoiDichVu[]
  khach: GoiKhach[]
  phieu: GoiPhieu[]
  baoCao: BaoCaoGoi
}

export type PhanLoaiSoDienThoai = keyof BaoCaoGoi['soDienThoai']

/** Phân loại số điện thoại theo quy tắc của khách (10 số, bắt đầu 0, sau khi bỏ khoảng trắng, chấm, gạch). */
export function phanLoaiSoDienThoai(tho: string | undefined): PhanLoaiSoDienThoai {
  const so = (tho ?? '').trim()
  if (so === '') return 'trong'
  if (chuanHoaSoDienThoai(so).dungDuoc) return 'hopLe'
  return /\p{L}/u.test(so) ? 'coChu' : 'saiDoDai'
}

function loiGoi(thongBao: string): never {
  throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', `Gói nhập không hợp lệ: ${thongBao}`)
}

const laChuoi = (v: unknown): v is string => typeof v === 'string' && v !== ''
const laTien = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v > 0
const laNgay = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)

/** Đọc văn bản JSON thành gói, kiểm tra cấu trúc. Sai thì ném LoiNghiepVu (không in nội dung gói). */
export function docGoi(vanBan: string): GoiNhapLichSu {
  let o: unknown
  try {
    o = JSON.parse(vanBan)
  } catch {
    loiGoi('không đọc được JSON.')
  }
  const g = o as Partial<GoiNhapLichSu> | null
  if (!g || typeof g !== 'object' || g.dinhDang !== DINH_DANG_GOI) loiGoi('không phải gói nhập lịch sử.')
  if (g.phienBan !== PHIEN_BAN_GOI) loiGoi('phiên bản gói không được hỗ trợ.')
  if (!Array.isArray(g.dichVu) || !Array.isArray(g.khach) || !Array.isArray(g.phieu)) loiGoi('thiếu danh sách.')
  g.dichVu.forEach((d, i) => {
    if (!laChuoi(d?.maCu) || !laChuoi(d.ten) || (d.kieu !== 'kg' && d.kieu !== 'so-luong') || typeof d.donGia !== 'number') {
      loiGoi(`dịch vụ thứ ${i + 1} thiếu thông tin.`)
    }
  })
  g.khach.forEach((k, i) => {
    if (!laChuoi(k?.maCu) || !laChuoi(k.ten) || !laNgay(k.ngayTao)) loiGoi(`khách thứ ${i + 1} thiếu thông tin.`)
  })
  g.phieu.forEach((p, i) => {
    const ok =
      (p?.loai === 'da-tra' || p?.loai === 'chua-thanh-toan') &&
      laTien(p.tongTien) &&
      typeof p.moTa === 'string' &&
      Array.isArray(p.dong) &&
      (p.ngayNhan === undefined || laNgay(p.ngayNhan)) &&
      (p.ngayTra === undefined || laNgay(p.ngayTra))
    if (!ok) loiGoi(`phiếu thứ ${i + 1} thiếu thông tin.`)
  })
  return g as GoiNhapLichSu
}

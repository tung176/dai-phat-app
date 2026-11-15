import type { KhoPhieu } from './kho-phieu.ts'
import {
  LoiNghiepVu,
  type BanGhiPhieu,
  type NgayIso,
  type NhanPhieu,
  type Phieu,
  type PhuongThuc,
} from './types.ts'

export interface DauVaoNhanDo {
  tenKhach: string
  ngayNhan: NgayIso
  moTa: string
  ghiChu?: string
  soDienThoai?: string
}

export interface DauVaoTraKhach {
  ngayTra: NgayIso
  phuongThuc: PhuongThuc
}

export interface DichVuPhieu {
  nhanDo(dauVao: DauVaoNhanDo): Promise<Phieu>
  chotTien(id: string, tongTien: number): Promise<Phieu>
  traKhach(id: string, dauVao: DauVaoTraKhach): Promise<Phieu>
  danhSach(): Promise<Phieu[]>
}

function ngayHopLe(ngay: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ngay)) return false
  const d = new Date(`${ngay}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === ngay
}

const PHUONG_THUC: readonly PhuongThuc[] = ['tien-mat', 'chuyen-khoan']

function nhanCua(b: BanGhiPhieu): NhanPhieu {
  if (b.trangThai === 'da-tra') return 'Đã trả'
  return b.tongTien === undefined ? 'Chưa tính tiền' : 'Chờ trả khách'
}

function xem(b: BanGhiPhieu): Phieu {
  return { ...b, nhan: nhanCua(b) }
}

function batBuoc(dieuKien: boolean, thongBao: string): void {
  if (!dieuKien) throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', thongBao)
}

export function taoDichVuPhieu(phuThuoc: { kho: KhoPhieu }): DichVuPhieu {
  const { kho } = phuThuoc

  async function layHoacBao(id: string): Promise<BanGhiPhieu> {
    const b = await kho.lay(id)
    if (!b) throw new LoiNghiepVu('KHONG_TIM_THAY', 'Không tìm thấy phiếu.')
    return b
  }

  return {
    async nhanDo(dauVao) {
      const ten = dauVao.tenKhach.trim()
      const moTa = dauVao.moTa.trim()
      batBuoc(ten !== '', 'Cần nhập tên khách.')
      batBuoc(moTa !== '', 'Cần nhập mô tả đồ.')
      batBuoc(ngayHopLe(dauVao.ngayNhan), 'Ngày nhận không hợp lệ.')
      const sdt = dauVao.soDienThoai?.trim()
      const ghiChu = dauVao.ghiChu?.trim()
      const banGhi = await kho.them({
        khach: { ten, ...(sdt ? { soDienThoai: sdt } : {}) },
        ngayNhan: dauVao.ngayNhan,
        moTa,
        ...(ghiChu ? { ghiChu } : {}),
        trangThai: 'chua-thanh-toan',
      })
      return xem(banGhi)
    },
    async chotTien(id, tongTien) {
      const b = await layHoacBao(id)
      if (b.trangThai !== 'chua-thanh-toan') {
        throw new LoiNghiepVu('SAI_TRANG_THAI', 'Chỉ chốt tiền được khi phiếu chưa thanh toán.')
      }
      batBuoc(Number.isInteger(tongTien) && tongTien > 0, 'Tổng tiền phải là số đồng nguyên dương.')
      const moi: BanGhiPhieu = { ...b, tongTien }
      await kho.ghi(moi)
      return xem(moi)
    },
    async traKhach(id, dauVao) {
      const b = await layHoacBao(id)
      if (b.trangThai !== 'chua-thanh-toan' || b.tongTien === undefined) {
        throw new LoiNghiepVu('SAI_TRANG_THAI', 'Chỉ trả khách được khi phiếu đã chốt tiền và chưa trả.')
      }
      batBuoc(ngayHopLe(dauVao.ngayTra), 'Ngày trả không hợp lệ.')
      batBuoc(dauVao.ngayTra >= b.ngayNhan, 'Ngày trả không được trước ngày nhận.')
      batBuoc(
        typeof dauVao.phuongThuc === 'string' && PHUONG_THUC.includes(dauVao.phuongThuc),
        'Cần chọn đúng một phương thức: tiền mặt hoặc chuyển khoản.',
      )
      const moi: BanGhiPhieu = {
        ...b,
        trangThai: 'da-tra',
        ngayTra: dauVao.ngayTra,
        phuongThuc: dauVao.phuongThuc,
      }
      await kho.ghi(moi)
      return xem(moi)
    },
    async danhSach() {
      return (await kho.tatCa()).map(xem)
    },
  }
}

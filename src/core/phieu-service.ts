import { taoDichVuKhach, type DichVuKhach } from './khach-service.ts'
import type { Khach } from './khach.ts'
import { taoKhoKhachTrongBoNho } from './kho-khach.ts'
import type { KhoPhieu } from './kho-phieu.ts'
import { tinhChiTiet, type ChiTietTien } from './tinh-tien.ts'
import {
  LoiNghiepVu,
  type BanGhiPhieu,
  type NgayIso,
  type NhanPhieu,
  type Phieu,
  type PhuongThuc,
} from './types.ts'

export interface DauVaoNhanDo {
  /** Nhập tên mới (tạo khách mới) hoặc truyền khachId của khách có sẵn. */
  tenKhach?: string
  khachId?: string
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
  /** tongTien là tổng tiền theo sổ. Có chiTiet thì lưu kèm dòng dịch vụ; chiTiet.chon = 'tinh' lấy số tính được. */
  chotTien(id: string, tongTien: number, chiTiet?: ChiTietTien): Promise<Phieu>
  traKhach(id: string, dauVao: DauVaoTraKhach): Promise<Phieu>
  /** Phiếu chưa xóa mềm. Phiếu hủy vẫn có mặt (nhãn "Đã hủy"); báo cáo và ba danh sách tự bỏ qua. */
  danhSach(): Promise<Phieu[]>
  /** Ticket 05: tra theo mã, kể cả phiếu đã xóa mềm (để xem lịch sử). */
  lay(id: string): Promise<Phieu | undefined>
  /** Ticket 05: toàn bộ kể cả phiếu đã xóa mềm. */
  danhSachDayDu(): Promise<Phieu[]>
}

export function ngayHopLe(ngay: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ngay)) return false
  const d = new Date(`${ngay}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === ngay
}

const PHUONG_THUC: readonly PhuongThuc[] = ['tien-mat', 'chuyen-khoan']

function nhanCua(b: BanGhiPhieu): NhanPhieu {
  if (b.trangThai === 'da-huy') return 'Đã hủy'
  if (b.trangThai === 'da-tra') return 'Đã trả'
  return b.tongTien === undefined ? 'Chưa tính tiền' : 'Chờ trả khách'
}

function xem(b: BanGhiPhieu, khach: Khach): Phieu {
  return {
    ...b,
    khach: {
      id: khach.id,
      ten: khach.tenGoc,
      tenHienThi: khach.tenHienThi,
      ...(khach.soDienThoai ? { soDienThoai: khach.soDienThoai } : {}),
    },
    nhan: nhanCua(b),
  }
}

function batBuoc(dieuKien: boolean, thongBao: string): void {
  if (!dieuKien) throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', thongBao)
}

export function taoDichVuPhieu(phuThuoc: { kho: KhoPhieu; khach?: DichVuKhach }): DichVuPhieu {
  const { kho } = phuThuoc
  const khachDv = phuThuoc.khach ?? taoDichVuKhach({ khoKhach: taoKhoKhachTrongBoNho(), khoPhieu: kho })

  async function xemDayDu(b: BanGhiPhieu): Promise<Phieu> {
    const k = await khachDv.lay(b.khachId)
    if (!k) throw new LoiNghiepVu('KHONG_TIM_THAY', 'Không tìm thấy khách của phiếu.')
    return xem(b, k)
  }

  async function layHoacBao(id: string): Promise<BanGhiPhieu> {
    const b = await kho.lay(id)
    if (!b || b.daXoa) throw new LoiNghiepVu('KHONG_TIM_THAY', 'Không tìm thấy phiếu.')
    return b
  }

  return {
    async nhanDo(dauVao) {
      const ten = dauVao.tenKhach?.trim() ?? ''
      const moTa = dauVao.moTa.trim()
      batBuoc(ten !== '' || dauVao.khachId !== undefined, 'Cần nhập tên khách.')
      batBuoc(moTa !== '', 'Cần nhập mô tả đồ.')
      batBuoc(ngayHopLe(dauVao.ngayNhan), 'Ngày nhận không hợp lệ.')
      if (dauVao.khachId !== undefined) {
        const co = await khachDv.lay(dauVao.khachId)
        if (!co || co.daGopVao !== undefined) {
          throw new LoiNghiepVu('KHONG_TIM_THAY', 'Không tìm thấy khách.')
        }
      }
      const ghiChu = dauVao.ghiChu?.trim()
      const khachId =
        dauVao.khachId ??
        (await khachDv.them({ ten, soDienThoai: dauVao.soDienThoai, nguon: 'tu-phieu' })).id
      const banGhi = await kho.them({
        khachId,
        ngayNhan: dauVao.ngayNhan,
        moTa,
        ...(ghiChu ? { ghiChu } : {}),
        trangThai: 'chua-thanh-toan',
      })
      return xemDayDu(banGhi)
    },
    async chotTien(id, tongTien, chiTiet) {
      const b = await layHoacBao(id)
      if (b.trangThai !== 'chua-thanh-toan') {
        throw new LoiNghiepVu('SAI_TRANG_THAI', 'Chỉ chốt tiền được khi phiếu chưa thanh toán.')
      }
      batBuoc(Number.isInteger(tongTien) && tongTien > 0, 'Tổng tiền phải là số đồng nguyên dương.')
      if (chiTiet) {
        const luu: ChiTietTien = { ...chiTiet, tongTienSo: tongTien }
        const moiCoChiTiet: BanGhiPhieu = { ...b, tongTien: tinhChiTiet(luu).tongChot, chiTietTien: luu }
        await kho.ghi(moiCoChiTiet)
        return xemDayDu(moiCoChiTiet)
      }
      const moi: BanGhiPhieu = { ...b, tongTien }
      await kho.ghi(moi)
      return xemDayDu(moi)
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
      return xemDayDu(moi)
    },
    async danhSach() {
      return Promise.all((await kho.tatCa()).filter((b) => !b.daXoa).map(xemDayDu))
    },
    async lay(id) {
      const b = await kho.lay(id)
      return b ? xemDayDu(b) : undefined
    },
    async danhSachDayDu() {
      return Promise.all((await kho.tatCa()).map(xemDayDu))
    },
  }
}

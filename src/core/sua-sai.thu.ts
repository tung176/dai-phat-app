import { taoDichVuKhach } from './khach-service.ts'
import { taoKhoKhachTrongBoNho } from './kho-khach.ts'
import { taoKhoPhieuTrongBoNho } from './kho-trong-bo-nho.ts'
import { taoKhoCaiDatTrongBoNho, taoKhoNhatKyTrongBoNho } from './nhat-ky-phieu.ts'
import { taoDichVuPhieu } from './phieu-service.ts'
import { taoDichVuSuaSai } from './sua-sai-service.ts'

/** Hệ thống thử cho các test ticket 05: đồng hồ chỉnh được, dữ liệu giả. */
export function lap(batDau = '2026-11-15T09:30:00') {
  let bay = batDau
  const kho = taoKhoPhieuTrongBoNho()
  const khach = taoDichVuKhach({
    khoKhach: taoKhoKhachTrongBoNho(),
    khoPhieu: kho,
    homNay: () => bay.slice(0, 10),
  })
  const phieu = taoDichVuPhieu({ kho, khach })
  const suaSai = taoDichVuSuaSai({
    kho,
    phieu,
    khach,
    khoNhatKy: taoKhoNhatKyTrongBoNho(),
    khoCaiDat: taoKhoCaiDatTrongBoNho(),
    dongHo: () => bay,
  })
  return {
    phieu,
    suaSai,
    datGio(g: string) {
      bay = g
    },
    /** Phiếu đã nhận, chốt tiền, và (tùy chọn) đã trả. */
    async taoPhieu(
      o: { ngayNhan?: string; tien?: number; tra?: { ngayTra: string; pt: 'tien-mat' | 'chuyen-khoan' } } = {},
    ) {
      let p = await phieu.nhanDo({
        tenKhach: 'Khách Mẫu A',
        ngayNhan: o.ngayNhan ?? '2026-11-10',
        moTa: '1 túi quần áo',
      })
      if (o.tien !== undefined) p = await phieu.chotTien(p.id, o.tien)
      if (o.tra) p = await phieu.traKhach(p.id, { ngayTra: o.tra.ngayTra, phuongThuc: o.tra.pt })
      return p
    },
  }
}

export type HeThuThu = ReturnType<typeof lap>

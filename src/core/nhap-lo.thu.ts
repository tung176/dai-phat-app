import { taoDichVuKhach } from './khach-service.ts'
import { taoKhoKhachTrongBoNho } from './kho-khach.ts'
import { taoKhoPhieuTrongBoNho } from './kho-trong-bo-nho.ts'
import { taoKhoCaiDatTrongBoNho, taoKhoNhatKyTrongBoNho } from './nhat-ky-phieu.ts'
import { taoDichVuNhapLo, type ThamSoNhapLo } from './nhap-lo-service.ts'
import type { BangDoiChieu, DongSo } from './nhap-lo.ts'
import { taoDichVuPhieu } from './phieu-service.ts'
import { taoDichVuSuaSai } from './sua-sai-service.ts'

/** Hệ thống thử cho ticket 09: kho trong bộ nhớ, đồng hồ chỉnh được, dữ liệu giả. */
export function lap(o: { thamSo?: Partial<ThamSoNhapLo> } = {}) {
  const gio = '2026-11-16T09:00:00'
  const kho = taoKhoPhieuTrongBoNho()
  const khoNhatKy = taoKhoNhatKyTrongBoNho()
  const khach = taoDichVuKhach({ khoKhach: taoKhoKhachTrongBoNho(), khoPhieu: kho, homNay: () => gio.slice(0, 10) })
  const phieu = taoDichVuPhieu({ kho, khach })
  const suaSai = taoDichVuSuaSai({ kho, phieu, khach, khoNhatKy, khoCaiDat: taoKhoCaiDatTrongBoNho(), dongHo: () => gio })
  const nhapLo = taoDichVuNhapLo({ kho, phieu, khach, suaSai, khoNhatKy, dongHo: () => gio, thamSo: o.thamSo })
  return { kho, khach, phieu, suaSai, nhapLo, khoNhatKy }
}

/** Bảng thử: mỗi dòng mặc định là khách "Mẫu An", ngày nhận 02/11/2026. */
export function bang(...dong: Array<Partial<DongSo> & { ma: string }>): BangDoiChieu {
  return {
    lo: 'lo-thu',
    dong: dong.map((d) => ({ khach: 'Mẫu An', moTa: '1 túi quần áo', ngayNhan: '2026-11-02', ...d })),
  }
}

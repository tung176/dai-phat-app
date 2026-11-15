import { taoDichVuKhach, type DichVuKhach } from '../core/khach-service.ts'
import { taoKhoKhachTrongBoNho } from '../core/kho-khach.ts'
import { taoDichVuPhieu, type DichVuPhieu } from '../core/phieu-service.ts'
import { bangGiaGia } from '../core/bang-gia-gia.ts'
import { taoKhoPhieuTrongBoNho } from '../core/kho-trong-bo-nho.ts'
import { taoBangDemIndexedDb } from '../core/bang-dem-indexeddb.ts'
import { taoHeKhoSheets } from '../core/kho-sheets.ts'
import type { DongBoSheets } from '../core/dong-bo-sheets.ts'
import type { BanGhiKhach, NhatKyGop } from '../core/khach.ts'
import type { BanGhiPhieu } from '../core/types.ts'
import { taoLuuCauHinh } from '../core/luu-cau-hinh.ts'
import { batDongBoTuDong } from './dong-bo-tu-dong.ts'

export interface HeThongDichVu {
  phieu: DichVuPhieu
  khach: DichVuKhach
}

/**
 * Điểm lắp ráp duy nhất: ticket 02 thay kho trong bộ nhớ bằng bộ chuyển Google Sheets ở đây.
 * Dữ liệu mẫu dưới đây là dữ liệu giả để xem thử giao diện.
 */
export async function taoDichVuMau(): Promise<HeThongDichVu> {
  const kho = taoKhoPhieuTrongBoNho()
  const khach = taoDichVuKhach({ khoKhach: taoKhoKhachTrongBoNho(), khoPhieu: kho })
  const dv = taoDichVuPhieu({ kho, khach })
  await dv.nhanDo({ tenKhach: 'Khách Mẫu A', ngayNhan: '2026-11-01', moTa: '1 túi quần áo', ghiChu: 'tầng 2' })
  const b = await dv.nhanDo({ tenKhach: 'Khách Mẫu B', ngayNhan: '2026-11-02', moTa: '2 chăn' })
  await dv.chotTien(b.id, 100000)
  const c = await dv.nhanDo({ tenKhach: 'Khách Mẫu C', ngayNhan: '2026-11-03', moTa: '3 gối tựa' })
  await dv.chotTien(c.id, 90000)
  await dv.traKhach(c.id, { ngayTra: '2026-11-05', phuongThuc: 'tien-mat' })
  await dv.nhanDo({ tenKhach: 'Lan Mẫu', ngayNhan: '2026-11-04', moTa: '1 áo khoác' })
  await dv.nhanDo({ tenKhach: 'lan mau', ngayNhan: '2026-11-06', moTa: '1 rèm', soDienThoai: '0900 000 111' })
  const d = await dv.nhanDo({ tenKhach: 'Khách Mẫu D', ngayNhan: '2026-11-04', moTa: '1 túi quần áo, 1 chăn ga' })
  await dv.chotTien(d.id, 120000, {
    dong: [
      { dichVu: bangGiaGia.quanAoThuong, kg: 3.5 },
      { dichVu: bangGiaGia.chanGa, kg: 2 },
    ],
    phuThu: [{ soTien: 5000, ghiChu: '+5K' }],
  })
  return { phieu: dv, khach }
}

export interface KetNoiSheets {
  he: HeThongDichVu
  dongBo: DongBoSheets
  luu: ReturnType<typeof taoLuuCauHinh>
}

let ketNoi: KetNoiSheets | undefined

/**
 * Hệ thống thật: lưu trong IndexedDB của trình duyệt và đồng bộ lên Google Sheet khi đã dán mã cài đặt.
 * Chỉ tạo một lần cho cả app (React StrictMode gọi hiệu ứng hai lần).
 */
export function taoDichVuThat(): KetNoiSheets {
  if (!ketNoi) {
    const luu = taoLuuCauHinh(localStorage)
    const kho = taoHeKhoSheets({
      cauHinh: () => luu.doc(),
      bangDem: {
        phieu: taoBangDemIndexedDb<BanGhiPhieu>('giat-la-dem-phieu'),
        khach: taoBangDemIndexedDb<BanGhiKhach>('giat-la-dem-khach'),
        nhatKy: taoBangDemIndexedDb<NhatKyGop>('giat-la-dem-nhat-ky'),
      },
    })
    const khach = taoDichVuKhach({ khoKhach: kho.khach, khoPhieu: kho.phieu })
    const phieu = taoDichVuPhieu({ kho: kho.phieu, khach })
    batDongBoTuDong(kho.dongBo)
    ketNoi = { he: { phieu, khach }, dongBo: kho.dongBo, luu }
  }
  return ketNoi
}

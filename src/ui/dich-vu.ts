import { taoDichVuPhieu, type DichVuPhieu } from '../core/phieu-service.ts'
import { taoKhoPhieuTrongBoNho } from '../core/kho-trong-bo-nho.ts'
import { taoBangDemIndexedDb } from '../core/bang-dem-indexeddb.ts'
import { taoKhoSheets, type KhoSheets } from '../core/kho-sheets.ts'
import { taoLuuCauHinh } from '../core/luu-cau-hinh.ts'
import { batDongBoTuDong } from './dong-bo-tu-dong.ts'

/**
 * Điểm lắp ráp duy nhất: ticket 02 thay kho trong bộ nhớ bằng bộ chuyển Google Sheets ở đây.
 * Dữ liệu mẫu dưới đây là dữ liệu giả để xem thử giao diện.
 */
export async function taoDichVuMau(): Promise<DichVuPhieu> {
  const dv = taoDichVuPhieu({ kho: taoKhoPhieuTrongBoNho() })
  await dv.nhanDo({ tenKhach: 'Khách Mẫu A', ngayNhan: '2026-11-01', moTa: '1 túi quần áo', ghiChu: 'tầng 2' })
  const b = await dv.nhanDo({ tenKhach: 'Khách Mẫu B', ngayNhan: '2026-11-02', moTa: '2 chăn' })
  await dv.chotTien(b.id, 100000)
  const c = await dv.nhanDo({ tenKhach: 'Khách Mẫu C', ngayNhan: '2026-11-03', moTa: '3 gối tựa' })
  await dv.chotTien(c.id, 90000)
  await dv.traKhach(c.id, { ngayTra: '2026-11-05', phuongThuc: 'tien-mat' })
  return dv
}

export interface KetNoiSheets {
  dv: DichVuPhieu
  kho: KhoSheets
  luu: ReturnType<typeof taoLuuCauHinh>
}

let ketNoi: KetNoiSheets | undefined

/**
 * Dịch vụ thật: lưu trong IndexedDB của trình duyệt và đồng bộ lên Google Sheet khi đã dán mã cài đặt.
 * Chỉ tạo một lần cho cả app (React StrictMode gọi hiệu ứng hai lần).
 */
export function taoDichVuThat(): KetNoiSheets {
  if (!ketNoi) {
    const luu = taoLuuCauHinh(localStorage)
    const kho = taoKhoSheets({ bangDem: taoBangDemIndexedDb(), cauHinh: () => luu.doc() })
    batDongBoTuDong(kho)
    ketNoi = { dv: taoDichVuPhieu({ kho }), kho, luu }
  }
  return ketNoi
}

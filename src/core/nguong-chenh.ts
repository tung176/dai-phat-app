import type { NoiLuu } from './luu-cau-hinh.ts'
import { NGUONG_CHENH_MAC_DINH } from './tinh-tien.ts'

const KHOA = 'giatla-nguong-chenh'

/**
 * Ngưỡng chênh lệch (đồng) giữa tiền theo sổ và tiền tính từ kg: vượt ngưỡng thì form chốt tiền bắt chọn số đúng.
 * Lưu cục bộ trên máy này (chỉ là tiện ích, không phải dữ liệu kinh doanh). Mặc định 10.000đ.
 */
export function taoLuuNguongChenh(noi: NoiLuu) {
  let tamThoi: number | undefined
  return {
    doc(): number {
      try {
        const chuoi = noi.getItem(KHOA)
        if (chuoi !== null) {
          const n = Number(chuoi)
          if (Number.isInteger(n) && n >= 0) return n
          return NGUONG_CHENH_MAC_DINH
        }
      } catch {
        // trình duyệt chặn: dùng bản tạm
      }
      return tamThoi ?? NGUONG_CHENH_MAC_DINH
    },
    /** Trả false (và giữ giá trị cũ) nếu không phải số đồng nguyên không âm. */
    dat(n: number): boolean {
      if (!Number.isInteger(n) || n < 0) return false
      tamThoi = n
      try {
        noi.setItem(KHOA, String(n))
      } catch {
        // trình duyệt chặn: dùng bản tạm
      }
      return true
    },
  }
}

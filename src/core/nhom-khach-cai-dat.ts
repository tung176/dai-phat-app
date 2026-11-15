import type { NoiLuu } from './luu-cau-hinh.ts'
import { NGUONG_MAC_DINH, nguongHopLe, type NguongNhom } from './nhom-khach.ts'

const KHOA = 'giatla-nguong-nhom-khach'

/** Ngưỡng nhóm khách lưu cục bộ trên máy này (localStorage). Hỏng hoặc bị chặn thì dùng mặc định / bản tạm. */
export function taoLuuNguongNhom(noi: NoiLuu) {
  let tamThoi: NguongNhom | undefined
  return {
    doc(): NguongNhom {
      try {
        const tho = noi.getItem(KHOA)
        if (tho) {
          const n = { ...NGUONG_MAC_DINH, ...(JSON.parse(tho) as Partial<NguongNhom>) }
          if (nguongHopLe(n)) return n
        }
      } catch {
        // hỏng hoặc bị chặn: rơi xuống bản tạm / mặc định
      }
      return tamThoi ?? { ...NGUONG_MAC_DINH }
    },
    /** Trả false (và không lưu) nếu ngưỡng sai. */
    dat(n: NguongNhom): boolean {
      if (!nguongHopLe(n)) return false
      tamThoi = { ...n }
      try {
        noi.setItem(KHOA, JSON.stringify(n))
      } catch {
        // bị chặn: giữ bản tạm trong phiên
      }
      return true
    },
    macDinh(): void {
      tamThoi = undefined
      try {
        noi.removeItem(KHOA)
      } catch {
        // bỏ qua
      }
    },
  }
}

export type LuuNguongNhom = ReturnType<typeof taoLuuNguongNhom>

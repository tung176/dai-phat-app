import { docMaCaiDat, type CauHinhSheets } from './ma-cai-dat.ts'

/** Giao diện tối thiểu của localStorage để dễ thay khi thử. */
export interface NoiLuu {
  getItem(k: string): string | null
  setItem(k: string, v: string): void
  removeItem(k: string): void
}

const KHOA = 'giatla-ma-cai-dat'

/**
 * Giữ mã cài đặt cục bộ trên máy này (localStorage). Không bao giờ đưa lên kho mã, không in, không ghi log.
 * Nếu trình duyệt chặn lưu thì vẫn giữ trong bộ nhớ cho phiên hiện tại.
 */
export function taoLuuCauHinh(noi: NoiLuu) {
  let tamThoi: string | null = null
  return {
    doc(): CauHinhSheets | null {
      let ma: string | null = tamThoi
      try {
        ma = noi.getItem(KHOA) ?? ma
      } catch {
        // trình duyệt chặn: dùng bản tạm
      }
      return ma ? docMaCaiDat(ma) : null
    },
    /** Trả false (và không lưu) nếu mã sai hoặc hỏng. */
    datTuMa(ma: string): boolean {
      if (!docMaCaiDat(ma)) return false
      tamThoi = ma.trim()
      try {
        noi.setItem(KHOA, tamThoi)
      } catch {
        // trình duyệt chặn: dùng bản tạm
      }
      return true
    },
    xoa(): void {
      tamThoi = null
      try {
        noi.removeItem(KHOA)
      } catch {
        // bỏ qua
      }
    },
  }
}

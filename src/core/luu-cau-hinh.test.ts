import { describe, expect, it } from 'vitest'
import { taoLuuCauHinh, type NoiLuu } from './luu-cau-hinh.ts'
import { taoMaCaiDat } from './ma-cai-dat.ts'

function noiLuuGia(): NoiLuu & { du: Map<string, string> } {
  const du = new Map<string, string>()
  return {
    du,
    getItem: (k) => du.get(k) ?? null,
    setItem: (k, v) => void du.set(k, v),
    removeItem: (k) => void du.delete(k),
  }
}

const diaChi = 'https://script.google.com/macros/s/GIA-LAP-KHONG-THAT/exec'
const maBiMat = 'bi-mat-gia-lap-0123456789'

describe('lưu mã cài đặt cục bộ', () => {
  it('dán mã đúng thì lưu và đọc lại được; mã sai thì không lưu', () => {
    const luu = taoLuuCauHinh(noiLuuGia())
    expect(luu.doc()).toBeNull()
    expect(luu.datTuMa('linh tinh')).toBe(false)
    expect(luu.doc()).toBeNull()
    expect(luu.datTuMa(taoMaCaiDat({ diaChi, maBiMat }))).toBe(true)
    expect(luu.doc()).toEqual({ diaChi, maBiMat })
    luu.xoa()
    expect(luu.doc()).toBeNull()
  })

  it('nơi lưu bị chặn thì không làm sập app', () => {
    const hong: NoiLuu = {
      getItem: () => {
        throw new Error('chặn')
      },
      setItem: () => {
        throw new Error('chặn')
      },
      removeItem: () => {
        throw new Error('chặn')
      },
    }
    const luu = taoLuuCauHinh(hong)
    expect(luu.doc()).toBeNull()
    expect(luu.datTuMa(taoMaCaiDat({ diaChi, maBiMat }))).toBe(true) // vẫn dùng được trong phiên này
    expect(luu.doc()).toEqual({ diaChi, maBiMat })
  })
})

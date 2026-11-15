import { describe, expect, it } from 'vitest'
import { taoLuuNguongChenh } from './nguong-chenh.ts'
import type { NoiLuu } from './luu-cau-hinh.ts'
import { tinhChiTiet } from './tinh-tien.ts'
import { bangGiaGia } from './bang-gia-gia.ts'

function noiGia(): NoiLuu & { du: Map<string, string> } {
  const du = new Map<string, string>()
  return {
    du,
    getItem: (k) => du.get(k) ?? null,
    setItem: (k, v) => void du.set(k, v),
    removeItem: (k) => void du.delete(k),
  }
}

describe('ngưỡng chênh lệch giữa tiền sổ và tiền tính được', () => {
  it('mặc định 10.000đ, chỉnh được và còn nguyên khi mở lại', () => {
    const noi = noiGia()
    expect(taoLuuNguongChenh(noi).doc()).toBe(10000)
    expect(taoLuuNguongChenh(noi).dat(5000)).toBe(true)
    expect(taoLuuNguongChenh(noi).doc()).toBe(5000)
  })

  it('từ chối số âm, số lẻ, không phải số; giữ giá trị cũ', () => {
    const luu = taoLuuNguongChenh(noiGia())
    luu.dat(7000)
    for (const xau of [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) expect(luu.dat(xau)).toBe(false)
    expect(luu.doc()).toBe(7000)
  })

  it('dữ liệu lưu hỏng thì dùng mặc định; trình duyệt chặn lưu thì vẫn nhớ trong phiên', () => {
    const noi = noiGia()
    noi.du.set('giatla-nguong-chenh', 'abc')
    expect(taoLuuNguongChenh(noi).doc()).toBe(10000)
    const chan: NoiLuu = {
      getItem: () => {
        throw new Error('chặn')
      },
      setItem: () => {
        throw new Error('chặn')
      },
      removeItem: () => {},
    }
    const luu = taoLuuNguongChenh(chan)
    expect(luu.dat(3000)).toBe(true)
    expect(luu.doc()).toBe(3000)
  })

  it('ngưỡng nhỏ hơn thì cùng một mức chênh bị cảnh báo', () => {
    const chiTiet = { dong: [{ dichVu: bangGiaGia.quanAoThuong, kg: 5 }], tongTienSo: 63000 } // tính 70.000, lệch 7.000
    const luu = taoLuuNguongChenh(noiGia())
    expect(tinhChiTiet(chiTiet, { nguongChenh: luu.doc() }).vuotNguong).toBe(false)
    luu.dat(5000)
    expect(tinhChiTiet(chiTiet, { nguongChenh: luu.doc() }).vuotNguong).toBe(true)
  })
})

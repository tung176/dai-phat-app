import { describe, expect, it } from 'vitest'
import { docMaCaiDat, taoMaCaiDat } from './ma-cai-dat.ts'

const diaChi = 'https://script.google.com/macros/s/GIA-LAP-KHONG-THAT/exec'
const maBiMat = 'bi-mat-gia-lap-0123456789'

describe('mã cài đặt', () => {
  it('đóng gói rồi đọc lại đúng địa chỉ và mã bí mật, có tiền tố phiên bản', () => {
    const ma = taoMaCaiDat({ diaChi, maBiMat })
    expect(ma.startsWith('giatla1:')).toBe(true)
    expect(docMaCaiDat(`  ${ma}\n`)).toEqual({ diaChi, maBiMat })
  })

  it('không đọc mã bí mật ra dạng chữ rõ trong chuỗi mã', () => {
    expect(taoMaCaiDat({ diaChi, maBiMat })).not.toContain(maBiMat)
  })

  it.each([
    ['sai tiền tố', 'thuchi1:abc'],
    ['hỏng base64', 'giatla1:@@@'],
    ['rỗng', ''],
    ['địa chỉ không phải Apps Script', taoMaCaiDat({ diaChi: 'https://example.com/exec', maBiMat })],
    ['mã bí mật quá ngắn', taoMaCaiDat({ diaChi, maBiMat: 'ngan' })],
  ])('trả null khi %s', (_ten, ma) => {
    expect(docMaCaiDat(ma)).toBeNull()
  })
})

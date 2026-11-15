import { describe, expect, it } from 'vitest'
import { hienNgay, hienTien, docNgay, homNayIso, nhanNguonPhieu } from './dinh-dang.ts'

describe('định dạng hiển thị', () => {
  it('nhãn nguồn phiếu: nhập sai quy trình nổi rõ, phiếu KiotViet có nhãn nhẹ, phiếu thường không nhãn', () => {
    expect(nhanNguonPhieu('nhap-sai-quy-trinh')).toEqual({ chu: 'Nhập sai quy trình', canhBao: true })
    expect(nhanNguonPhieu('kiotviet')).toEqual({ chu: 'Từ KiotViet', canhBao: false })
    expect(nhanNguonPhieu(undefined)).toBeUndefined()
    expect(nhanNguonPhieu('gi-do-la')).toBeUndefined()
  })
  it('tiền theo đồng, dấu chấm phân nhóm', () => {
    expect(hienTien(50000)).toBe('50.000đ')
    expect(hienTien(1234567)).toBe('1.234.567đ')
    expect(hienTien(undefined)).toBe('')
  })
  it('ngày dd/mm/yyyy', () => {
    expect(hienNgay('2026-11-05')).toBe('05/11/2026')
    expect(hienNgay(undefined)).toBe('')
  })
  it('đọc dd/mm/yyyy về ISO, sai thì trả undefined', () => {
    expect(docNgay('05/11/2026')).toBe('2026-11-05')
    expect(docNgay('5/1/2026')).toBe('2026-01-05')
    expect(docNgay('31/02/2026')).toBeUndefined()
    expect(docNgay('abc')).toBeUndefined()
  })
  it('hôm nay theo giờ máy', () => {
    expect(homNayIso(new Date(2026, 10, 15, 23, 30))).toBe('2026-11-15')
  })
})

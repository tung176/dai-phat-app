import { describe, expect, it } from 'vitest'
import { chuyenKiotViet } from './kiotviet-chuyen.ts'
import { docGoi, phanLoaiSoDienThoai } from './kiotviet-goi.ts'
import { boKiotVietGia } from './kiotviet.thu.ts'

describe('đọc gói nhập lịch sử', () => {
  it('đọc lại đúng gói đã ghi thành JSON', () => {
    const g = chuyenKiotViet(boKiotVietGia())
    expect(docGoi(JSON.stringify(g))).toEqual(g)
  })

  it('từ chối văn bản không phải JSON, gói của app khác, phiên bản lạ, danh sách thiếu hoặc bản ghi thiếu trường', () => {
    const g = chuyenKiotViet(boKiotVietGia())
    const loi = (x: unknown) => () => docGoi(typeof x === 'string' ? x : JSON.stringify(x))
    expect(loi('không phải json')).toThrowError(/Gói nhập không hợp lệ/)
    expect(loi({ dinhDang: 'khac' })).toThrowError(/không phải gói nhập lịch sử/)
    expect(loi({ ...g, phienBan: 99 })).toThrowError(/phiên bản/)
    expect(loi({ ...g, phieu: undefined })).toThrowError(/thiếu danh sách/)
    expect(loi({ ...g, khach: [{ maCu: 'KH1' }] })).toThrowError(/khách thứ 1/)
    expect(loi({ ...g, phieu: [{ ...g.phieu[0], tongTien: -5 }] })).toThrowError(/phiếu thứ 1/)
    expect(loi({ ...g, dichVu: [{ ...g.dichVu[0], kieu: 'la' }] })).toThrowError(/dịch vụ thứ 1/)
  })

  it('thông báo lỗi không lặp lại nội dung gói (tên, số điện thoại)', () => {
    const g = chuyenKiotViet(boKiotVietGia())
    try {
      docGoi(JSON.stringify({ ...g, khach: [{ ten: 'Khách Giả Một', soDienThoai: '0900000001' }] }))
    } catch (e) {
      expect(String(e)).not.toContain('Khách Giả')
      expect(String(e)).not.toContain('0900000001')
    }
  })
})

describe('phân loại số điện thoại', () => {
  it.each([
    ['0900000001', 'hopLe'],
    ['090-000.0002', 'hopLe'],
    ['900000001', 'saiDoDai'],
    ['09000000012', 'saiDoDai'],
    ['gần bách khoa', 'coChu'],
    ['0900 0000 1a', 'coChu'],
    ['', 'trong'],
    [undefined, 'trong'],
  ] as const)('%s là %s', (so, kq) => {
    expect(phanLoaiSoDienThoai(so)).toBe(kq)
  })
})

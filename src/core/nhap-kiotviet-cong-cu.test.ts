/// <reference types="node" />
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import XLSX from 'xlsx'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { chay } from '../../tools/nhap-kiotviet.mjs'
import { chuyenKiotViet } from './kiotviet-chuyen.ts'
import { boKiotVietGia } from './kiotviet.thu.ts'
import { docGoi } from './kiotviet-goi.ts'

// Seam: lệnh `node tools/nhap-kiotviet.mjs` đọc file Excel thật (tạo giả ở đây, cùng cấu trúc cột) và ghi gói JSON ra ngoài kho.
let thu: string
beforeEach(() => {
  thu = mkdtempSync(path.join(tmpdir(), 'giatla-kv-'))
})
afterEach(() => rmSync(thu, { recursive: true, force: true }))

function ghiXlsx(ten: string, dong: Array<Record<string, string | number | undefined>>) {
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(dong), 'Sheet1')
  writeFileSync(path.join(thu, ten), XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }))
}

function taoFileGia() {
  const b = boKiotVietGia()
  ghiXlsx('DanhSachChiTietHoaDon_KV01.xlsx', b.hoaDon)
  ghiXlsx('DanhSachChiTietDatHang_KV01.xlsx', b.datHang)
  ghiXlsx('DanhSachKhachHang_KV01.xlsx', b.khach)
  ghiXlsx('DanhSachSanPham_KV01.xlsx', b.sanPham)
}

describe('công cụ nhap-kiotviet', () => {
  it('đọc 4 file Excel, ghi gói JSON giống bộ chuyển đổi, in số liệu tổng hợp không có tên hay số điện thoại', () => {
    taoFileGia()
    const ra = path.join(thu, 'ra', 'goi.json')
    const dong: string[] = []
    const ma = chay([thu, ra, '--khong-doi-chieu'], { in: (s) => dong.push(s) })
    expect(ma).toBe(0)
    expect(docGoi(readFileSync(ra, 'utf8'))).toEqual(chuyenKiotViet(boKiotVietGia()))
    const in_ = dong.join('\n')
    expect(in_).toContain('Phiếu đã trả:           3')
    expect(in_).toContain('Tiền mặt:               238.000đ')
    expect(in_).not.toContain('Khách Giả')
    expect(in_).not.toContain('0900000001')
  })

  it('đối chiếu với số của KiotViet thật: dữ liệu giả không khớp thì báo LỆCH và mã thoát 1', () => {
    taoFileGia()
    const dong: string[] = []
    const ma = chay([thu, path.join(thu, 'goi.json')], { in: (s) => dong.push(s) })
    expect(ma).toBe(1)
    expect(dong.join('\n')).toContain('LỆCH  soPhieuDaTra: có 3, mong 1.488')
  })

  it('thiếu file hoặc thiếu đối số thì báo lỗi rõ', () => {
    expect(() => chay([thu])).toThrowError(/DanhSachChiTietHoaDon/)
    expect(chay([], { in: () => {} })).toBe(2)
  })
})

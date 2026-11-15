import { describe, expect, it } from 'vitest'
import { SO_COT_PHIEU, sangDong, tuDong } from './dong-phieu.ts'
import type { BanGhiPhieu } from './types.ts'

const goc: BanGhiPhieu = { id: 'P1', khachId: 'K1', ngayNhan: '2026-11-02', moTa: 'x', trangThai: 'chua-thanh-toan' }

describe('khóa nhập lô trong dòng Sheets', () => {
  it('lưu và đọc lại đúng khóa, thêm một cột cuối', () => {
    const d = sangDong({ ...goc, khoaNhapLo: 'lo-thu:a' }, 1)
    expect(d).toHaveLength(SO_COT_PHIEU)
    expect(d.at(-1)).toBe('lo-thu:a')
    expect(tuDong(d)?.khoaNhapLo).toBe('lo-thu:a')
  })

  it('đọc được dòng cũ 14 cột (chưa có khóa) và 11 cột', () => {
    const d = sangDong(goc, 1)
    expect(tuDong(d.slice(0, 14))).toEqual(goc)
    expect(tuDong(d.slice(0, 11))).toEqual(goc)
    expect(tuDong(d)).toEqual(goc)
  })
})

import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { taoBangDemIndexedDb } from './bang-dem-indexeddb.ts'
import { taoBangDemTrongBoNho, type BangDem } from './bang-dem.ts'
import type { BanGhiPhieu } from './types.ts'

const moi = (id: string, ten = 'Khách Mẫu'): BanGhiPhieu => ({
  id,
  khachId: ten,
  ngayNhan: '2026-11-01',
  moTa: 'đồ',
  trangThai: 'chua-thanh-toan',
})

let n = 0
const bien: Array<[string, () => BangDem<BanGhiPhieu>]> = [
  ['trong bộ nhớ', () => taoBangDemTrongBoNho<BanGhiPhieu>()],
  ['IndexedDB', () => taoBangDemIndexedDb<BanGhiPhieu>(`thu-nghiem-${++n}-${crypto.randomUUID()}`)],
]

describe.each(bien)('bản đệm %s', (_ten, tao) => {
  it('ghi rồi đọc lại, bản trả về là bản sao', async () => {
    const d = tao()
    await d.ghi(moi('A'))
    const b = await d.lay('A')
    expect(b).toEqual(moi('A'))
    b!.khachId = 'đã sửa ngoài'
    expect((await d.lay('A'))!.khachId).toBe('Khách Mẫu')
    expect(await d.tatCa()).toHaveLength(1)
    expect(await d.lay('khong-co')).toBeUndefined()
  })

  it('mỗi lần ghi đánh dấu chờ gửi; đánh dấu đã gửi chỉ xóa nếu chưa bị sửa tiếp', async () => {
    const d = tao()
    await d.ghi(moi('A'))
    const [gui] = await d.choGui()
    await d.ghi(moi('A', 'Sửa trong lúc đang gửi'))
    await d.danhDauDaGui([{ id: gui.banGhi.id, phienBan: gui.phienBan }])
    const con = await d.choGui()
    expect(con).toHaveLength(1)
    expect(con[0].banGhi.khachId).toBe('Sửa trong lúc đang gửi')
    await d.danhDauDaGui([{ id: 'A', phienBan: con[0].phienBan }])
    expect(await d.choGui()).toEqual([])
  })

  it('nhận dữ liệu từ máy chủ: thay bản không chờ gửi, giữ bản chờ gửi, bỏ bản đã xóa khỏi Sheet', async () => {
    const d = tao()
    await d.ghi(moi('A', 'cũ'))
    await d.ghi(moi('B', 'đang chờ gửi'))
    await d.ghi(moi('C', 'sẽ bị xóa trên Sheet'))
    const daGui = (await d.choGui())
      .filter((x) => x.banGhi.id !== 'B')
      .map((x) => ({ id: x.banGhi.id, phienBan: x.phienBan }))
    await d.danhDauDaGui(daGui)
    await d.nhanTuMayChu([moi('A', 'mới từ Sheet'), moi('B', 'bản Sheet'), moi('D', 'máy khác tạo')])
    const ten = Object.fromEntries((await d.tatCa()).map((b) => [b.id, b.khachId]))
    expect(ten).toEqual({ A: 'mới từ Sheet', B: 'đang chờ gửi', D: 'máy khác tạo' })
  })

})

describe('bản đệm IndexedDB', () => {
  it('còn nguyên sau khi mở lại cùng tên (như tắt rồi mở app)', async () => {
    const ten = `mo-lai-${crypto.randomUUID()}`
    await taoBangDemIndexedDb<BanGhiPhieu>(ten).ghi(moi('A'))
    const lai = taoBangDemIndexedDb(ten)
    expect(await lai.tatCa()).toHaveLength(1)
    expect(await lai.choGui()).toHaveLength(1)
  })
})

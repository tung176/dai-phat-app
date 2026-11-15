import { describe, expect, it } from 'vitest'
import { taoDichVuBangGia } from './bang-gia-service.ts'
import { taoKhoDichVuTrongBoNho, sangDichVu } from './kho-dich-vu.ts'

function lap() {
  const kho = taoKhoDichVuTrongBoNho()
  return { kho, bg: taoDichVuBangGia({ kho }) }
}

describe('bảng giá chỉnh được', () => {
  it('thêm dịch vụ mới: đang dùng, có mã riêng, hiện trong danh sách và dùng được cho bộ tính tiền', async () => {
    const { bg, kho } = lap()
    const dv = await bg.them({ ten: 'Giặt rèm', kieu: 'kg', donGia: 30000, toiThieu: { duoiKg: 2, tien: 60000 } })
    expect(dv).toMatchObject({ ten: 'Giặt rèm', kieu: 'kg', donGia: 30000, dangDung: true })
    expect(dv.id).toBe(dv.ma)
    expect(dv.id).not.toBe('')
    expect((await bg.danhSach()).map((d) => d.ten)).toEqual(['Giặt rèm'])
    expect(sangDichVu((await kho.lay(dv.id))!).toiThieu).toEqual({ duoiKg: 2, tien: 60000 })
  })

  it('hai dịch vụ cùng tên vẫn có mã khác nhau', async () => {
    const { bg } = lap()
    const a = await bg.them({ ten: 'Giày', kieu: 'so-luong', donGia: 60000 })
    const b = await bg.them({ ten: 'Giày', kieu: 'so-luong', donGia: 70000 })
    expect(a.id).not.toBe(b.id)
  })

  it.each([
    ['thiếu tên', { ten: '  ', kieu: 'kg' as const, donGia: 1000 }],
    ['đơn giá không phải số nguyên dương', { ten: 'A', kieu: 'kg' as const, donGia: 0 }],
    ['đơn giá lẻ', { ten: 'A', kieu: 'kg' as const, donGia: 10.5 }],
    ['mức tối thiểu sai', { ten: 'A', kieu: 'kg' as const, donGia: 1000, toiThieu: { duoiKg: 0, tien: 5000 } }],
    ['mức tối thiểu cho dịch vụ tính theo số lượng', { ten: 'A', kieu: 'so-luong' as const, donGia: 1000, toiThieu: { duoiKg: 2, tien: 5000 } }],
  ])('từ chối khi %s, không ghi gì', async (_t, dauVao) => {
    const { bg } = lap()
    await expect(bg.them(dauVao)).rejects.toMatchObject({ ma: 'DU_LIEU_KHONG_HOP_LE' })
    expect(await bg.danhSach()).toEqual([])
  })

  it('sửa giá, kiểu tính, mức tối thiểu; bỏ mức tối thiểu bằng null; giữ nguyên các trường khác', async () => {
    const { bg } = lap()
    const dv = await bg.them({ ten: 'Chăn', kieu: 'kg', donGia: 25000, toiThieu: { duoiKg: 2, tien: 50000 }, nhom: 'Chăn ga' })
    const a = await bg.capNhat(dv.id, { donGia: 27000 })
    expect(a).toMatchObject({ donGia: 27000, toiThieu: { duoiKg: 2, tien: 50000 }, nhom: 'Chăn ga', ten: 'Chăn' })
    const b = await bg.capNhat(dv.id, { toiThieu: null })
    expect(b.toiThieu).toBeUndefined()
    const c = await bg.capNhat(dv.id, { kieu: 'so-luong' })
    expect(c.kieu).toBe('so-luong')
  })

  it('đổi sang tính theo số lượng thì mức tối thiểu cũ bị bỏ (không còn ý nghĩa)', async () => {
    const { bg } = lap()
    const dv = await bg.them({ ten: 'Chăn', kieu: 'kg', donGia: 25000, toiThieu: { duoiKg: 2, tien: 50000 } })
    expect((await bg.capNhat(dv.id, { kieu: 'so-luong' })).toiThieu).toBeUndefined()
  })

  it('ngừng dùng rồi dùng lại; dịch vụ ngừng dùng vẫn còn trong danh sách đầy đủ', async () => {
    const { bg } = lap()
    const dv = await bg.them({ ten: 'Topper', kieu: 'kg', donGia: 35000 })
    expect((await bg.capNhat(dv.id, { dangDung: false })).dangDung).toBe(false)
    expect(await bg.danhSach()).toHaveLength(1)
    expect((await bg.capNhat(dv.id, { dangDung: true })).dangDung).toBe(true)
  })

  it('sửa dịch vụ không có thì báo không tìm thấy; giá sai thì từ chối và giữ nguyên', async () => {
    const { bg } = lap()
    await expect(bg.capNhat('khong-co', { donGia: 1 })).rejects.toMatchObject({ ma: 'KHONG_TIM_THAY' })
    const dv = await bg.them({ ten: 'A', kieu: 'kg', donGia: 1000 })
    await expect(bg.capNhat(dv.id, { donGia: -5 })).rejects.toMatchObject({ ma: 'DU_LIEU_KHONG_HOP_LE' })
    expect((await bg.danhSach())[0]!.donGia).toBe(1000)
  })

  it('đẩy lại toàn bộ lên tab Dịch vụ: ghi lại mọi dịch vụ một lượt và trả số lượng', async () => {
    const kho = taoKhoDichVuTrongBoNho()
    const lan: number[] = []
    const goc = kho.ghiNhieu
    kho.ghiNhieu = async (bs) => {
      lan.push(bs.length)
      await (goc ?? (async () => undefined))(bs)
    }
    const bg = taoDichVuBangGia({ kho })
    await bg.them({ ten: 'A', kieu: 'kg', donGia: 1000 })
    await bg.them({ ten: 'B', kieu: 'kg', donGia: 2000 })
    expect(await bg.ghiLaiTatCa()).toBe(2)
    expect(lan).toEqual([2])
  })
})

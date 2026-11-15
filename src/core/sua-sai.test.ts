import { describe, expect, it } from 'vitest'
import { lap, type HeThuThu } from './sua-sai.thu.ts'

describe('lý do bắt buộc', () => {
  it.each([['rỗng', ''], ['chỉ khoảng trắng', '   \t']])('hủy phiếu bị từ chối khi lý do %s', async (_t, lyDo) => {
    const h = lap()
    const p = await h.taoPhieu()
    await expect(h.suaSai.huy(p.id, lyDo)).rejects.toMatchObject({ ma: 'THIEU_LY_DO' })
    expect((await h.phieu.lay(p.id))?.trangThai).toBe('chua-thanh-toan')
    expect(await h.suaSai.nhatKy()).toHaveLength(0)
  })
})

describe('hủy phiếu', () => {
  it('đổi nhãn thành "Đã hủy" và ghi nhật ký đủ trường', async () => {
    const h = lap('2026-11-15T09:30:00')
    const p = await h.taoPhieu()
    h.datGio('2026-11-15T14:05:30')

    const sau = await h.suaSai.huy(p.id, '  Nhập nhầm khách  ')

    expect(sau.trangThai).toBe('da-huy')
    expect(sau.nhan).toBe('Đã hủy')
    const [nk] = await h.suaSai.nhatKy()
    expect(nk).toMatchObject({
      luc: '2026-11-15T14:05:30',
      ngay: '2026-11-15',
      loai: 'huy',
      phieuId: p.id,
      lyDo: 'Nhập nhầm khách',
      nguoi: { id: 'chu', ten: 'Chủ', xacThuc: false },
      thayDoi: [{ truong: 'trangThai', truoc: 'chua-thanh-toan', sau: 'da-huy' }],
      batThuong: [],
    })
  })

  it('không chốt tiền hay trả khách được trên phiếu đã hủy', async () => {
    const h = lap()
    const p = await h.taoPhieu()
    await h.suaSai.huy(p.id, 'nhầm')
    await expect(h.phieu.chotTien(p.id, 1000)).rejects.toMatchObject({ ma: 'SAI_TRANG_THAI' })
  })
})

describe('mọi thao tác đều bắt buộc lý do', () => {
  const thaoTac: Array<[string, (h: HeThuThu, id: string, lyDo: string) => Promise<unknown>]> = [
    ['sửa', (h, id, l) => h.suaSai.sua(id, { moTa: 'mô tả mới' }, l)],
    ['hủy', (h, id, l) => h.suaSai.huy(id, l)],
    ['xóa mềm', (h, id, l) => h.suaSai.xoaMem(id, l)],
    ['lùi ngày', (h, id, l) => h.suaSai.luiNgay(id, { ngayNhan: '2026-11-09' }, l)],
    ['thay thế', (h, id, l) => h.suaSai.thayThe(id, { moTa: 'mô tả mới' }, l)],
    ['đổi cài đặt', (h, _id, l) => h.suaSai.capNhatCaiDat({ congTac: { huy: false } }, l)],
  ]
  it.each(thaoTac)('%s bị từ chối khi lý do trống và không để lại dấu vết', async (_ten, chay) => {
    const h = lap()
    const p = await h.taoPhieu()
    await expect(chay(h, p.id, ' ')).rejects.toMatchObject({ ma: 'THIEU_LY_DO' })
    expect(await h.suaSai.nhatKy()).toHaveLength(0)
    expect(await h.phieu.danhSach()).toHaveLength(1)
    expect((await h.phieu.lay(p.id))?.moTa).toBe('1 túi quần áo')
  })
})

describe('sửa tại chỗ', () => {
  it('sửa được ở cả ba trạng thái và nhật ký ghi giá trị trước và sau', async () => {
    const h = lap()
    const chuaTinh = await h.taoPhieu()
    const choTra = await h.taoPhieu({ tien: 80000 })
    const daTra = await h.taoPhieu({ tien: 90000, tra: { ngayTra: '2026-11-12', pt: 'chuyen-khoan' } })

    await h.suaSai.sua(chuaTinh.id, { moTa: '2 túi', ghiChu: 'tầng 3' }, 'gõ sai')
    await h.suaSai.sua(choTra.id, { tongTien: 85000 }, 'tính lại')
    const sua = await h.suaSai.sua(daTra.id, { phuongThuc: 'tien-mat', ngayTra: '2026-11-13' }, 'ghi nhầm')

    expect(sua.phuongThuc).toBe('tien-mat')
    expect(sua.nhan).toBe('Đã trả')
    const nk = await h.suaSai.nhatKy()
    expect(nk.map((n) => n.loai)).toEqual(['sua', 'sua', 'sua'])
    expect(nk[0]?.thayDoi).toEqual([
      { truong: 'moTa', truoc: '1 túi quần áo', sau: '2 túi' },
      { truong: 'ghiChu', truoc: null, sau: 'tầng 3' },
    ])
    expect(nk[1]?.thayDoi).toEqual([{ truong: 'tongTien', truoc: 80000, sau: 85000 }])
    expect(nk[2]?.thayDoi).toEqual([
      { truong: 'ngayTra', truoc: '2026-11-12', sau: '2026-11-13' },
      { truong: 'phuongThuc', truoc: 'chuyen-khoan', sau: 'tien-mat' },
    ])
  })

  it('từ chối khi dữ liệu mới sai hoặc không đổi gì; phiếu giữ nguyên', async () => {
    const h = lap()
    const p = await h.taoPhieu({ tien: 50000 })
    await expect(h.suaSai.sua(p.id, { moTa: '  ' }, 'x')).rejects.toMatchObject({ ma: 'DU_LIEU_KHONG_HOP_LE' })
    await expect(h.suaSai.sua(p.id, { tongTien: -5 }, 'x')).rejects.toMatchObject({ ma: 'DU_LIEU_KHONG_HOP_LE' })
    await expect(h.suaSai.sua(p.id, { phuongThuc: 'tien-mat' }, 'x')).rejects.toMatchObject({ ma: 'SAI_TRANG_THAI' })
    await expect(h.suaSai.sua(p.id, { moTa: p.moTa }, 'x')).rejects.toMatchObject({ ma: 'DU_LIEU_KHONG_HOP_LE' })
    await expect(h.suaSai.sua(p.id, { ngayNhan: '2026-11-01' }, 'x')).rejects.toMatchObject({ ma: 'DU_LIEU_KHONG_HOP_LE' })
    expect(await h.suaSai.nhatKy()).toHaveLength(0)
  })

  it('không sửa được phiếu đã hủy', async () => {
    const h = lap()
    const p = await h.taoPhieu()
    await h.suaSai.huy(p.id, 'nhầm')
    await expect(h.suaSai.sua(p.id, { moTa: 'y' }, 'x')).rejects.toMatchObject({ ma: 'SAI_TRANG_THAI' })
  })
})

describe('xóa mềm', () => {
  it('ẩn khỏi danh sách nhưng vẫn lưu và xem được lịch sử', async () => {
    const h = lap()
    const p = await h.taoPhieu({ tien: 50000 })
    const giu = await h.taoPhieu()

    await h.suaSai.xoaMem(p.id, 'tạo trùng')

    expect((await h.phieu.danhSach()).map((x) => x.id)).toEqual([giu.id])
    expect((await h.phieu.danhSachDayDu()).map((x) => x.id)).toEqual([p.id, giu.id])
    expect((await h.phieu.lay(p.id))?.daXoa).toBe(true)
    const [nk] = await h.suaSai.nhatKyCuaPhieu(p.id)
    expect(nk?.thayDoi).toEqual([{ truong: 'daXoa', truoc: null, sau: true }])
    await expect(h.phieu.chotTien(p.id, 1)).rejects.toMatchObject({ ma: 'KHONG_TIM_THAY' })
    await expect(h.suaSai.sua(p.id, { moTa: 'y' }, 'x')).rejects.toMatchObject({ ma: 'KHONG_TIM_THAY' })
  })
})

describe('phiếu thay thế', () => {
  it('tạo phiếu mới liên kết hai chiều; phiếu cũ thành "Đã hủy"', async () => {
    const h = lap()
    const cu = await h.taoPhieu({ tien: 70000 })

    const { cu: cuSau, moi } = await h.suaSai.thayThe(cu.id, { moTa: '3 túi', ngayNhan: '2026-11-11' }, 'ghi sai số túi')

    expect(cuSau.nhan).toBe('Đã hủy')
    expect(cuSau.thayTheBoi).toBe(moi.id)
    expect(moi.thayTheCho).toBe(cu.id)
    expect(moi).toMatchObject({ moTa: '3 túi', ngayNhan: '2026-11-11', tongTien: 70000, nhan: 'Chờ trả khách' })
    expect(moi.khach.id).toBe(cu.khach.id)
    expect((await h.suaSai.nhatKyCuaPhieu(moi.id))[0]).toMatchObject({
      loai: 'thay-the',
      phieuId: cu.id,
      phieuLienKetId: moi.id,
    })
    await expect(h.suaSai.thayThe(cu.id, {}, 'lần hai')).rejects.toMatchObject({ ma: 'SAI_TRANG_THAI' })
  })
})

describe('lùi ngày', () => {
  it('lùi ngày nhận và ngày trả về trước; ngày không lùi bị từ chối', async () => {
    const h = lap()
    const p = await h.taoPhieu({ ngayNhan: '2026-11-10', tien: 50000, tra: { ngayTra: '2026-11-12', pt: 'tien-mat' } })

    const sau = await h.suaSai.luiNgay(p.id, { ngayNhan: '2026-11-08', ngayTra: '2026-11-11' }, 'nhận hôm trước')

    expect(sau).toMatchObject({ ngayNhan: '2026-11-08', ngayTra: '2026-11-11' })
    expect((await h.suaSai.nhatKy())[0]).toMatchObject({ loai: 'lui-ngay' })
    await expect(h.suaSai.luiNgay(p.id, { ngayNhan: '2026-11-09' }, 'x')).rejects.toMatchObject({ ma: 'DU_LIEU_KHONG_HOP_LE' })
    await expect(h.suaSai.luiNgay(p.id, { ngayTra: '2026-11-07' }, 'x')).rejects.toMatchObject({ ma: 'DU_LIEU_KHONG_HOP_LE' })
  })
})

describe('nhật ký không sửa hay xóa được', () => {
  it('dịch vụ lõi không có thao tác sửa hay xóa nhật ký, và bản trả về chỉ là bản sao', async () => {
    const h = lap()
    const p = await h.taoPhieu()
    await h.suaSai.huy(p.id, 'nhầm')
    expect(Object.keys(h.suaSai).filter((k) => /xoaNhatKy|suaNhatKy|capNhatNhatKy/.test(k))).toEqual([])
    const ban = await h.suaSai.nhatKy()
    ban[0]!.lyDo = 'đã bị sửa'
    ban.length = 0
    expect((await h.suaSai.nhatKy())[0]?.lyDo).toBe('nhầm')
  })
})


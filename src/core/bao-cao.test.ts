import { describe, expect, it } from 'vitest'
import { baDanhSach, doChuaLay, NGUONG_MAC_DINH } from './danh-sach-phieu.ts'
import { tongHopThu } from './bao-cao.ts'
import { lap } from './sua-sai.thu.ts'

describe('báo cáo sau khi sửa, hủy và xóa mềm', () => {
  const trongThang = { tuNgay: '2026-11-01', denNgay: '2026-11-30' }

  it('tính phiếu sửa theo giá trị mới nhất, bỏ phiếu hủy và phiếu xóa mềm', async () => {
    const h = lap()
    const a = await h.taoPhieu({ tien: 100000, tra: { ngayTra: '2026-11-12', pt: 'tien-mat' } })
    const b = await h.taoPhieu({ tien: 50000, tra: { ngayTra: '2026-11-13', pt: 'chuyen-khoan' } })
    const c = await h.taoPhieu({ tien: 30000, tra: { ngayTra: '2026-11-13', pt: 'tien-mat' } })
    const d = await h.taoPhieu({ tien: 20000, tra: { ngayTra: '2026-11-14', pt: 'tien-mat' } })
    expect(tongHopThu(await h.phieu.danhSachDayDu(), trongThang)).toEqual({
      soPhieu: 4,
      tongTien: 200000,
      tienMat: 150000,
      chuyenKhoan: 50000,
    })

    await h.suaSai.sua(a.id, { tongTien: 90000 }, 'tính lại')
    await h.suaSai.sua(b.id, { phuongThuc: 'tien-mat' }, 'nhầm hình thức')
    await h.suaSai.huy(c.id, 'khách không lấy')
    await h.suaSai.xoaMem(d.id, 'nhập trùng')

    // dù đưa cả phiếu xóa mềm vào, báo cáo vẫn bỏ
    expect(tongHopThu(await h.phieu.danhSachDayDu(), trongThang)).toEqual({
      soPhieu: 2,
      tongTien: 140000,
      tienMat: 140000,
      chuyenKhoan: 0,
    })
    // lịch sử vẫn xem được
    expect((await h.suaSai.nhatKyCuaPhieu(a.id))[0]?.thayDoi).toEqual([{ truong: 'tongTien', truoc: 100000, sau: 90000 }])
  })

  it('sửa ngày trả sang tháng khác thì chuyển tháng của báo cáo', async () => {
    const h = lap()
    const a = await h.taoPhieu({ ngayNhan: '2026-10-25', tien: 10000, tra: { ngayTra: '2026-11-02', pt: 'tien-mat' } })
    await h.suaSai.luiNgay(a.id, { ngayTra: '2026-10-31' }, 'trả từ cuối tháng trước')
    expect(tongHopThu(await h.phieu.danhSach(), trongThang).soPhieu).toBe(0)
    expect(tongHopThu(await h.phieu.danhSach(), { tuNgay: '2026-10-01', denNgay: '2026-10-31' }).tongTien).toBe(10000)
  })

  it('phiếu hủy không vào ba danh sách và không là đồ chưa lấy; phiếu thay thế thì có', async () => {
    const h = lap()
    const a = await h.taoPhieu({ tien: 10000 })
    const b = await h.taoPhieu()
    await h.suaSai.huy(b.id, 'đóng phiếu: khách đã lấy từ lâu')
    const { moi } = await h.suaSai.thayThe(a.id, { moTa: 'mô tả đúng' }, 'nhầm mô tả')

    const ds = await h.phieu.danhSach()
    const ba = baDanhSach(ds)
    expect(ba.choTinhTien).toHaveLength(0)
    expect(ba.choTraKhach.map((p) => p.id)).toEqual([moi.id])
    expect(doChuaLay(ds, '2026-11-15', NGUONG_MAC_DINH).map((m) => m.phieu.id)).toEqual([moi.id])
  })
})

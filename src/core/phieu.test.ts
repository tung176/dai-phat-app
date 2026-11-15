import { describe, expect, it } from 'vitest'
import { taoDichVuPhieu } from './phieu-service.ts'
import { taoKhoPhieuTrongBoNho } from './kho-trong-bo-nho.ts'

function taoDichVuThu() {
  return taoDichVuPhieu({ kho: taoKhoPhieuTrongBoNho() })
}

const khachGia = { tenKhach: 'Khách Mẫu A', ngayNhan: '2026-11-01', moTa: '1 túi quần áo' }

describe('nhận đồ', () => {
  it('tạo phiếu chỉ cần tên khách, ngày nhận và mô tả; nhãn là "Chưa tính tiền"', async () => {
    const dv = taoDichVuThu()
    const phieu = await dv.nhanDo(khachGia)
    expect(phieu.trangThai).toBe('chua-thanh-toan')
    expect(phieu.nhan).toBe('Chưa tính tiền')
    expect(phieu.tongTien).toBeUndefined()
    expect(phieu.khach.soDienThoai).toBeUndefined()
    expect(phieu.ngayNhan).toBe('2026-11-01')
  })

  it('lưu ghi chú và số điện thoại tùy chọn', async () => {
    const dv = taoDichVuThu()
    const phieu = await dv.nhanDo({ ...khachGia, ghiChu: 'tầng 2', soDienThoai: '0900000000' })
    expect(phieu.ghiChu).toBe('tầng 2')
    expect(phieu.khach.soDienThoai).toBe('0900000000')
  })

  it.each([
    ['tên khách trống', { ...khachGia, tenKhach: '  ' }],
    ['mô tả trống', { ...khachGia, moTa: '' }],
    ['ngày nhận sai định dạng', { ...khachGia, ngayNhan: '01/11/2026' }],
    ['ngày nhận không tồn tại', { ...khachGia, ngayNhan: '2026-02-30' }],
  ])('từ chối khi %s', async (_ten, dauVao) => {
    const dv = taoDichVuThu()
    await expect(dv.nhanDo(dauVao)).rejects.toMatchObject({ ma: 'DU_LIEU_KHONG_HOP_LE' })
    expect(await dv.danhSach()).toHaveLength(0)
  })
})

describe('chốt tiền', () => {
  it('nhập tổng tiền cho phiếu đã nhận; nhãn đổi thành "Chờ trả khách"', async () => {
    const dv = taoDichVuThu()
    const p = await dv.nhanDo(khachGia)
    const sau = await dv.chotTien(p.id, 50000)
    expect(sau.tongTien).toBe(50000)
    expect(sau.nhan).toBe('Chờ trả khách')
    expect(sau.trangThai).toBe('chua-thanh-toan')
    expect((await dv.danhSach())[0]?.nhan).toBe('Chờ trả khách')
  })

  it.each([0, -1000, 12.5, Number.NaN])('từ chối tổng tiền %s', async (tien) => {
    const dv = taoDichVuThu()
    const p = await dv.nhanDo(khachGia)
    await expect(dv.chotTien(p.id, tien)).rejects.toMatchObject({ ma: 'DU_LIEU_KHONG_HOP_LE' })
    expect((await dv.danhSach())[0]?.nhan).toBe('Chưa tính tiền')
  })

  it('báo lỗi khi phiếu không tồn tại', async () => {
    const dv = taoDichVuThu()
    await expect(dv.chotTien('khong-co', 1000)).rejects.toMatchObject({ ma: 'KHONG_TIM_THAY' })
  })

  it('không chốt lại phiếu đã trả', async () => {
    const dv = taoDichVuThu()
    const p = await dv.nhanDo(khachGia)
    await dv.chotTien(p.id, 50000)
    await dv.traKhach(p.id, { ngayTra: '2026-11-02', phuongThuc: 'tien-mat' })
    await expect(dv.chotTien(p.id, 60000)).rejects.toMatchObject({ ma: 'SAI_TRANG_THAI' })
  })
})

describe('trả khách', () => {
  async function phieuDaChot(dv = taoDichVuThu()) {
    const p = await dv.nhanDo(khachGia)
    await dv.chotTien(p.id, 50000)
    return { dv, id: p.id }
  }

  it('ghi ngày trả và phương thức; phiếu thành "Đã trả"', async () => {
    const { dv, id } = await phieuDaChot()
    const sau = await dv.traKhach(id, { ngayTra: '2026-11-03', phuongThuc: 'chuyen-khoan' })
    expect(sau.trangThai).toBe('da-tra')
    expect(sau.nhan).toBe('Đã trả')
    expect(sau.ngayTra).toBe('2026-11-03')
    expect(sau.phuongThuc).toBe('chuyen-khoan')
    expect(sau.tongTien).toBe(50000)
  })

  it('cho phép trả cùng ngày nhận', async () => {
    const { dv, id } = await phieuDaChot()
    const sau = await dv.traKhach(id, { ngayTra: '2026-11-01', phuongThuc: 'tien-mat' })
    expect(sau.nhan).toBe('Đã trả')
  })

  it('không trả được khi chưa chốt tiền', async () => {
    const dv = taoDichVuThu()
    const p = await dv.nhanDo(khachGia)
    await expect(
      dv.traKhach(p.id, { ngayTra: '2026-11-02', phuongThuc: 'tien-mat' }),
    ).rejects.toMatchObject({ ma: 'SAI_TRANG_THAI' })
    expect((await dv.danhSach())[0]?.nhan).toBe('Chưa tính tiền')
  })

  it('không trả được ngày trả trước ngày nhận', async () => {
    const { dv, id } = await phieuDaChot()
    await expect(
      dv.traKhach(id, { ngayTra: '2026-10-31', phuongThuc: 'tien-mat' }),
    ).rejects.toMatchObject({ ma: 'DU_LIEU_KHONG_HOP_LE' })
    expect((await dv.danhSach())[0]?.nhan).toBe('Chờ trả khách')
  })

  it.each([
    ['ngày trả sai định dạng', { ngayTra: '03/11/2026', phuongThuc: 'tien-mat' }],
    ['thiếu phương thức', { ngayTra: '2026-11-03' }],
    ['phương thức lạ', { ngayTra: '2026-11-03', phuongThuc: 'the' }],
    ['hai phương thức cùng lúc', { ngayTra: '2026-11-03', phuongThuc: ['tien-mat', 'chuyen-khoan'] }],
  ])('từ chối khi %s', async (_ten, dauVao) => {
    const { dv, id } = await phieuDaChot()
    // Cố ý đưa dữ liệu sai kiểu như giao diện hay tệp ngoài có thể gửi vào.
    await expect(dv.traKhach(id, dauVao as never)).rejects.toMatchObject({
      ma: 'DU_LIEU_KHONG_HOP_LE',
    })
  })

  it('không trả khách hai lần', async () => {
    const { dv, id } = await phieuDaChot()
    await dv.traKhach(id, { ngayTra: '2026-11-03', phuongThuc: 'tien-mat' })
    await expect(
      dv.traKhach(id, { ngayTra: '2026-11-04', phuongThuc: 'chuyen-khoan' }),
    ).rejects.toMatchObject({ ma: 'SAI_TRANG_THAI' })
  })
})

describe('không có đường tạo phiếu "đã trả" trực tiếp', () => {
  it('dịch vụ chỉ có các thao tác của quy trình 3 bước (cùng hai hàm chỉ đọc)', () => {
    const dv = taoDichVuThu()
    expect(Object.keys(dv).sort()).toEqual(['chotTien', 'danhSach', 'danhSachDayDu', 'lay', 'nhanDo', 'traKhach'])
  })

  it('nhận đồ bỏ qua trạng thái, tiền, ngày trả, phương thức nếu bị nhét vào', async () => {
    const dv = taoDichVuThu()
    const p = await dv.nhanDo({
      ...khachGia,
      trangThai: 'da-tra',
      tongTien: 50000,
      ngayTra: '2026-11-02',
      phuongThuc: 'tien-mat',
    } as never)
    expect(p.nhan).toBe('Chưa tính tiền')
    expect(p.trangThai).toBe('chua-thanh-toan')
    expect(p.tongTien).toBeUndefined()
    expect(p.ngayTra).toBeUndefined()
    expect(p.phuongThuc).toBeUndefined()
  })
})

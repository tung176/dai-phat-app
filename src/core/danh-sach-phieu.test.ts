import { describe, expect, it } from 'vitest'
import {
  baDanhSach,
  doChuaLay,
  docNguong,
  timPhieu,
  xemDanhSachPhieu,
  NGUONG_MAC_DINH,
  soNgayTon,
} from './danh-sach-phieu.ts'
import { taoDuLieuGia } from './du-lieu-gia.thu.ts'
import type { Phieu } from './types.ts'
import { taoDichVuPhieu } from './phieu-service.ts'
import { taoKhoPhieuTrongBoNho } from './kho-trong-bo-nho.ts'

function taoDichVuThu() {
  return taoDichVuPhieu({ kho: taoKhoPhieuTrongBoNho() })
}

describe('ba danh sách', () => {
  it('chia phiếu theo nhãn: Chờ tính tiền, Chờ trả khách, Đã trả', async () => {
    const dv = taoDichVuThu()
    await dv.nhanDo({ tenKhach: 'A', ngayNhan: '2026-11-01', moTa: 'x' })
    const b = await dv.nhanDo({ tenKhach: 'B', ngayNhan: '2026-11-02', moTa: 'x' })
    await dv.chotTien(b.id, 100000)
    const c = await dv.nhanDo({ tenKhach: 'C', ngayNhan: '2026-11-03', moTa: 'x' })
    await dv.chotTien(c.id, 50000)
    await dv.traKhach(c.id, { ngayTra: '2026-11-04', phuongThuc: 'tien-mat' })

    const ds = baDanhSach(await dv.danhSach())

    expect(ds.choTinhTien.map((p) => p.khach.ten)).toEqual(['A'])
    expect(ds.choTraKhach.map((p) => p.khach.ten)).toEqual(['B'])
    expect(ds.daTra.map((p) => p.khach.ten)).toEqual(['C'])
  })
})

describe('số ngày tồn', () => {
  it('tính theo ngày lịch từ ngày nhận đến hôm nay, kể cả qua tháng và năm', () => {
    expect(soNgayTon('2026-11-15', '2026-11-15')).toBe(0)
    expect(soNgayTon('2026-11-08', '2026-11-15')).toBe(7)
    expect(soNgayTon('2026-10-30', '2026-11-02')).toBe(3)
    expect(soNgayTon('2025-12-30', '2026-01-02')).toBe(3)
  })
})

describe('đồ chưa lấy', () => {
  const HOM_NAY = '2026-11-30'

  async function lap(ngayNhan: string, buoc: 'nhan' | 'chot' | 'tra' = 'nhan') {
    const dv = taoDichVuThu()
    const p = await dv.nhanDo({ tenKhach: 'K', ngayNhan, moTa: 'x' })
    if (buoc !== 'nhan') await dv.chotTien(p.id, 10000)
    if (buoc === 'tra') await dv.traKhach(p.id, { ngayTra: ngayNhan, phuongThuc: 'tien-mat' })
    return doChuaLay(await dv.danhSach(), HOM_NAY, NGUONG_MAC_DINH)
  }

  it('mặc định ngưỡng là 7 ngày chưa tính tiền và 14 ngày chưa trả khách', () => {
    expect(NGUONG_MAC_DINH).toEqual({ chuaTinhTien: 7, chuaTraKhach: 14 })
  })

  it('chưa tính tiền: đúng 7 ngày chưa cảnh báo, 8 ngày thì cảnh báo', async () => {
    expect((await lap('2026-11-23'))[0]).toMatchObject({ soNgay: 7, quaNguong: false })
    expect((await lap('2026-11-22'))[0]).toMatchObject({ soNgay: 8, quaNguong: true })
  })

  it('chờ trả khách: đúng 14 ngày chưa cảnh báo, 15 ngày thì cảnh báo; ngưỡng 7 không áp dụng', async () => {
    expect((await lap('2026-11-16', 'chot'))[0]).toMatchObject({ soNgay: 14, quaNguong: false })
    expect((await lap('2026-11-15', 'chot'))[0]).toMatchObject({ soNgay: 15, quaNguong: true })
    expect((await lap('2026-11-20', 'chot'))[0]).toMatchObject({ soNgay: 10, quaNguong: false })
  })

  it('không liệt kê phiếu đã trả', async () => {
    expect(await lap('2026-10-01', 'tra')).toEqual([])
  })

  it('xếp lâu nhất trước, ngưỡng tùy chỉnh được', async () => {
    const dv = taoDichVuThu()
    await dv.nhanDo({ tenKhach: 'Mới', ngayNhan: '2026-11-28', moTa: 'x' })
    await dv.nhanDo({ tenKhach: 'Cũ', ngayNhan: '2026-11-01', moTa: 'x' })
    const giua = await dv.nhanDo({ tenKhach: 'Giữa', ngayNhan: '2026-11-20', moTa: 'x' })
    await dv.chotTien(giua.id, 1000)

    const kq = doChuaLay(await dv.danhSach(), HOM_NAY, { chuaTinhTien: 1, chuaTraKhach: 10 })

    expect(kq.map((k) => k.phieu.khach.ten)).toEqual(['Cũ', 'Giữa', 'Mới'])
    expect(kq.map((k) => k.quaNguong)).toEqual([true, false, true])
  })
})

describe('tìm phiếu', () => {
  async function lapKho() {
    const dv = taoDichVuThu()
    await dv.nhanDo({ tenKhach: 'Nguyễn Thị Lan', ngayNhan: '2026-11-01', moTa: 'x', ghiChu: 'kệ B5 tầng 2' })
    await dv.nhanDo({ tenKhach: 'Trần Văn Bình', ngayNhan: '2026-11-10', moTa: 'x' })
    await dv.nhanDo({ tenKhach: 'Lê Lan Anh', ngayNhan: '2026-11-20', moTa: 'x', ghiChu: 'móc 7' })
    return dv.danhSach()
  }
  const ten = (ps: { khach: { ten: string } }[]) => ps.map((p) => p.khach.ten)

  it('không điều kiện thì trả hết', async () => {
    expect(await lapKho().then((d) => timPhieu(d, {}))).toHaveLength(3)
  })

  it('tìm theo tên khách, không phân biệt hoa thường và dấu', async () => {
    const ds = await lapKho()
    expect(ten(timPhieu(ds, { tuKhoa: 'lan' }))).toEqual(['Nguyễn Thị Lan', 'Lê Lan Anh'])
    expect(ten(timPhieu(ds, { tuKhoa: 'BINH' }))).toEqual(['Trần Văn Bình'])
    expect(ten(timPhieu(ds, { tuKhoa: 'Nguyễn' }))).toEqual(['Nguyễn Thị Lan'])
  })

  it('tìm theo ghi chú vị trí', async () => {
    const ds = await lapKho()
    expect(ten(timPhieu(ds, { tuKhoa: 'b5' }))).toEqual(['Nguyễn Thị Lan'])
    expect(ten(timPhieu(ds, { tuKhoa: 'móc' }))).toEqual(['Lê Lan Anh'])
  })

  it('lọc khoảng ngày nhận, gồm cả hai đầu; bỏ trống một đầu là không giới hạn đầu đó', async () => {
    const ds = await lapKho()
    expect(ten(timPhieu(ds, { tuNgay: '2026-11-10', denNgay: '2026-11-20' }))).toEqual(['Trần Văn Bình', 'Lê Lan Anh'])
    expect(ten(timPhieu(ds, { tuNgay: '2026-11-11' }))).toEqual(['Lê Lan Anh'])
    expect(ten(timPhieu(ds, { denNgay: '2026-11-09' }))).toEqual(['Nguyễn Thị Lan'])
  })

  it('kết hợp từ khóa và khoảng ngày', async () => {
    const ds = await lapKho()
    expect(ten(timPhieu(ds, { tuKhoa: 'lan', tuNgay: '2026-11-05' }))).toEqual(['Lê Lan Anh'])
  })
})

describe('đọc ngưỡng đã lưu', () => {
  it('đọc được ngưỡng hợp lệ', () => {
    expect(docNguong('{"chuaTinhTien":3,"chuaTraKhach":21}')).toEqual({ chuaTinhTien: 3, chuaTraKhach: 21 })
  })

  it.each([null, '', 'không phải json', '{"chuaTinhTien":-1,"chuaTraKhach":5}', '{"chuaTinhTien":2.5,"chuaTraKhach":5}', '{"chuaTinhTien":3}', '[]'])(
    'dữ liệu hỏng %j thì dùng mặc định',
    (v) => {
      expect(docNguong(v)).toEqual(NGUONG_MAC_DINH)
    },
  )
})

describe('xem danh sách phiếu: lọc, đếm, dựng dần (dữ liệu giả 1.500 phiếu)', () => {
  const dem = (ds: Phieu[], nhan: string) => ds.filter((p) => p.nhan === nhan).length

  it('mặc định "Còn việc" chỉ gồm phiếu chưa tính tiền và chờ trả khách, mới nhất trước', async () => {
    const { phieu } = await taoDuLieuGia()
    const ds = await phieu.danhSach()
    const kq = xemDanhSachPhieu(ds, { loc: 'Còn việc', soDong: 1000 })
    expect(kq.hien.every((p) => p.nhan === 'Chưa tính tiền' || p.nhan === 'Chờ trả khách')).toBe(true)
    expect(kq.tong).toBe(dem(ds, 'Chưa tính tiền') + dem(ds, 'Chờ trả khách'))
    const ngay = kq.hien.map((p) => p.ngayNhan)
    expect(ngay).toEqual([...ngay].sort().reverse())
  })

  it('chỉ dựng tối đa soDong dòng và báo số dòng còn lại; tăng soDong thì dựng thêm', async () => {
    const { phieu } = await taoDuLieuGia()
    const ds = await phieu.danhSach()
    const trang1 = xemDanhSachPhieu(ds, { loc: 'Đã trả', soDong: 50 })
    expect(trang1.hien).toHaveLength(50)
    expect(trang1.conLai).toBe(dem(ds, 'Đã trả') - 50)
    const trang2 = xemDanhSachPhieu(ds, { loc: 'Đã trả', soDong: 100 })
    expect(trang2.hien).toHaveLength(100)
    expect(trang2.hien.slice(0, 50).map((p) => p.id)).toEqual(trang1.hien.map((p) => p.id))
  })

  it('số đếm theo nhãn đúng với toàn bộ dữ liệu, không phụ thuộc nhãn đang lọc hay số dòng dựng', async () => {
    const { phieu } = await taoDuLieuGia()
    const ds = await phieu.danhSach()
    const a = xemDanhSachPhieu(ds, { loc: 'Còn việc', soDong: 50 })
    const b = xemDanhSachPhieu(ds, { loc: 'Đã hủy', soDong: 10 })
    for (const kq of [a, b]) {
      expect(kq.dem['Tất cả']).toBe(ds.length)
      expect(kq.dem['Chưa tính tiền']).toBe(dem(ds, 'Chưa tính tiền'))
      expect(kq.dem['Chờ trả khách']).toBe(dem(ds, 'Chờ trả khách'))
      expect(kq.dem['Đã trả']).toBe(dem(ds, 'Đã trả'))
      expect(kq.dem['Đã hủy']).toBe(dem(ds, 'Đã hủy'))
      expect(kq.dem['Còn việc']).toBe(dem(ds, 'Chưa tính tiền') + dem(ds, 'Chờ trả khách'))
    }
  })

  it('số đếm theo từ khóa và ngày; từ khóa không phân biệt dấu', async () => {
    const { phieu } = await taoDuLieuGia()
    const ds = await phieu.danhSach()
    const kq = xemDanhSachPhieu(ds, { loc: 'Tất cả', soDong: 50, tuKhoa: 'phuong', tuNgay: '2025-06-01', denNgay: '2025-12-31' })
    const doc = ds.filter(
      (p) => (p.khach.ten.startsWith('Phương') || p.khach.ten.startsWith('Phượng')) && p.ngayNhan >= '2025-06-01' && p.ngayNhan <= '2025-12-31',
    )
    expect(kq.tong).toBe(doc.length)
    expect(kq.dem['Tất cả']).toBe(doc.length)
    expect(kq.dem['Đã trả']).toBe(dem(doc, 'Đã trả'))
  })

  it('lọc và tìm trên 1.500 phiếu dưới 200 mili giây mỗi lần gõ', async () => {
    const { phieu } = await taoDuLieuGia()
    const ds = await phieu.danhSach()
    expect(ds.length).toBe(1500)
    xemDanhSachPhieu(ds, { loc: 'Còn việc', soDong: 50 })
    const ms: number[] = []
    for (const tuKhoa of ['m', 'ma', 'mai', 'ph', 'phu', 'phuo', 'phuong', 'hươ', 'lan']) {
      const bat = performance.now()
      xemDanhSachPhieu(ds, { loc: 'Tất cả', soDong: 50, tuKhoa })
      ms.push(performance.now() - bat)
    }
    expect(Math.max(...ms)).toBeLessThan(200)
    console.info(`[đo] lọc 1.500 phiếu theo từ khóa: tối đa ${Math.max(...ms).toFixed(1)} ms`)
  })
})

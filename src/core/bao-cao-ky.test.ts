import { describe, expect, it } from 'vitest'
import { baoCaoKy, khoangCuaNgay, khoangCuaThang, tongHopTheoNgay } from './bao-cao.ts'
import type { Phieu } from './types.ts'
import type { DichVu } from './bang-gia.ts'
import { lap } from './sua-sai.thu.ts'

const GIAT_SAY: DichVu = { ma: 'giat-say', ten: 'Giặt sấy', kieu: 'kg', donGia: 20000 }
const GIAY: DichVu = { ma: 'giay', ten: 'Giặt giày', kieu: 'so-luong', donGia: 50000 }

let dem = 0
function phieuTra(o: {
  ngayTra: string
  tien: number
  pt?: 'tien-mat' | 'chuyen-khoan'
  ngayNhan?: string
  nhan?: Phieu['nhan']
  daXoa?: boolean
  dong?: NonNullable<Phieu['chiTietTien']>['dong']
  nguon?: string
}): Phieu {
  dem += 1
  const nhan = o.nhan ?? 'Đã trả'
  return {
    id: `P${dem}`,
    khachId: 'K1',
    khach: { id: 'K1', ten: 'Khách giả', tenHienThi: 'Khách giả' },
    ngayNhan: o.ngayNhan ?? o.ngayTra,
    moTa: 'đồ giả',
    tongTien: o.tien,
    ...(o.dong ? { chiTietTien: { dong: o.dong } } : {}),
    ngayTra: nhan === 'Đã trả' ? o.ngayTra : undefined,
    phuongThuc: nhan === 'Đã trả' ? (o.pt ?? 'tien-mat') : undefined,
    trangThai: nhan === 'Đã hủy' ? 'da-huy' : nhan === 'Đã trả' ? 'da-tra' : 'chua-thanh-toan',
    nhan,
    ...(o.daXoa ? { daXoa: true } : {}),
    ...(o.nguon ? { nguon: o.nguon } : {}),
  }
}

describe('khoảng kỳ', () => {
  it('tháng 10 và tháng 2 năm nhuận', () => {
    expect(khoangCuaThang('2026-10')).toEqual({ tuNgay: '2026-10-01', denNgay: '2026-10-31' })
    expect(khoangCuaThang('2028-02')).toEqual({ tuNgay: '2028-02-01', denNgay: '2028-02-29' })
    expect(khoangCuaNgay('2026-10-05')).toEqual({ tuNgay: '2026-10-05', denNgay: '2026-10-05' })
  })
})

describe('tổng thu theo ngày', () => {
  it('gom theo ngày trả, tách tiền mặt và chuyển khoản, tăng dần theo ngày', () => {
    const ds = [
      phieuTra({ ngayTra: '2026-10-02', tien: 100000, pt: 'tien-mat' }),
      phieuTra({ ngayTra: '2026-10-01', tien: 40000, pt: 'chuyen-khoan' }),
      phieuTra({ ngayTra: '2026-10-02', tien: 60000, pt: 'chuyen-khoan' }),
    ]
    expect(tongHopTheoNgay(ds, khoangCuaThang('2026-10'))).toEqual([
      { ngay: '2026-10-01', soPhieu: 1, tongTien: 40000, tienMat: 0, chuyenKhoan: 40000 },
      { ngay: '2026-10-02', soPhieu: 2, tongTien: 160000, tienMat: 100000, chuyenKhoan: 60000 },
    ])
  })
})

describe('báo cáo kỳ sát ranh giới tháng', () => {
  const ds = [
    // nhận cuối tháng 9, trả 01/10: tính vào tháng 10
    phieuTra({ ngayNhan: '2026-09-29', ngayTra: '2026-10-01', tien: 30000 }),
    // trả 30/09: tháng 9
    phieuTra({ ngayNhan: '2026-09-28', ngayTra: '2026-09-30', tien: 70000, pt: 'chuyen-khoan' }),
    // nhận tháng 10, trả sang tháng 11
    phieuTra({ ngayNhan: '2026-10-31', ngayTra: '2026-11-01', tien: 50000 }),
    // trả 31/10: tháng 10
    phieuTra({ ngayNhan: '2026-10-30', ngayTra: '2026-10-31', tien: 20000 }),
    // chưa trả, hủy, xóa mềm: không tính
    phieuTra({ ngayTra: '2026-10-15', tien: 11111, nhan: 'Chờ trả khách' }),
    phieuTra({ ngayTra: '2026-10-15', tien: 22222, nhan: 'Đã hủy' }),
    phieuTra({ ngayTra: '2026-10-15', tien: 33333, daXoa: true }),
  ]

  it('tháng 10 chỉ gồm phiếu trả từ 01/10 đến 31/10', () => {
    const b = baoCaoKy(ds, khoangCuaThang('2026-10'))
    expect(b.tong).toEqual({ soPhieu: 2, tongTien: 50000, tienMat: 50000, chuyenKhoan: 0 })
    expect(b.theoNgay.map((n) => n.ngay)).toEqual(['2026-10-01', '2026-10-31'])
  })
  it('tháng 9 và tháng 11 mỗi phiếu rơi đúng một tháng', () => {
    expect(baoCaoKy(ds, khoangCuaThang('2026-09')).tong).toEqual({ soPhieu: 1, tongTien: 70000, tienMat: 0, chuyenKhoan: 70000 })
    expect(baoCaoKy(ds, khoangCuaThang('2026-11')).tong.tongTien).toBe(50000)
  })
  it('một ngày: 30/09 và 01/10', () => {
    expect(baoCaoKy(ds, khoangCuaNgay('2026-09-30')).tong.tongTien).toBe(70000)
    expect(baoCaoKy(ds, khoangCuaNgay('2026-10-01')).tong.tongTien).toBe(30000)
  })
})

describe('quy mô tháng 10/2026: 98 hóa đơn, 9.156.540đ', () => {
  it('cộng đúng 98 phiếu trải đều cả tháng, cả hai phương thức', () => {
    const ds: Phieu[] = []
    let con = 9156540
    for (let i = 0; i < 98; i += 1) {
      const tien = i === 97 ? con : 90000 + (i % 7) * 1000
      con -= tien
      const ngay = `2026-10-${String(1 + (i % 31)).padStart(2, '0')}`
      ds.push(phieuTra({ ngayTra: ngay, tien, pt: i % 3 === 0 ? 'chuyen-khoan' : 'tien-mat' }))
    }
    // nhiễu ngoài tháng, phải bị loại
    ds.push(phieuTra({ ngayTra: '2026-09-30', tien: 999000 }), phieuTra({ ngayTra: '2026-11-01', tien: 888000 }))
    const b = baoCaoKy(ds, khoangCuaThang('2026-10'))
    expect(b.tong.soPhieu).toBe(98)
    expect(b.tong.tongTien).toBe(9156540)
    expect(b.tong.tienMat + b.tong.chuyenKhoan).toBe(9156540)
    expect(b.theoNgay).toHaveLength(31)
    expect(b.theoNgay.reduce((s, n) => s + n.soPhieu, 0)).toBe(98)
  })
})

describe('top dịch vụ', () => {
  const ds = [
    phieuTra({ ngayTra: '2026-10-03', tien: 100000, dong: [{ dichVu: GIAT_SAY, kg: 5 }] }),
    phieuTra({ ngayTra: '2026-10-04', tien: 150000, dong: [{ dichVu: GIAT_SAY, kg: 2 }, { dichVu: GIAY, soLuong: 2 }] }),
    phieuTra({ ngayTra: '2026-10-05', tien: 80000 }), // chỉ có tổng tiền
    phieuTra({ ngayTra: '2026-10-06', tien: 55000, dong: [{ dichVu: GIAY, soLuong: 1 }], nhan: 'Đã hủy' }),
  ]
  it('xếp theo doanh thu dòng dịch vụ, tách phần chỉ có tổng tiền', () => {
    const b = baoCaoKy(ds, khoangCuaThang('2026-10'))
    expect(b.topDichVu).toEqual([
      { ma: 'giat-say', ten: 'Giặt sấy', soPhieu: 2, doanhThu: 140000 },
      { ma: 'giay', ten: 'Giặt giày', soPhieu: 1, doanhThu: 100000 },
    ])
    expect(b.phieuCoDongDichVu).toEqual({ soPhieu: 2, tongTien: 250000 })
    expect(b.phieuChiCoTongTien).toEqual({ soPhieu: 1, tongTien: 80000 })
    expect(b.tong.tongTien).toBe(330000)
  })
})

describe('nhãn nguồn "nhập sai quy trình"', () => {
  it('vẫn tính vào thu', () => {
    const ds = [
      phieuTra({ ngayTra: '2026-10-03', tien: 10000, nguon: 'nhap-sai-quy-trinh' }),
      phieuTra({ ngayTra: '2026-10-03', tien: 5000 }),
    ]
    expect(baoCaoKy(ds, khoangCuaThang('2026-10')).tong.tongTien).toBe(15000)
  })
})

describe('qua dịch vụ thật (sửa, hủy)', () => {
  it('phiếu sửa tính giá mới, phiếu hủy bị bỏ', async () => {
    const h = lap()
    const a = await h.taoPhieu({ ngayNhan: '2026-10-25', tien: 100000, tra: { ngayTra: '2026-10-31', pt: 'tien-mat' } })
    const b = await h.taoPhieu({ ngayNhan: '2026-10-25', tien: 50000, tra: { ngayTra: '2026-11-01', pt: 'chuyen-khoan' } })
    await h.suaSai.sua(a.id, { tongTien: 90000 }, 'tính lại')
    await h.suaSai.huy(b.id, 'khách không lấy')
    const ds = await h.phieu.danhSachDayDu()
    expect(baoCaoKy(ds, khoangCuaThang('2026-10')).tong.tongTien).toBe(90000)
    expect(baoCaoKy(ds, khoangCuaThang('2026-11')).tong.soPhieu).toBe(0)
  })
})

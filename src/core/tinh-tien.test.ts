import { describe, expect, it } from 'vitest'
import { hienKg, tinhChiTiet, tinhKgTuTien, tinhTienTuKg } from './tinh-tien.ts'
import { bangGiaGia } from './bang-gia-gia.ts'

const { quanAoThuong, chanGa, topper, giay } = bangGiaGia

describe('kg ra tiền', () => {
  it('quần áo thường 14.000đ/kg: 3kg là 42.000đ', () => {
    expect(tinhTienTuKg(quanAoThuong, 3).tien).toBe(42000)
  })

  it('quần áo thường dưới 2kg tính 2kg, tức 28.000đ', () => {
    const r = tinhTienTuKg(quanAoThuong, 1.2)
    expect(r.tien).toBe(28000)
    expect(r.apDungToiThieu).toBe(true)
  })

  it('đúng 2kg không bị coi là áp mức tối thiểu', () => {
    const r = tinhTienTuKg(quanAoThuong, 2)
    expect(r.tien).toBe(28000)
    expect(r.apDungToiThieu).toBe(false)
  })

  it('chăn ga 25.000đ/kg: dưới 2kg tính 50.000đ, 3kg là 75.000đ', () => {
    expect(tinhTienTuKg(chanGa, 1.5).tien).toBe(50000)
    expect(tinhTienTuKg(chanGa, 3).tien).toBe(75000)
  })
})

describe('Topper', () => {
  it('dưới 3kg tính 100.000đ; từ 3kg tính 35.000đ/kg', () => {
    expect(tinhTienTuKg(topper, 2.5).tien).toBe(100000)
    expect(tinhTienTuKg(topper, 4).tien).toBe(140000)
  })

  it('chỉ nhận dưới 6kg: 5,9kg không cảnh báo, từ 6kg cảnh báo', () => {
    expect(tinhTienTuKg(topper, 5.9).canhBao).toBeUndefined()
    expect(tinhTienTuKg(topper, 6).canhBao).toMatch(/dưới 6kg/)
    expect(tinhTienTuKg(topper, 7).canhBao).toBeDefined()
  })
})

describe('tiền ra kg', () => {
  it('1 túi quần áo 100.000đ ra 7,14kg nhưng giữ số thật, không làm tròn', () => {
    const r = tinhKgTuTien(quanAoThuong, 100000)
    expect(hienKg(r.kg)).toBe('7,14')
    expect(r.kg).toBeCloseTo(100000 / 14000, 10)
    expect(r.nguonKg).toBe('suy-ra')
  })

  it('28.000đ quần áo ra đúng 2,00kg', () => {
    expect(hienKg(tinhKgTuTien(quanAoThuong, 28000).kg)).toBe('2,00')
  })

  it('không tính ngược tiền từ kg đã làm tròn: 100.000đ vẫn là 100.000đ', () => {
    const { kg } = tinhKgTuTien(quanAoThuong, 100000)
    const kgHienThi = Number(hienKg(kg).replace(',', '.'))
    expect(Math.round(kgHienThi * 14000)).not.toBe(100000) // 7,14 x 14.000 = 99.960
  })

  it('Topper suy ra từ 6kg trở lên cũng cảnh báo', () => {
    expect(tinhKgTuTien(topper, 210000).canhBao).toBeDefined()
    expect(tinhKgTuTien(topper, 140000).canhBao).toBeUndefined()
  })
})

describe('đầu vào sai', () => {
  it.each([0, -1, Number.NaN, Infinity])('từ chối kg %s', (kg) => {
    expect(() => tinhTienTuKg(quanAoThuong, kg)).toThrowError(expect.objectContaining({ ma: 'DU_LIEU_KHONG_HOP_LE' }))
  })
  it.each([0, -5, 1.5])('từ chối tiền %s khi suy ra kg', (t) => {
    expect(() => tinhKgTuTien(quanAoThuong, t)).toThrowError(expect.objectContaining({ ma: 'DU_LIEU_KHONG_HOP_LE' }))
  })
})

describe('chi tiết phiếu: dòng dịch vụ, phụ thu, giảm giá', () => {
  it('dòng chỉ có tiền theo sổ: kg suy ra, cờ "suy-ra", tổng giữ đúng tiền sổ', () => {
    const r = tinhChiTiet({ dong: [{ dichVu: quanAoThuong, tien: 100000 }], tongTienSo: 100000 })
    expect(r.dong[0]?.nguonKg).toBe('suy-ra')
    expect(hienKg(r.dong[0]?.kg ?? 0)).toBe('7,14')
    expect(r.tongChot).toBe(100000)
    expect(r.vuotNguong).toBe(false)
  })

  it('dòng có kg ghi thật: cờ "ghi-that", tiền tính từ kg', () => {
    const r = tinhChiTiet({ dong: [{ dichVu: quanAoThuong, kg: 5 }] })
    expect(r.dong[0]).toMatchObject({ nguonKg: 'ghi-that', kg: 5, tien: 70000 })
    expect(r.tongTinh).toBe(70000)
    expect(r.tongChot).toBe(70000)
  })

  it('dòng số lượng (giày) dùng số lượng x đơn giá, không có kg', () => {
    const r = tinhChiTiet({ dong: [{ dichVu: giay, soLuong: 2 }] })
    expect(r.dong[0]).toMatchObject({ tien: 120000 })
    expect(r.dong[0]?.kg).toBeUndefined()
    expect(r.dong[0]?.nguonKg).toBeUndefined()
  })

  it('phụ thu cộng vào tổng, giữ ghi chú tự do', () => {
    const r = tinhChiTiet({
      dong: [{ dichVu: chanGa, kg: 3 }],
      phuThu: [{ soTien: 5000, ghiChu: 'tẩy vết cà phê' }, { soTien: 10000, ghiChu: '' }],
    })
    expect(r.tongPhuThu).toBe(15000)
    expect(r.tongTinh).toBe(90000)
  })

  it('giảm giá theo số tiền, lý do không bắt buộc', () => {
    const r = tinhChiTiet({ dong: [{ dichVu: chanGa, kg: 4 }], giamGia: { loai: 'tien', soTien: 10000 } })
    expect(r.giamGia).toBe(10000)
    expect(r.tongTinh).toBe(90000)
  })

  it('giảm giá theo phần trăm tính trên dịch vụ cộng phụ thu, làm tròn đồng', () => {
    const r = tinhChiTiet({
      dong: [{ dichVu: quanAoThuong, kg: 5 }],
      phuThu: [{ soTien: 5000, ghiChu: 'x' }],
      giamGia: { loai: 'phan-tram', phanTram: 10, lyDo: 'khách quen' },
    })
    expect(r.giamGia).toBe(7500)
    expect(r.tongTinh).toBe(67500)
  })

  it('nhiều dòng cộng lại và gom cảnh báo Topper từ 6kg', () => {
    const r = tinhChiTiet({ dong: [{ dichVu: quanAoThuong, kg: 1 }, { dichVu: topper, kg: 6 }] })
    expect(r.tongTinh).toBe(28000 + 210000)
    expect(r.canhBao.some((c) => c.includes('Topper'))).toBe(true)
  })

  it.each([
    ['không có dòng nào', { dong: [] }],
    ['dòng kg có cả kg lẫn tiền', { dong: [{ dichVu: quanAoThuong, kg: 2, tien: 28000 }] }],
    ['dòng kg không có kg và tiền', { dong: [{ dichVu: quanAoThuong }] }],
    ['dòng số lượng thiếu số lượng', { dong: [{ dichVu: giay }] }],
    ['số lượng lẻ', { dong: [{ dichVu: giay, soLuong: 1.5 }] }],
    ['phụ thu không dương', { dong: [{ dichVu: giay, soLuong: 1 }], phuThu: [{ soTien: 0, ghiChu: '' }] }],
    ['phần trăm quá 100', { dong: [{ dichVu: giay, soLuong: 1 }], giamGia: { loai: 'phan-tram', phanTram: 120 } }],
    ['giảm hơn cả tiền hàng', { dong: [{ dichVu: giay, soLuong: 1 }], giamGia: { loai: 'tien', soTien: 60000 } }],
  ] as const)('từ chối khi %s', (_ten, chiTiet) => {
    expect(() => tinhChiTiet(chiTiet as never)).toThrowError(expect.objectContaining({ ma: 'DU_LIEU_KHONG_HOP_LE' }))
  })
})

describe('đối chiếu kg và tiền theo sổ', () => {
  const kg5 = [{ dichVu: quanAoThuong, kg: 5 }] // tính ra 70.000đ

  it('chênh trong ngưỡng 10.000đ: không báo, giữ tiền theo sổ', () => {
    const r = tinhChiTiet({ dong: kg5, tongTienSo: 75000 })
    expect(r.chenhLech).toBe(-5000)
    expect(r.vuotNguong).toBe(false)
    expect(r.tongChot).toBe(75000)
  })

  it('chênh đúng bằng ngưỡng vẫn không báo; vượt thì báo và vẫn mặc định giữ tiền sổ', () => {
    expect(tinhChiTiet({ dong: kg5, tongTienSo: 80000 }).vuotNguong).toBe(false)
    const r = tinhChiTiet({ dong: kg5, tongTienSo: 90000 })
    expect(r.tongTinh).toBe(70000)
    expect(r.tongTienSo).toBe(90000)
    expect(r.chenhLech).toBe(-20000)
    expect(r.vuotNguong).toBe(true)
    expect(r.tongChot).toBe(90000)
  })

  it('anh chọn số tính được thì tổng chốt là số tính', () => {
    expect(tinhChiTiet({ dong: kg5, tongTienSo: 90000, chon: 'tinh' }).tongChot).toBe(70000)
  })

  it('ngưỡng chỉnh được', () => {
    expect(tinhChiTiet({ dong: kg5, tongTienSo: 75000 }, { nguongChenh: 2000 }).vuotNguong).toBe(true)
  })

  it('đối chiếu có tính phụ thu và giảm giá', () => {
    const r = tinhChiTiet({
      dong: kg5,
      phuThu: [{ soTien: 5000, ghiChu: '+5K' }],
      giamGia: { loai: 'tien', soTien: 5000 },
      tongTienSo: 70000,
    })
    expect(r.chenhLech).toBe(0)
  })
})

import { describe, expect, it } from 'vitest'
import type { Khach } from './khach.ts'
import { NGUONG_MAC_DINH, tinhNhomKhach, type NguongNhom } from './nhom-khach.ts'
import type { Phieu } from './types.ts'

const HOM_NAY = '2026-11-15'

function khach(id: string, rieng: Partial<Khach> = {}): Khach {
  return {
    id,
    tenGoc: `Khách ${id}`,
    tenHienThi: `Khách ${id}`,
    dongYNhanTin: 'chua-hoi',
    nguon: 'nhap-tay',
    ngayTao: '2026-01-01',
    dungDuocSo: false,
    ...rieng,
  }
}

let dem = 0
function daTra(khachId: string, ngayTra: string, tien = 100000, rieng: Partial<Phieu> = {}): Phieu {
  dem += 1
  return {
    id: `P${dem}`,
    khachId,
    ngayNhan: ngayTra,
    moTa: 'đồ',
    tongTien: tien,
    ngayTra,
    phuongThuc: 'tien-mat',
    trangThai: 'da-tra',
    khach: { id: khachId, ten: khachId, tenHienThi: khachId },
    nhan: 'Đã trả',
    ...rieng,
  }
}

/** Ngày cách HOM_NAY đúng n ngày về trước. */
function truoc(n: number): string {
  const d = new Date(`${HOM_NAY}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() - n)
  return d.toISOString().slice(0, 10)
}

function nhieuLan(khachId: string, soLan: number, ngayGanNhat: string): Phieu[] {
  return Array.from({ length: soLan }, (_, i) => daTra(khachId, i === 0 ? ngayGanNhat : '2026-01-0' + ((i % 9) + 1)))
}

function nhomCua(phieus: Phieu[], nguong?: NguongNhom): string | undefined {
  return tinhNhomKhach({ khach: [khach('A')], phieus, homNay: HOM_NAY, nguong }).khach[0]!.nhom
}

describe('nhóm khách theo số lần mua và độ gần đây', () => {
  it('khách chưa có phiếu đã trả thì chưa thuộc nhóm nào', () => {
    expect(nhomCua([])).toBeUndefined()
  })

  it.each([
    [1, 'tiem-nang'],
    [2, 'tiem-nang'],
    [3, 'than-thiet'],
    [7, 'than-thiet'],
    [8, 'trung-thanh'],
    [12, 'trung-thanh'],
  ])('%i lần mua, mới mua hôm qua', (soLan, nhom) => {
    expect(nhomCua(nhieuLan('A', soLan, truoc(1)))).toBe(nhom)
  })

  it('đúng 90 ngày vẫn là gần đây, 91 ngày là quá hạn', () => {
    expect(nhomCua(nhieuLan('A', 1, truoc(90)))).toBe('tiem-nang')
    expect(nhomCua(nhieuLan('A', 1, truoc(91)))).toBe('sap-roi-bo')
    expect(nhomCua(nhieuLan('A', 2, truoc(90)))).toBe('tiem-nang')
    expect(nhomCua(nhieuLan('A', 2, truoc(91)))).toBe('can-quan-tam')
  })

  it('quá hạn: từ 2 lần là Cần quan tâm kể cả rất nhiều lần', () => {
    expect(nhomCua(nhieuLan('A', 9, truoc(200)))).toBe('can-quan-tam')
    expect(nhomCua(nhieuLan('A', 3, truoc(91)))).toBe('can-quan-tam')
  })

  it('tính ngày mua gần nhất và số lần, bỏ phiếu hủy, xóa mềm, chưa trả', () => {
    const phieus = [
      daTra('A', truoc(100)),
      daTra('A', truoc(50)),
      daTra('A', truoc(5), 1, { trangThai: 'da-huy', nhan: 'Đã hủy' }),
      daTra('A', truoc(3), 1, { daXoa: true }),
      daTra('A', truoc(2), 1, { trangThai: 'chua-thanh-toan', nhan: 'Chờ trả khách', ngayTra: undefined }),
      daTra('B', truoc(1)),
    ]
    const kq = tinhNhomKhach({ khach: [khach('A')], phieus, homNay: HOM_NAY }).khach[0]!
    expect(kq.soLanMua).toBe(2)
    expect(kq.ngayMuaGanNhat).toBe(truoc(50))
    expect(kq.nhom).toBe('tiem-nang')
    expect(kq.doanhThu).toBe(200000)
  })

  it('chỉ có phiếu hủy thì không thuộc nhóm nào', () => {
    expect(nhomCua([daTra('A', truoc(1), 1, { trangThai: 'da-huy', nhan: 'Đã hủy' })])).toBeUndefined()
  })

  it('ngưỡng chỉnh được: gần đây 30 ngày, trung thành từ 5 lần', () => {
    const nguong: NguongNhom = { ...NGUONG_MAC_DINH, ngayGanDay: 30, tuLanTrungThanh: 5 }
    expect(nhomCua(nhieuLan('A', 1, truoc(30)), nguong)).toBe('tiem-nang')
    expect(nhomCua(nhieuLan('A', 1, truoc(31)), nguong)).toBe('sap-roi-bo')
    expect(nhomCua(nhieuLan('A', 5, truoc(1)), nguong)).toBe('trung-thanh')
    expect(nhomCua(nhieuLan('A', 4, truoc(1)), nguong)).toBe('than-thiet')
  })
})

describe('tổng hợp theo nhóm', () => {
  it('đếm khách, tỷ trọng doanh thu, khách thiếu số điện thoại hợp lệ', () => {
    const ds = [
      khach('A', { dungDuocSo: true, soDienThoai: '0900000001' }),
      khach('B'),
      khach('C', { dungDuocSo: true, soDienThoai: '0900000003' }),
      khach('D'),
    ]
    const phieus = [
      daTra('A', truoc(1), 300000),
      daTra('B', truoc(1), 100000),
      daTra('C', truoc(120), 600000),
    ]
    const kq = tinhNhomKhach({ khach: ds, phieus, homNay: HOM_NAY })
    const tn = kq.nhom.find((n) => n.nhom === 'tiem-nang')!
    expect(tn.soKhach).toBe(2)
    expect(tn.thieuSo).toBe(1)
    expect(tn.doanhThu).toBe(400000)
    expect(tn.tyTrong).toBeCloseTo(0.4)
    const rb = kq.nhom.find((n) => n.nhom === 'sap-roi-bo')!
    expect(rb.soKhach).toBe(1)
    expect(rb.tyTrong).toBeCloseTo(0.6)
    expect(kq.nhom.map((n) => n.nhom)).toEqual([
      'trung-thanh',
      'than-thiet',
      'tiem-nang',
      'can-quan-tam',
      'sap-roi-bo',
    ])
    expect(kq.chuaCoNhom).toBe(1)
    expect(kq.nhom.find((n) => n.nhom === 'trung-thanh')!.tyTrong).toBe(0)
  })
})

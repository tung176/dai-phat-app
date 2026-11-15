import { describe, expect, it } from 'vitest'
import type { KhachTheoNhom } from './nhom-khach.ts'
import { danhSachNhanTin, nhanTinSangCsv } from './nhan-tin.ts'

function k(id: string, rieng: Partial<KhachTheoNhom> = {}): KhachTheoNhom {
  return {
    khachId: id,
    tenHienThi: `Khách ${id}`,
    soDienThoai: '0900000001',
    dungDuocSo: true,
    dongYNhanTin: true,
    soLanMua: 1,
    ngayMuaGanNhat: '2026-11-03',
    doanhThu: 1,
    nhom: 'tiem-nang',
    ...rieng,
  }
}

describe('danh sách nhắn tin theo nhóm', () => {
  it('chỉ lấy khách có số hợp lệ VÀ đã đồng ý; đếm riêng số bị loại từng lý do', () => {
    const ds = [
      k('A'),
      k('B', { dongYNhanTin: false }),
      k('C', { dungDuocSo: false, soDienThoai: '123' }),
      k('D', { dungDuocSo: false, soDienThoai: undefined, dongYNhanTin: false }),
      k('E', { nhom: 'than-thiet' }),
    ]
    const kq = danhSachNhanTin(ds, 'tiem-nang')
    expect(kq.dong.map((d) => d.khachId)).toEqual(['A'])
    expect(kq.thieuSo).toBe(2)
    expect(kq.chuaDongY).toBe(1)
    expect(kq.tongTrongNhom).toBe(4)
  })

  it('CSV: tiêu đề, tên, số, nhóm, ngày dd/mm/yyyy; escape dấu phẩy và nháy kép', () => {
    const kq = danhSachNhanTin([k('A', { tenHienThi: 'Lan, "chị" (tầng 2)' }), k('B', { soDienThoai: '0900000002' })], 'tiem-nang')
    const csv = nhanTinSangCsv(kq.dong)
    expect(csv.startsWith('\uFEFF')).toBe(true)
    expect(csv.replace('\uFEFF', '').split('\r\n')).toEqual([
      'Tên,Số điện thoại,Nhóm,Ngày mua gần nhất',
      '"Lan, ""chị"" (tầng 2)",0900000001,Tiềm năng,03/11/2026',
      'Khách B,0900000002,Tiềm năng,03/11/2026',
    ])
  })

  it('CSV: tên bắt đầu bằng ký tự công thức được vô hiệu hóa', () => {
    const kq = danhSachNhanTin([k('A', { tenHienThi: '=HYPERLINK("x")' })], 'tiem-nang')
    expect(nhanTinSangCsv(kq.dong)).toContain("'=HYPERLINK")
  })

  it('nhóm không có ai đủ điều kiện: CSV chỉ có dòng tiêu đề', () => {
    const kq = danhSachNhanTin([k('A', { dongYNhanTin: false })], 'tiem-nang')
    expect(kq.dong).toEqual([])
    expect(nhanTinSangCsv(kq.dong).replace('\uFEFF', '')).toBe('Tên,Số điện thoại,Nhóm,Ngày mua gần nhất')
  })
})

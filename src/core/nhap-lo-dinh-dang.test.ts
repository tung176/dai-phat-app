import { describe, expect, it } from 'vitest'
import { docBangDoiChieu, xuatBangDoiChieu } from './nhap-lo.ts'

const goi = (o: unknown) => JSON.stringify(o)

describe('đọc bảng đối chiếu', () => {
  it('dòng kế thừa ngày nhận từ tiêu đề nhóm ngày, dòng có ngày riêng thì giữ ngày riêng', () => {
    const { bang } = docBangDoiChieu(
      goi({
        dinhDang: 'bang-doi-chieu-so',
        phienBan: 1,
        lo: 'lo-thu',
        nhomNgay: [
          {
            ngayNhan: '2026-11-01',
            dong: [
              { ma: 'a1', khach: 'Mẫu An', viTri: 'tầng 2', moTa: '1 túi quần áo', tien: 50000 },
              { ma: 'a2', khach: 'Mẫu Bình', moTa: '2 chăn', ngayNhan: '2026-11-02' },
            ],
          },
        ],
      }),
    )
    expect(bang.lo).toBe('lo-thu')
    expect(bang.dong.map((d) => d.ngayNhan)).toEqual(['2026-11-01', '2026-11-02'])
    expect(bang.dong[0]).toMatchObject({ khach: 'Mẫu An', viTri: 'tầng 2', tien: 50000 })
  })

  it('ô đánh dấu không chắc bị bỏ giá trị (để trống), ô có giá trị sai kiểu cũng bị tô vàng và để trống', () => {
    const { bang, canhBao } = docBangDoiChieu(
      goi({
        dinhDang: 'bang-doi-chieu-so',
        phienBan: 1,
        lo: 'lo-thu',
        dong: [
          { ma: 'a1', khach: 'Mẫu An', moTa: 'x', ngayNhan: '2026-11-01', tien: 70000, khongChac: ['tien'] },
          { ma: 'a2', khach: 'Mẫu Bình', moTa: 'y', ngayNhan: '2026-11-01', tien: '50K', ngayTra: '5/11' },
        ],
      }),
    )
    expect(bang.dong[0]!.tien).toBeUndefined()
    expect(bang.dong[0]!.khongChac).toEqual(['tien'])
    expect(bang.dong[1]!.tien).toBeUndefined()
    expect(bang.dong[1]!.ngayTra).toBeUndefined()
    expect([...bang.dong[1]!.khongChac!].sort()).toEqual(['ngayTra', 'tien'])
    expect(canhBao.length).toBeGreaterThan(0)
  })

  it('thiếu mã dòng thì đánh mã theo thứ tự, ổn định giữa các lần đọc', () => {
    const nguon = goi({
      dinhDang: 'bang-doi-chieu-so',
      phienBan: 1,
      lo: 'lo-thu',
      dong: [
        { khach: 'A', moTa: 'x', ngayNhan: '2026-11-01' },
        { khach: 'B', moTa: 'y', ngayNhan: '2026-11-01' },
      ],
    })
    expect(docBangDoiChieu(nguon).bang.dong.map((d) => d.ma)).toEqual(['d1', 'd2'])
    expect(docBangDoiChieu(nguon).bang.dong.map((d) => d.ma)).toEqual(['d1', 'd2'])
  })

  it.each([
    ['không phải JSON', 'abc'],
    ['sai định dạng', goi({ dinhDang: 'khac', phienBan: 1, lo: 'x', dong: [] })],
    ['thiếu mã lô', goi({ dinhDang: 'bang-doi-chieu-so', phienBan: 1, dong: [] })],
    [
      'trùng mã dòng',
      goi({
        dinhDang: 'bang-doi-chieu-so',
        phienBan: 1,
        lo: 'x',
        dong: [
          { ma: 'a', khach: 'A', moTa: 'x' },
          { ma: 'a', khach: 'B', moTa: 'y' },
        ],
      }),
    ],
    [
      'tên ô không chắc lạ',
      goi({ dinhDang: 'bang-doi-chieu-so', phienBan: 1, lo: 'x', dong: [{ ma: 'a', khach: 'A', moTa: 'x', khongChac: ['lạ'] }] }),
    ],
  ])('từ chối %s', (_t, nguon) => {
    expect(() => docBangDoiChieu(nguon)).toThrowError(expect.objectContaining({ ma: 'DU_LIEU_KHONG_HOP_LE' }))
  })

  it('xuất rồi đọc lại cho đúng bảng cũ', () => {
    const { bang } = docBangDoiChieu(
      goi({
        dinhDang: 'bang-doi-chieu-so',
        phienBan: 1,
        lo: 'lo-thu',
        dong: [{ ma: 'a1', nhom: 'g1', khach: 'A', moTa: 'x', ngayNhan: '2026-11-01', tienMat: true, ngayTra: '2026-11-03', tien: 1000 }],
      }),
    )
    expect(docBangDoiChieu(xuatBangDoiChieu(bang)).bang).toEqual(bang)
  })
})

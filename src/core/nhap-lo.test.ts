import { describe, expect, it } from 'vitest'
import { bang, lap } from './nhap-lo.thu.ts'

describe('phân loại dòng sổ', () => {
  it('không có tiền: phiếu tạm; có tiền chưa dấu: chờ trả khách; đủ ngày trả và một dấu: đã trả', async () => {
    const h = lap()
    const kq = await h.nhapLo.xemTruoc(
      bang(
        { ma: 'a' },
        { ma: 'b', tien: 50000 },
        { ma: 'c', tien: 70000, ngayTra: '2026-11-05', tienMat: true },
        { ma: 'd', tien: 70000, ngayTra: '2026-11-05', chuyenKhoan: true },
      ),
    )
    expect(kq.phieu.map((p) => [p.maDong[0], p.loai])).toEqual([
      ['a', 'tam'],
      ['b', 'cho-tra'],
      ['c', 'da-tra'],
      ['d', 'da-tra'],
    ])
    expect(kq.phieu[2]).toMatchObject({ phuongThuc: 'tien-mat', tien: 70000, ngayTra: '2026-11-05' })
    expect(kq.phieu[3]).toMatchObject({ phuongThuc: 'chuyen-khoan' })
  })

  it.each([
    ['dấu ở cả hai cột', { tien: 1000, ngayTra: '2026-11-05', tienMat: true, chuyenKhoan: true }],
    ['có dấu mà thiếu tiền', { ngayTra: '2026-11-05', tienMat: true }],
    ['có dấu mà thiếu ngày trả', { tien: 1000, chuyenKhoan: true }],
    ['ngày trả trước ngày nhận', { tien: 1000, ngayTra: '2026-11-01', tienMat: true }],
    ['ô không chắc về tiền', { khongChac: ['tien' as const] }],
    ['có tiền và ngày trả mà thiếu dấu tiền mặt hay chuyển khoản', { tien: 1000, ngayTra: '2026-11-05' }],
    ['ô không chắc về dấu', { tien: 1000, ngayTra: '2026-11-05', khongChac: ['tienMat' as const] }],
    ['thiếu tên khách', { khach: '' }],
    ['thiếu ngày nhận', { ngayNhan: undefined }],
  ])('dừng và hỏi khi %s, không tự điền và không ghi', async (_t, dong) => {
    const h = lap()
    const b = bang({ ma: 'x', ...dong })
    const kq = await h.nhapLo.xemTruoc(b)
    expect(kq.phieu[0]).toMatchObject({ loai: 'can-hoi', sanSang: false })
    expect(kq.phieu[0]!.lyDoHoi.length).toBeGreaterThan(0)
    const ghi = await h.nhapLo.ghi(b, {}, { duyet: true })
    expect(ghi.ketQua).toEqual([])
    expect(await h.phieu.danhSach()).toHaveLength(0)
  })

  it('có ngày trả nhưng chưa có tiền và chưa có dấu: vẫn là phiếu tạm, kèm cảnh báo', async () => {
    const kq = await lap().nhapLo.xemTruoc(bang({ ma: 'x', ngayTra: '2026-11-05' }))
    expect(kq.phieu[0]).toMatchObject({ loai: 'tam' })
    expect(kq.phieu[0]!.canhBao.length).toBe(1)
  })

  it('các dòng cùng nhóm thành một phiếu một tổng tiền, mô tả gộp lại', async () => {
    const h = lap()
    const kq = await h.nhapLo.xemTruoc(
      bang({ ma: 'a', nhom: 'g', moTa: '2 chăn', tien: 120000 }, { ma: 'b', nhom: 'g', moTa: '1 gối' }, { ma: 'c' }),
    )
    expect(kq.phieu).toHaveLength(2)
    expect(kq.phieu[0]).toMatchObject({ maDong: ['a', 'b'], moTa: '2 chăn; 1 gối', tien: 120000, loai: 'cho-tra' })
  })

  it('nhóm có hai số tiền khác nhau, hoặc khác khách, thì dừng hỏi', async () => {
    const h = lap()
    const kq = await h.nhapLo.xemTruoc(
      bang(
        { ma: 'a', nhom: 'g', tien: 1000 },
        { ma: 'b', nhom: 'g', tien: 2000 },
        { ma: 'c', nhom: 'h' },
        { ma: 'd', nhom: 'h', khach: 'Khác' },
      ),
    )
    expect(kq.phieu.map((p) => p.loai)).toEqual(['can-hoi', 'can-hoi'])
  })
})

describe('khách', () => {
  it('tên chưa giống ai là khách mới sẵn sàng; tên gần giống khách cũ phải được xác nhận, không tự gộp', async () => {
    const h = lap()
    const cu = await h.khach.them({ ten: 'Mẫu An', viTri: 'tầng 2' })
    const b = bang({ ma: 'a', khach: 'mau an' }, { ma: 'b', khach: 'Người Lạ' })
    const kq = await h.nhapLo.xemTruoc(b)
    expect(kq.phieu[0]).toMatchObject({ sanSang: false })
    expect(kq.phieu[0]!.khach.goiY.map((k) => k.id)).toEqual([cu.id])
    expect(kq.phieu[0]!.khach.trangThai).toBe('can-chon')
    expect(kq.phieu[1]).toMatchObject({ sanSang: true })
    expect(kq.phieu[1]!.khach.trangThai).toBe('moi')

    // Chưa xác nhận thì không ghi dòng đó, dòng sẵn sàng vẫn ghi được.
    const ghi = await h.nhapLo.ghi(b, {}, { duyet: true })
    expect(ghi.ketQua.map((k) => k.maDong[0])).toEqual(['b'])
    expect((await h.khach.danhSach()).map((k) => k.tenHienThi).sort()).toEqual(['Mẫu An (tầng 2)', 'Người Lạ'])
  })

  it('xác nhận dùng khách cũ thì phiếu gắn khách đó; chọn "mới" thì tạo khách mới không số điện thoại', async () => {
    const h = lap()
    const cu = await h.khach.them({ ten: 'Mẫu An', viTri: 'tầng 2', soDienThoai: '0900000111' })
    const b = bang({ ma: 'a', khach: 'Mẫu An' }, { ma: 'b', khach: 'Mẫu An', viTri: 'B5', moTa: 'x' })
    const khoa = (await h.nhapLo.xemTruoc(b)).phieu.map((p) => p.khach.khoa)
    expect(khoa[0]).not.toBe(khoa[1])
    await h.nhapLo.ghi(b, { khach: { [khoa[0]!]: { khachId: cu.id }, [khoa[1]!]: 'moi' } }, { duyet: true })
    const ds = await h.phieu.danhSach()
    expect(ds.find((p) => p.moTa === '1 túi quần áo')!.khachId).toBe(cu.id)
    const moi = ds.find((p) => p.moTa === 'x')!
    expect(moi.khachId).not.toBe(cu.id)
    expect(moi.khach).toMatchObject({ tenHienThi: 'Mẫu An (B5)' })
    expect(moi.khach.soDienThoai).toBeUndefined()
  })

  it('nhiều dòng cùng một tên mới chỉ tạo một khách', async () => {
    const h = lap()
    await h.nhapLo.ghi(bang({ ma: 'a', khach: 'Người Lạ' }, { ma: 'b', khach: 'Người Lạ', moTa: 'y' }), {}, { duyet: true })
    expect(await h.khach.danhSach()).toHaveLength(1)
  })
})

describe('ghi sau khi duyệt', () => {
  it('xem trước không ghi gì; ghi mà chưa duyệt bị từ chối', async () => {
    const h = lap()
    const b = bang({ ma: 'a' })
    await h.nhapLo.xemTruoc(b)
    expect(await h.phieu.danhSach()).toHaveLength(0)
    await expect(h.nhapLo.ghi(b, {}, { duyet: false as unknown as true })).rejects.toMatchObject({ ma: 'DU_LIEU_KHONG_HOP_LE' })
    expect(await h.phieu.danhSach()).toHaveLength(0)
  })

  it('dòng đã trả: tạo phiếu, chốt tiền, trả khách, giữ ngày nhận và ngày trả thật trong sổ', async () => {
    const h = lap()
    await h.nhapLo.ghi(
      bang(
        { ma: 'a', ngayNhan: '2026-11-02', tien: 70000, ngayTra: '2026-11-05', chuyenKhoan: true },
        { ma: 'b', ngayNhan: '2026-11-03', tien: 50000 },
        { ma: 'c', ngayNhan: '2026-11-04' },
      ),
      {},
      { duyet: true },
    )
    const ds = (await h.phieu.danhSach()).sort((x, y) => x.ngayNhan.localeCompare(y.ngayNhan))
    expect(ds[0]).toMatchObject({ nhan: 'Đã trả', ngayNhan: '2026-11-02', ngayTra: '2026-11-05', phuongThuc: 'chuyen-khoan', tongTien: 70000 })
    expect(ds[1]).toMatchObject({ nhan: 'Chờ trả khách', tongTien: 50000 })
    expect(ds[2]).toMatchObject({ nhan: 'Chưa tính tiền' })
  })

  it('nhập lại cùng lô không tạo phiếu trùng và báo là đã nhập', async () => {
    const h = lap()
    const b = bang({ ma: 'a', tien: 70000, ngayTra: '2026-11-05', tienMat: true }, { ma: 'b' })
    await h.nhapLo.ghi(b, {}, { duyet: true })
    const lai = await h.nhapLo.ghi(b, {}, { duyet: true })
    expect(await h.phieu.danhSach()).toHaveLength(2)
    expect(lai.ketQua).toEqual([])
    const xem = await h.nhapLo.xemTruoc(b)
    expect(xem.phieu.map((p) => p.loai)).toEqual(['da-nhap', 'da-nhap'])
    expect(await h.khach.danhSach()).toHaveLength(1)
  })

  it('cùng mã dòng ở lô khác thì là phiếu khác', async () => {
    const h = lap()
    await h.nhapLo.ghi(bang({ ma: 'a', khach: 'Người Lạ' }), {}, { duyet: true })
    const khachCu = (await h.khach.danhSach())[0]!
    const lo2 = { ...bang({ ma: 'a', khach: 'Người Lạ' }), lo: 'lo-khac' }
    const khoa = (await h.nhapLo.xemTruoc(lo2)).phieu[0]!.khach.khoa
    await h.nhapLo.ghi(lo2, { khach: { [khoa]: { khachId: khachCu.id } } }, { duyet: true })
    expect((await h.phieu.danhSach()).length).toBe(2)
  })

  it('đang dở dang (đã tạo phiếu nhưng chưa trả) thì lần nhập lại làm nốt, không tạo phiếu thứ hai', async () => {
    const h = lap()
    const b = bang({ ma: 'a', tien: 70000, ngayTra: '2026-11-05', tienMat: true })
    // Giả lập lần trước dừng giữa chừng: phiếu đã có khóa lô nhưng mới chốt tiền.
    await h.nhapLo.ghi(bang({ ma: 'a', tien: 70000 }), {}, { duyet: true })
    const xem = await h.nhapLo.xemTruoc(b)
    expect(xem.phieu[0]).toMatchObject({ loai: 'da-tra', sanSang: true })
    await h.nhapLo.ghi(b, {}, { duyet: true })
    const ds = await h.phieu.danhSach()
    expect(ds).toHaveLength(1)
    expect(ds[0]).toMatchObject({ nhan: 'Đã trả', ngayTra: '2026-11-05' })
  })
})

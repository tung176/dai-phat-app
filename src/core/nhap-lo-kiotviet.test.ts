import { describe, expect, it } from 'vitest'
import { bang, lap } from './nhap-lo.thu.ts'

/** Phiếu tạm đã nhập từ KiotViet (dữ liệu giả): khách "Mẫu An", nhận 25/10/2026, tiền 60.200. */
async function coPhieuTamCu(h: ReturnType<typeof lap>, o: { ten?: string; ngayNhan?: string; tien?: number } = {}) {
  const p = await h.phieu.nhanDo({ tenKhach: o.ten ?? 'Mẫu An', ngayNhan: o.ngayNhan ?? '2026-10-25', moTa: 'phiếu tạm KiotViet' })
  return o.tien === undefined ? await h.phieu.chotTien(p.id, 60200) : o.tien === 0 ? p : await h.phieu.chotTien(p.id, o.tien)
}

describe('ranh giới với KiotViet', () => {
  it('dòng có ngày trả đến 30/10/2026 đã nằm trong KiotViet: bỏ qua, không tạo phiếu', async () => {
    const h = lap()
    const b = bang({ ma: 'a', ngayNhan: '2026-10-28', tien: 50000, ngayTra: '2026-10-30', tienMat: true })
    const kq = await h.nhapLo.xemTruoc(b)
    expect(kq.phieu[0]).toMatchObject({ loai: 'bo-qua', sanSang: false })
    const ghi = await h.nhapLo.ghi(b, {}, { duyet: true })
    expect(ghi.ketQua).toEqual([])
    expect(await h.phieu.danhSach()).toHaveLength(0)
  })

  it('dòng bỏ qua mà trùng phiếu đã có trong kho thì báo trùng với phiếu nào', async () => {
    const h = lap()
    const co = await h.phieu.nhanDo({ tenKhach: 'Mẫu An', ngayNhan: '2026-10-28', moTa: 'x' })
    await h.phieu.chotTien(co.id, 50000)
    await h.phieu.traKhach(co.id, { ngayTra: '2026-10-30', phuongThuc: 'tien-mat' })
    const kq = await h.nhapLo.xemTruoc(bang({ ma: 'a', ngayNhan: '2026-10-28', tien: 50000, ngayTra: '2026-10-29', tienMat: true }))
    expect(kq.phieu[0]).toMatchObject({ loai: 'bo-qua', trungVoi: co.id })
  })

  it('nhận đến 29/10, trả từ 1/11: đề xuất cặp với phiếu tạm khớp khách, ngày nhận và tiền gần đúng (60.200 so với 60.000)', async () => {
    const h = lap()
    const cu = await coPhieuTamCu(h)
    const xa = await coPhieuTamCu(h, { ten: 'Người Lạ' })
    const lech = await coPhieuTamCu(h, { ngayNhan: '2026-10-26' })
    const lechTien = await coPhieuTamCu(h, { tien: 90000 })
    const kq = await h.nhapLo.xemTruoc(bang({ ma: 'a', ngayNhan: '2026-10-25', tien: 60000, ngayTra: '2026-11-02', tienMat: true }))
    const p = kq.phieu[0]!
    expect(p.ghep?.ungVien.map((u) => u.phieuId)).toEqual([cu.id])
    expect(p.ghep?.ungVien[0]).toMatchObject({ lechTien: 200 })
    expect(p.ghep?.trangThai).toBe('can-chon')
    expect(p.sanSang).toBe(false)
    expect([xa.id, lech.id, lechTien.id]).not.toContain(p.ghep?.ungVien[0]?.phieuId)
  })

  it('chưa xác nhận cặp thì không ghi; xác nhận thì hoàn thành phiếu cũ (không tạo mới) với ngày nhận và ngày trả thật', async () => {
    const h = lap()
    const cu = await coPhieuTamCu(h)
    const b = bang({ ma: 'a', ngayNhan: '2026-10-25', tien: 60000, ngayTra: '2026-11-02', chuyenKhoan: true })
    expect((await h.nhapLo.ghi(b, {}, { duyet: true })).ketQua).toEqual([])
    expect((await h.phieu.danhSach())[0]!.nhan).toBe('Chờ trả khách')

    const kq = await h.nhapLo.ghi(b, { ghep: { [(await h.nhapLo.xemTruoc(b)).phieu[0]!.khoa]: { phieuId: cu.id } } }, { duyet: true })
    expect(kq.ketQua[0]).toMatchObject({ ket: 'hoan-thanh-phieu-cu', phieuId: cu.id })
    const ds = await h.phieu.danhSach()
    expect(ds).toHaveLength(1)
    expect(ds[0]).toMatchObject({ id: cu.id, nhan: 'Đã trả', ngayNhan: '2026-10-25', ngayTra: '2026-11-02', phuongThuc: 'chuyen-khoan', tongTien: 60000 })
    // Tiền theo sổ là sự thật: số sửa từ 60.200 xuống 60.000 có để lại dấu vết trong nhật ký.
    const nk = await h.suaSai.nhatKyCuaPhieu(cu.id)
    expect(nk.map((n) => n.loai)).toContain('sua')
    expect(nk.map((n) => n.loai)).toContain('nhap-lo')
    // Nhập lại: không ghép lần nữa, không phiếu mới.
    expect((await h.nhapLo.xemTruoc(b)).phieu[0]!.loai).toBe('da-nhap')
  })

  it('phiếu tạm cũ chưa có tiền thì chốt tiền theo sổ rồi trả', async () => {
    const h = lap()
    const cu = await coPhieuTamCu(h, { tien: 0 })
    const b = bang({ ma: 'a', ngayNhan: '2026-10-25', tien: 60000, ngayTra: '2026-11-02', tienMat: true })
    const p = (await h.nhapLo.xemTruoc(b)).phieu[0]!
    expect(p.ghep?.ungVien.map((u) => u.phieuId)).toEqual([cu.id])
    await h.nhapLo.ghi(b, { ghep: { [p.khoa]: { phieuId: cu.id } } }, { duyet: true })
    expect(await h.phieu.lay(cu.id)).toMatchObject({ nhan: 'Đã trả', tongTien: 60000 })
  })

  it('chủ tiệm chọn "tạo mới" thì tạo phiếu mới, phiếu cũ giữ nguyên', async () => {
    const h = lap()
    const cu = await coPhieuTamCu(h)
    const b = bang({ ma: 'a', ngayNhan: '2026-10-25', tien: 60000, ngayTra: '2026-11-02', tienMat: true })
    const p = (await h.nhapLo.xemTruoc(b)).phieu[0]!
    const ghi = await h.nhapLo.ghi(
      b,
      { ghep: { [p.khoa]: 'tao-moi' }, khach: { [p.khach.khoa]: { khachId: cu.khachId } } },
      { duyet: true },
    )
    expect(ghi.ketQua[0]).toMatchObject({ ket: 'da-tao' })
    expect(await h.phieu.danhSach()).toHaveLength(2)
    expect((await h.phieu.lay(cu.id))!.nhan).toBe('Chờ trả khách')
  })

  it('nhận từ 30/10/2026 trở đi: tạo phiếu mới, không ghép', async () => {
    const h = lap()
    await coPhieuTamCu(h, { ngayNhan: '2026-10-30' })
    const kq = await h.nhapLo.xemTruoc(bang({ ma: 'a', ngayNhan: '2026-10-30', tien: 60000, ngayTra: '2026-11-02', tienMat: true }))
    expect(kq.phieu[0]!.ghep).toBeUndefined()
    expect(kq.phieu[0]).toMatchObject({ loai: 'da-tra' })
  })

  it('nhận cũ nhưng trả vào khoảng giữa hai mốc (31/10) thì dừng hỏi', async () => {
    const kq = await lap().nhapLo.xemTruoc(bang({ ma: 'a', ngayNhan: '2026-10-25', tien: 60000, ngayTra: '2026-10-31', tienMat: true }))
    expect(kq.phieu[0]).toMatchObject({ loai: 'can-hoi' })
  })

  it('các mốc ngày và ngưỡng lệch là tham số, đổi được', async () => {
    const h = lap({ thamSo: { ngayTraDaCoDen: '2026-10-15', ngayTraMoiTu: '2026-10-16', nguongLechTien: 50 } })
    await coPhieuTamCu(h)
    const kq = await h.nhapLo.xemTruoc(bang({ ma: 'a', ngayNhan: '2026-10-25', tien: 60000, ngayTra: '2026-10-30', tienMat: true }, { ma: 'b', ngayNhan: '2026-10-10', tien: 60000, ngayTra: '2026-10-14', tienMat: true }))
    expect(kq.phieu[0]!.loai).toBe('da-tra') // 30/10 không còn là "đã có trong KiotViet"
    expect(kq.phieu[0]!.ghep?.ungVien).toEqual([]) // lệch 200 vượt ngưỡng 50
    expect(kq.phieu[1]!.loai).toBe('bo-qua')
  })
})

describe('nhật ký nhập lô', () => {
  it('mỗi phiếu tạo ra có một dòng nhật ký loại nhập lô, ghi người, lô, mã dòng', async () => {
    const h = lap()
    await h.nhapLo.ghi(bang({ ma: 'a', tien: 1000 }), {}, { duyet: true })
    const [p] = await h.phieu.danhSach()
    const nk = (await h.suaSai.nhatKy()).filter((n) => n.loai === 'nhap-lo')
    expect(nk).toHaveLength(1)
    expect(nk[0]).toMatchObject({ phieuId: p!.id, nguoi: { id: 'chu' }, batThuong: [] })
    expect(nk[0]!.lyDo).toContain('lo-thu')
    expect(nk[0]!.lyDo).toContain('a')
    expect(nk[0]!.thayDoi.find((t) => t.truong === 'tongTien')).toMatchObject({ truoc: null, sau: 1000 })
  })
})

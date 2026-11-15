import { describe, expect, it } from 'vitest'
import { lap, type HeThuThu } from './sua-sai.thu.ts'

describe('người dùng hiện tại', () => {
  it('lấy từ cài đặt, ghi rõ chưa xác thực; đổi người cũng có nhật ký', async () => {
    const h = lap()
    const p = await h.taoPhieu()
    expect(await h.suaSai.nguoiHienTai()).toEqual({ id: 'chu', ten: 'Chủ', xacThuc: false })

    await h.suaSai.datNguoiHienTai('me')
    await h.suaSai.huy(p.id, 'nhầm')

    const nk = await h.suaSai.nhatKy()
    expect(nk.map((n) => n.loai)).toEqual(['doi-nguoi-dung', 'huy'])
    expect(nk[1]?.nguoi).toEqual({ id: 'me', ten: 'Mẹ', xacThuc: false })
    await expect(h.suaSai.datNguoiHienTai('la')).rejects.toMatchObject({ ma: 'KHONG_TIM_THAY' })
  })
})

describe('công tắc chức năng', () => {
  type Chay = (h: HeThuThu, id: string) => Promise<unknown>
  const cacCa: Array<[string, Chay]> = [
    ['suaTaiCho', (h, id) => h.suaSai.sua(id, { moTa: 'y' }, 'x')],
    ['huy', (h, id) => h.suaSai.huy(id, 'x')],
    ['xoaMem', (h, id) => h.suaSai.xoaMem(id, 'x')],
    ['luiNgay', (h, id) => h.suaSai.luiNgay(id, { ngayNhan: '2026-11-01' }, 'x')],
    ['thayThe', (h, id) => h.suaSai.thayThe(id, {}, 'x')],
  ]
  it.each(cacCa)('tắt "%s" thì thao tác bị chặn, bật lại thì chạy được', async (khoa, chay) => {
    const h = lap()
    const p = await h.taoPhieu()
    await h.suaSai.capNhatCaiDat({ congTac: { [khoa]: false } }, 'khóa chức năng')

    await expect(chay(h, p.id)).rejects.toMatchObject({ ma: 'CHUC_NANG_TAT' })
    expect((await h.phieu.lay(p.id))?.nhan).toBe('Chưa tính tiền')
    expect((await h.suaSai.nhatKy()).map((n) => n.loai)).toEqual(['doi-cai-dat'])

    await h.suaSai.capNhatCaiDat({ congTac: { [khoa]: true } }, 'mở lại')
    await expect(chay(h, p.id)).resolves.toBeDefined()
  })

  it('đổi cài đặt ghi giá trị trước và sau; ngưỡng sai bị từ chối', async () => {
    const h = lap()
    await h.suaSai.capNhatCaiDat({ nguong: { luiNgayQuaNgay: 10 } }, 'nới ngưỡng')
    expect((await h.suaSai.nhatKy())[0]?.thayDoi).toEqual([{ truong: 'nguong.luiNgayQuaNgay', truoc: 7, sau: 10 }])
    await expect(h.suaSai.capNhatCaiDat({ nguong: { thayDoiMoiNgay: -1 } }, 'x')).rejects.toMatchObject({
      ma: 'DU_LIEU_KHONG_HOP_LE',
    })
    await expect(h.suaSai.capNhatCaiDat({ khoaThang: { cacThang: ['11/2026'] } }, 'x')).rejects.toMatchObject({
      ma: 'DU_LIEU_KHONG_HOP_LE',
    })
  })
})

describe('đánh dấu bất thường, sát ngưỡng', () => {
  const quyTac = async (h: HeThuThu) =>
    (await h.suaSai.nhatKy()).flatMap((n) => n.batThuong.map((b) => b.quyTac))

  it('sửa tiền hoặc phương thức của phiếu đã trả bị đánh dấu; sửa mô tả thì không', async () => {
    const h = lap()
    const p = await h.taoPhieu({ tien: 100000, tra: { ngayTra: '2026-11-12', pt: 'chuyen-khoan' } })
    await h.suaSai.sua(p.id, { moTa: 'sửa chữ' }, 'x')
    expect(await quyTac(h)).toEqual([])
    await h.suaSai.sua(p.id, { phuongThuc: 'tien-mat' }, 'x')
    await h.suaSai.sua(p.id, { tongTien: 99000 }, 'x')
    expect(await quyTac(h)).toEqual(['sua-tien-hoac-phuong-thuc-da-tra', 'sua-tien-hoac-phuong-thuc-da-tra'])
  })

  it('hủy hoặc xóa phiếu đã trả tiền mặt bị đánh dấu; chuyển khoản hoặc chưa trả thì không', async () => {
    const h = lap()
    const tm1 = await h.taoPhieu({ tien: 1000, tra: { ngayTra: '2026-11-12', pt: 'tien-mat' } })
    const tm2 = await h.taoPhieu({ tien: 1000, tra: { ngayTra: '2026-11-12', pt: 'tien-mat' } })
    const ck = await h.taoPhieu({ tien: 1000, tra: { ngayTra: '2026-11-12', pt: 'chuyen-khoan' } })
    const chua = await h.taoPhieu({ tien: 1000 })
    await h.suaSai.huy(ck.id, 'x')
    await h.suaSai.xoaMem(chua.id, 'x')
    expect(await quyTac(h)).toEqual([])
    await h.suaSai.huy(tm1.id, 'x')
    await h.suaSai.xoaMem(tm2.id, 'x')
    expect(await quyTac(h)).toEqual(['huy-hoac-xoa-da-tra-tien-mat', 'huy-hoac-xoa-da-tra-tien-mat'])
  })

  it('lùi ngày: đúng 7 ngày so với ngày thao tác thì chưa, 8 ngày thì bị đánh dấu', async () => {
    const h = lap('2026-11-15T09:00:00')
    const a = await h.taoPhieu({ ngayNhan: '2026-11-14' })
    const b = await h.taoPhieu({ ngayNhan: '2026-11-14' })
    await h.suaSai.luiNgay(a.id, { ngayNhan: '2026-11-08' }, 'x')
    expect(await quyTac(h)).toEqual([])
    await h.suaSai.luiNgay(b.id, { ngayNhan: '2026-11-07' }, 'x')
    expect(await quyTac(h)).toEqual(['lui-ngay-qua-nguong'])
  })

  it('lùi ngày theo ngưỡng chỉnh được', async () => {
    const h = lap('2026-11-15T09:00:00')
    const a = await h.taoPhieu({ ngayNhan: '2026-11-14' })
    await h.suaSai.capNhatCaiDat({ nguong: { luiNgayQuaNgay: 2 } }, 'siết chặt')
    await h.suaSai.luiNgay(a.id, { ngayNhan: '2026-11-13' }, 'x')
    expect(await quyTac(h)).toEqual([])
    await h.suaSai.luiNgay(a.id, { ngayNhan: '2026-11-12' }, 'x')
    expect(await quyTac(h)).toEqual(['lui-ngay-qua-nguong'])
  })

  it('giảm tổng tiền: đúng 30% thì chưa, quá 30% thì bị đánh dấu', async () => {
    const h = lap()
    const p = await h.taoPhieu({ tien: 100000 })
    await h.suaSai.sua(p.id, { tongTien: 70000 }, 'x') // giảm đúng 30%
    expect(await quyTac(h)).toEqual([])
    await h.suaSai.sua(p.id, { tongTien: 48999 }, 'x') // 70000 -> 48999: giảm hơn 30%
    expect(await quyTac(h)).toEqual(['giam-tong-tien-qua-nguong'])
    await h.suaSai.sua(p.id, { tongTien: 90000 }, 'x') // tăng thì không
    expect(await quyTac(h)).toEqual(['giam-tong-tien-qua-nguong'])
  })

  it('hơn 5 thay đổi trong một ngày của một người: thay đổi thứ 6 bị đánh dấu', async () => {
    const h = lap('2026-11-15T08:00:00')
    const p = await h.taoPhieu()
    for (let i = 1; i <= 5; i += 1) await h.suaSai.sua(p.id, { moTa: `lần ${i}` }, 'x')
    expect(await quyTac(h)).toEqual([])
    await h.suaSai.sua(p.id, { moTa: 'lần 6' }, 'x')
    expect(await quyTac(h)).toEqual(['qua-nhieu-thay-doi-trong-ngay'])
    // người khác cùng ngày, và cùng người sang ngày khác: đếm lại từ đầu
    await h.suaSai.datNguoiHienTai('me')
    await h.suaSai.sua(p.id, { moTa: 'mẹ sửa' }, 'x')
    h.datGio('2026-11-16T08:00:00')
    await h.suaSai.sua(p.id, { moTa: 'hôm sau' }, 'x')
    expect(await quyTac(h)).toEqual(['qua-nhieu-thay-doi-trong-ngay'])
  })

  it('tháng đã khóa: mặc định tắt thì không đánh dấu; bật thì mức cao', async () => {
    const h = lap('2026-11-15T09:00:00')
    const p = await h.taoPhieu({ ngayNhan: '2026-10-20' })
    await h.suaSai.capNhatCaiDat({ khoaThang: { cacThang: ['2026-10'] } }, 'chốt sổ tháng 10') // vẫn tắt
    await h.suaSai.sua(p.id, { moTa: 'a' }, 'x')
    expect(await quyTac(h)).toEqual([])
    await h.suaSai.capNhatCaiDat({ khoaThang: { bat: true } }, 'bật khóa')
    await h.suaSai.sua(p.id, { moTa: 'b' }, 'x')
    const khac = await h.taoPhieu({ ngayNhan: '2026-11-02' })
    await h.suaSai.sua(khac.id, { moTa: 'c' }, 'x')
    const nk = (await h.suaSai.nhatKy()).filter((n) => n.batThuong.length > 0)
    expect(nk).toHaveLength(1)
    expect(nk[0]?.batThuong[0]).toMatchObject({ quyTac: 'thang-da-khoa', mucDo: 'cao' })
    expect(nk[0]?.phieuId).toBe(p.id)
  })
})

describe('xem lại thay đổi theo tuần', () => {
  it('bất thường lên đầu, chỉ lấy đúng tuần (thứ Hai đến Chủ Nhật), đánh dấu đã xem từng mục hoặc cả tuần', async () => {
    const h = lap('2026-11-09T08:00:00') // thứ Hai
    const a = await h.taoPhieu()
    const b = await h.taoPhieu({ tien: 1000, tra: { ngayTra: '2026-11-10', pt: 'tien-mat' } })
    await h.suaSai.sua(a.id, { moTa: 'thường' }, 'x')
    h.datGio('2026-11-10T09:00:00')
    await h.suaSai.huy(b.id, 'nhầm tiền mặt') // bất thường cao
    h.datGio('2026-11-12T09:00:00')
    await h.suaSai.sua(a.id, { moTa: 'thường 2' }, 'x')
    h.datGio('2026-11-16T09:00:00') // tuần sau
    await h.suaSai.sua(a.id, { moTa: 'tuần sau' }, 'x')

    const tuan = await h.suaSai.xemLaiTuan('2026-11-14')

    expect([tuan.tuNgay, tuan.denNgay]).toEqual(['2026-11-09', '2026-11-15'])
    expect(tuan.muc.map((m) => `${m.nhatKy.loai}@${m.nhatKy.luc}`)).toEqual([
      'huy@2026-11-10T09:00:00',
      'sua@2026-11-12T09:00:00',
      'sua@2026-11-09T08:00:00',
    ])
    expect(tuan.muc[0]?.nhatKy.batThuong).toHaveLength(1)
    expect(tuan.soChuaXem).toBe(3)
    expect(await h.suaSai.soChuaXem()).toBe(4)

    await h.suaSai.danhDauDaXem(tuan.muc[0]!.nhatKy.id)
    await h.suaSai.danhDauDaXem(tuan.muc[0]!.nhatKy.id) // lặp lại không sao
    expect((await h.suaSai.xemLaiTuan('2026-11-09')).muc[0]?.daXem).toMatchObject({ nguoi: { id: 'chu' } })
    expect(await h.suaSai.soChuaXem()).toBe(3)

    expect(await h.suaSai.danhDauDaXemTuan('2026-11-09')).toBe(2)
    expect((await h.suaSai.xemLaiTuan('2026-11-09')).soChuaXem).toBe(0)
    expect(await h.suaSai.soChuaXem()).toBe(1)
    await expect(h.suaSai.danhDauDaXem('N9999')).rejects.toMatchObject({ ma: 'KHONG_TIM_THAY' })
  })
})

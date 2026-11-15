import { describe, expect, it } from 'vitest'
import { tongHopThu } from './bao-cao.ts'
import { doChuaLay, NGUONG_MAC_DINH } from './danh-sach-phieu.ts'
import { taoDichVuKhach } from './khach-service.ts'
import { taoKhoKhachTrongBoNho } from './kho-khach.ts'
import { taoKhoDichVuTrongBoNho } from './kho-dich-vu.ts'
import { taoKhoPhieuTrongBoNho } from './kho-trong-bo-nho.ts'
import { chuyenKiotViet } from './kiotviet-chuyen.ts'
import type { GoiNhapLichSu } from './kiotviet-goi.ts'
import { boKiotVietGia } from './kiotviet.thu.ts'
import { taoDichVuNhapLichSu } from './nhap-lich-su.ts'
import { taoDichVuPhieu } from './phieu-service.ts'
import { taoKhoCaiDatTrongBoNho, taoKhoNhatKyTrongBoNho } from './nhat-ky-phieu.ts'
import { taoDichVuSuaSai } from './sua-sai-service.ts'

// Seam: dịch vụ nhập lịch sử (kiemTra, nhap) trên kho giả trong bộ nhớ, quan sát qua dịch vụ phiếu, khách và báo cáo thu.
function lap() {
  const khoPhieu = taoKhoPhieuTrongBoNho()
  const khoKhach = taoKhoKhachTrongBoNho()
  const khoDichVu = taoKhoDichVuTrongBoNho()
  const khach = taoDichVuKhach({ khoKhach, khoPhieu, homNay: () => '2026-11-15' })
  const phieu = taoDichVuPhieu({ kho: khoPhieu, khach })
  const nhap = taoDichVuNhapLichSu({ khoPhieu, khoKhach, khoDichVu, homNay: () => '2026-11-15' })
  const suaSai = taoDichVuSuaSai({
    kho: khoPhieu,
    phieu,
    khach,
    khoNhatKy: taoKhoNhatKyTrongBoNho(),
    khoCaiDat: taoKhoCaiDatTrongBoNho(),
    dongHo: () => '2026-11-15T09:30:00',
  })
  return { khoPhieu, khoKhach, khoDichVu, khach, phieu, nhap, suaSai }
}

const goi = (): GoiNhapLichSu => chuyenKiotViet(boKiotVietGia())
const KHOANG = { tuNgay: '2026-01-01', denNgay: '2026-12-31' }

describe('kiểm tra trước khi nhập', () => {
  it('cho biết số liệu của gói và số bản ghi mới, không ghi gì vào kho', async () => {
    const h = lap()
    const kt = await h.nhap.kiemTra(goi())
    expect(kt).toMatchObject({
      soPhieuDaTra: 3,
      soPhieuChuaThanhToan: 1,
      soKhach: 5,
      soDichVu: 4,
      tienMat: 238000,
      chuyenKhoan: 60000,
      soNhapSaiQuyTrinh: 1,
      soKhachLe: 1,
      moi: { phieu: 4, khach: 5, dichVu: 4 },
      daCo: { phieu: 0, khach: 0, dichVu: 0 },
    })
    expect(kt.loi).toEqual([])
    expect(await h.phieu.danhSach()).toEqual([])
    expect(await h.khach.danhSach()).toEqual([])
    expect(await h.khoDichVu.tatCa()).toEqual([])
  })

  it('tính lại từ nội dung gói, không tin con số báo cáo ghi sẵn trong gói', async () => {
    const g = goi()
    g.baoCao.tienMat = 1
    g.baoCao.soPhieuDaTra = 999
    const kt = await lap().nhap.kiemTra(g)
    expect(kt.tienMat).toBe(238000)
    expect(kt.soPhieuDaTra).toBe(3)
  })

  it('chặn khi phiếu trỏ tới khách không có trong gói, mã hóa đơn lặp, hoặc ngày trả trước ngày nhận', async () => {
    const g = goi()
    g.phieu[0]!.khachMaCu = 'KH-LA'
    g.phieu.push({ ...g.phieu.find((p) => p.maHoaDonCu === 'HD000002')! })
    const sai = g.phieu.find((p) => p.maHoaDonCu === 'HD000001')!
    sai.ngayNhan = '2026-12-30'
    const loi = (await lap().nhap.kiemTra(g)).loi.join('\n')
    expect(loi).toContain('KH-LA')
    expect(loi).toContain('HD000002')
    expect(loi).toContain('HD000001')
  })
})

describe('nhập lịch sử', () => {
  it('cần xác nhận rõ ràng; thiếu xác nhận thì không ghi gì', async () => {
    const h = lap()
    await expect(h.nhap.nhap(goi(), { xacNhan: false as unknown as true })).rejects.toMatchObject({
      ma: 'DU_LIEU_KHONG_HOP_LE',
    })
    expect(await h.phieu.danhSach()).toEqual([])
  })

  it('không nhập khi gói có lỗi chặn', async () => {
    const h = lap()
    const g = goi()
    g.phieu[0]!.khachMaCu = 'KH-LA'
    await expect(h.nhap.nhap(g, { xacNhan: true })).rejects.toMatchObject({ ma: 'DU_LIEU_KHONG_HOP_LE' })
    expect(await h.phieu.danhSach()).toEqual([])
    expect(await h.khach.danhSach()).toEqual([])
  })

  it('phiếu đã trả vào đúng nhãn, số tiền KiotViet được giữ, thu tách tiền mặt và chuyển khoản theo ngày trả', async () => {
    const h = lap()
    const kq = await h.nhap.nhap(goi(), { xacNhan: true })
    expect(kq).toMatchObject({ phieuMoi: 4, khachMoi: 5, khachLeMoi: 1, dichVuMoi: 4, phieuDaCo: 0, khachDaCo: 0, dichVuDaCo: 0 })
    const ds = await h.phieu.danhSach()
    expect(ds.filter((p) => p.nhan === 'Đã trả')).toHaveLength(3)
    expect(ds.filter((p) => p.nhan === 'Chờ trả khách')).toHaveLength(1)
    expect(tongHopThu(ds, KHOANG)).toEqual({ soPhieu: 3, tongTien: 298000, tienMat: 238000, chuyenKhoan: 60000 })
    const p1 = ds.find((p) => p.maHoaDonCu === 'HD000001')!
    expect(p1).toMatchObject({
      ngayNhan: '2026-10-01',
      ngayTra: '2026-10-04',
      tongTien: 98000,
      phuongThuc: 'tien-mat',
      nguonNgayTra: 'gio-nhap-kiotviet',
      maDatHangCu: 'DH000001',
    })
    expect(p1.dongCu).toHaveLength(2)
    expect(p1.nguon).toBe('kiotviet')
  })

  it('hóa đơn không qua phiếu đặt hàng: ngày nhận trống, gắn nhãn nhập sai quy trình, vẫn tính vào thu, gắn khách lẻ', async () => {
    const h = lap()
    await h.nhap.nhap(goi(), { xacNhan: true })
    const p = (await h.phieu.danhSach()).find((x) => x.maHoaDonCu === 'HD000003')!
    expect(p).toMatchObject({ ngayNhan: '', nguon: 'nhap-sai-quy-trinh', nhan: 'Đã trả', tongTien: 140000 })
    expect(p.khach.ten).toBe('Khách lẻ (KiotViet)')
    expect(tongHopThu([p], KHOANG).tienMat).toBe(140000)
  })

  it('phiếu tạm thành phiếu chưa thanh toán kèm số ngày kể từ ngày nhận', async () => {
    const h = lap()
    await h.nhap.nhap(goi(), { xacNhan: true })
    const tam = (await h.phieu.danhSach()).find((p) => p.maDatHangCu === 'DH000003')!
    expect(tam).toMatchObject({ nhan: 'Chờ trả khách', tongTien: 50000, ngayNhan: '2026-10-20' })
    const muc = doChuaLay([tam], '2026-11-15', NGUONG_MAC_DINH)
    expect(muc[0]).toMatchObject({ soNgay: 26, quaNguong: true })
  })

  it('khách: đủ 5 khách, số hợp lệ bỏ khoảng trắng, số sai giữ nguyên và bị đánh dấu, khách chưa mua vẫn giữ', async () => {
    const h = lap()
    await h.nhap.nhap(goi(), { xacNhan: true })
    const ds = await h.khach.danhSach()
    const theoMa = (m: string) => ds.find((k) => k.maCu === m)!
    expect(ds.filter((k) => k.maCu !== undefined)).toHaveLength(5)
    expect(theoMa('KH000001')).toMatchObject({ soDienThoai: '0900000001', dungDuocSo: true, nguon: 'kiotviet', ngayTao: '2026-09-01' })
    expect(theoMa('KH000002')).toMatchObject({ soDienThoai: '0900000002', dungDuocSo: true })
    expect(theoMa('KH000003')).toMatchObject({ soDienThoai: '09000003', dungDuocSo: false })
    expect(theoMa('KH000004')).toMatchObject({ soDienThoai: 'gần chợ giả', dungDuocSo: false })
    expect(theoMa('KH000005').soDienThoai).toBeUndefined()
    expect((await h.khach.canBoSung()).map((k) => k.maCu).sort()).toEqual(['KH000003', 'KH000004', 'KH000005', undefined])
  })

  it('dịch vụ thành thực thể trong kho, mã hàng là mã, giá vốn để trống, quy tắc tối thiểu và cảnh báo được gắn', async () => {
    const h = lap()
    await h.nhap.nhap(goi(), { xacNhan: true })
    const ds = await h.khoDichVu.tatCa()
    expect(ds).toHaveLength(4)
    const topper = ds.find((d) => d.ma === 'SP000023')!
    expect(topper).toMatchObject({
      id: 'SP000023',
      kieu: 'kg',
      donGia: 35000,
      toiThieu: { duoiKg: 3, tien: 100000 },
      canhBaoTuKg: 6,
      maCu: 'SP000023',
      dangDung: true,
    })
    expect(topper.giaVon).toBeUndefined()
  })

  it('chạy lại cùng gói không tạo phiếu, khách hay dịch vụ trùng', async () => {
    const h = lap()
    await h.nhap.nhap(goi(), { xacNhan: true })
    const lan2 = await h.nhap.nhap(goi(), { xacNhan: true })
    expect(lan2).toMatchObject({ phieuMoi: 0, khachMoi: 0, khachLeMoi: 0, dichVuMoi: 0, phieuDaCo: 4, khachDaCo: 5, dichVuDaCo: 4 })
    expect(await h.phieu.danhSach()).toHaveLength(4)
    expect(await h.khach.danhSach()).toHaveLength(6)
    expect(await h.khoDichVu.tatCa()).toHaveLength(4)
    expect((await h.nhap.kiemTra(goi())).moi).toEqual({ phieu: 0, khach: 0, dichVu: 0 })
  })

  it('chạy lại không ghi đè chỗ anh đã sửa sau khi nhập', async () => {
    const h = lap()
    await h.nhap.nhap(goi(), { xacNhan: true })
    const k = (await h.khach.danhSach()).find((x) => x.maCu === 'KH000003')!
    await h.khach.capNhat(k.id, { soDienThoai: '0900000003' })
    await h.nhap.nhap(goi(), { xacNhan: true })
    const sau = (await h.khach.danhSach()).find((x) => x.maCu === 'KH000003')!
    expect(sau).toMatchObject({ soDienThoai: '0900000003', dungDuocSo: true })
  })

  it('chạy lại với gói có thêm hóa đơn mới thì chỉ thêm phần mới', async () => {
    const h = lap()
    await h.nhap.nhap(goi(), { xacNhan: true })
    const g = goi()
    g.phieu.push({ ...g.phieu.find((p) => p.maHoaDonCu === 'HD000002')!, maHoaDonCu: 'HD000099' })
    const kq = await h.nhap.nhap(g, { xacNhan: true })
    expect(kq).toMatchObject({ phieuMoi: 1, phieuDaCo: 4 })
    expect(await h.phieu.danhSach()).toHaveLength(5)
  })
  it('phiếu lịch sử chưa biết ngày nhận vẫn sửa sai được (có lý do và nhật ký), và không làm đầy nhật ký lúc nhập', async () => {
    const h = lap()
    await h.nhap.nhap(goi(), { xacNhan: true })
    expect(await h.suaSai.nhatKy()).toEqual([])
    const p = (await h.phieu.danhSach()).find((x) => x.maHoaDonCu === 'HD000003')!
    const sua = await h.suaSai.sua(p.id, { tongTien: 150000 }, 'KiotViet ghi thiếu 10.000')
    expect(sua).toMatchObject({ tongTien: 150000, ngayNhan: '', maHoaDonCu: 'HD000003' })
    expect(await h.suaSai.nhatKy()).toHaveLength(1)
  })
})

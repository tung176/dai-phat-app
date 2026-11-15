import { beforeEach, describe, expect, it } from 'vitest'
import { createFakeFetch, createScript, type KichBanGia } from '../../tools/fakegas.mjs'
import { tuDong } from './dong-phieu.ts'
import { taoDichVuKhach } from './khach-service.ts'
import { taoHeKhoSheets } from './kho-sheets.ts'
import { docMaCaiDat, taoMaCaiDat, type CauHinhSheets } from './ma-cai-dat.ts'
import { taoDichVuPhieu } from './phieu-service.ts'
import { taoDichVuSuaSai } from './sua-sai-service.ts'

// Các trường mới của ticket 05 (da-huy, xóa mềm, thay thế, nhật ký, đã xem, cài đặt) phải đi qua Sheet và về nguyên vẹn.
// Dữ liệu và mã bí mật đều là giả, sinh ngẫu nhiên lúc chạy.
const DIA_CHI = 'https://script.google.com/macros/s/GIA-LAP-KHONG-THAT/exec'
const MA = `gia-${crypto.randomUUID()}`
const CAU_HINH: CauHinhSheets = docMaCaiDat(taoMaCaiDat({ diaChi: DIA_CHI, maBiMat: MA }))!

let kb: KichBanGia
let mang: ReturnType<typeof createFakeFetch>
beforeEach(() => {
  kb = createScript('apps-script/Code.gs', { properties: { MA_BI_MAT: MA } })
  mang = createFakeFetch(kb, DIA_CHI)
})

function mayMoi(batDau = '2026-11-15T09:30:00') {
  let gio = batDau
  const dem: Record<string, number> = {}
  const he = taoHeKhoSheets({
    cauHinh: () => CAU_HINH,
    fetch: mang.fetch,
    tuDong: false,
    taoId: (t) => {
      dem[t] = (dem[t] ?? 0) + 1
      return `${t}2026-${String(dem[t]).padStart(3, '0')}`
    },
    bayGio: () => 1_700_000_000_000,
  })
  const khach = taoDichVuKhach({ khoKhach: he.khach, khoPhieu: he.phieu, homNay: () => gio.slice(0, 10) })
  const phieu = taoDichVuPhieu({ kho: he.phieu, khach })
  const suaSai = taoDichVuSuaSai({
    kho: he.phieu,
    phieu,
    khach,
    khoNhatKy: he.nhatKyPhieu,
    khoCaiDat: he.caiDatPhieu,
    dongHo: () => gio,
  })
  return { he, phieu, suaSai, datGio: (g: string) => (gio = g) }
}

describe('đồng bộ các trường của ticket 05 qua Google Sheet', () => {
  it('phiếu hủy, xóa mềm, thay thế cùng nhật ký, đã xem và cài đặt về nguyên vẹn ở máy khác', async () => {
    const a = mayMoi()
    const p1 = await a.phieu.nhanDo({ tenKhach: 'Khách Mẫu A', ngayNhan: '2026-11-10', moTa: 'túi 1' })
    const p2 = await a.phieu.nhanDo({ tenKhach: 'Khách Mẫu B', ngayNhan: '2026-11-10', moTa: 'túi 2' })
    await a.phieu.chotTien(p2.id, 50000)
    await a.phieu.traKhach(p2.id, { ngayTra: '2026-11-12', phuongThuc: 'tien-mat' })
    const p3 = await a.phieu.nhanDo({ tenKhach: 'Khách Mẫu C', ngayNhan: '2026-11-11', moTa: 'túi 3' })

    const { moi } = await a.suaSai.thayThe(p1.id, { moTa: 'túi 1 (đúng)' }, 'ghi sai mô tả')
    await a.suaSai.huy(p2.id, 'khách không lấy') // đã trả tiền mặt: bất thường cao
    await a.suaSai.xoaMem(p3.id, 'nhập trùng')
    await a.suaSai.capNhatCaiDat({ congTac: { luiNgay: false }, khoaThang: { bat: true, cacThang: ['2026-10'] } }, 'thử')
    await a.suaSai.datNguoiHienTai('me')
    const [dau] = await a.suaSai.nhatKy()
    await a.suaSai.danhDauDaXem(dau!.id)
    await a.he.dongBo.dongBo()
    expect(a.he.dongBo.trangThai()).toMatchObject({ kieu: 'da-dong-bo', choGui: 0 })

    const b = mayMoi()
    await b.he.dongBo.dongBo()

    expect(await b.phieu.danhSachDayDu()).toEqual(await a.phieu.danhSachDayDu())
    const day = await b.phieu.danhSachDayDu()
    expect(day.find((p) => p.id === p1.id)).toMatchObject({ nhan: 'Đã hủy', thayTheBoi: moi.id })
    expect(day.find((p) => p.id === moi.id)).toMatchObject({ thayTheCho: p1.id, nhan: 'Chưa tính tiền' })
    expect(day.find((p) => p.id === p2.id)).toMatchObject({ nhan: 'Đã hủy', ngayTra: '2026-11-12', phuongThuc: 'tien-mat' })
    expect(day.find((p) => p.id === p3.id)?.daXoa).toBe(true)
    expect((await b.phieu.danhSach()).map((p) => p.id)).not.toContain(p3.id)

    expect(await b.suaSai.nhatKy()).toEqual(await a.suaSai.nhatKy())
    expect((await b.suaSai.nhatKy()).map((n) => n.loai)).toEqual([
      'thay-the',
      'huy',
      'xoa-mem',
      'doi-cai-dat',
      'doi-nguoi-dung',
    ])
    expect((await b.suaSai.nhatKy())[1]?.batThuong[0]).toMatchObject({ quyTac: 'huy-hoac-xoa-da-tra-tien-mat' })
    expect(await b.suaSai.caiDat()).toEqual(await a.suaSai.caiDat())
    expect((await b.suaSai.nguoiHienTai()).id).toBe('me')
    expect(await b.suaSai.soChuaXem()).toBe(4)
    expect((await b.suaSai.xemLaiTuan('2026-11-15')).muc.filter((m) => m.daXem)).toHaveLength(1)
    // máy khác bị tắt "lùi ngày" theo cài đặt chung
    const p = await b.phieu.nhanDo({ tenKhach: 'Khách Mẫu D', ngayNhan: '2026-11-14', moTa: 'x' })
    await expect(b.suaSai.luiNgay(p.id, { ngayNhan: '2026-11-13' }, 'x')).rejects.toMatchObject({ ma: 'CHUC_NANG_TAT' })
  })

  it('đọc được dòng phiếu cũ 11 cột (trước ticket 05) mà không mất dữ liệu', () => {
    const cu = tuDong(['P1', 'K1', '2026-11-01', 'đồ', '', '', '', '', 'chua-thanh-toan', '', '1'])
    expect(cu).toEqual({ id: 'P1', khachId: 'K1', ngayNhan: '2026-11-01', moTa: 'đồ', trangThai: 'chua-thanh-toan' })
  })
})

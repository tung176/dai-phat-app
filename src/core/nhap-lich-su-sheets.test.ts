import { beforeEach, describe, expect, it } from 'vitest'
import { createFakeFetch, createScript, type KichBanGia } from '../../tools/fakegas.mjs'
import { tongHopThu } from './bao-cao.ts'
import { taoDichVuKhach } from './khach-service.ts'
import { taoHeKhoSheets } from './kho-sheets.ts'
import { chuyenKiotViet } from './kiotviet-chuyen.ts'
import type { GoiNhapLichSu } from './kiotviet-goi.ts'
import { boKiotVietGia } from './kiotviet.thu.ts'
import { taoMaCaiDat, docMaCaiDat, type CauHinhSheets } from './ma-cai-dat.ts'
import { taoDichVuNhapLichSu } from './nhap-lich-su.ts'
import { taoDichVuPhieu } from './phieu-service.ts'

// Seam thứ hai: nhập lịch sử qua bộ chuyển Google Sheets, nói chuyện với Code.gs thật chạy trong Apps Script giả lập.
const DIA_CHI = 'https://script.google.com/macros/s/GIA-LAP-KHONG-THAT/exec'
const MA = `gia-${crypto.randomUUID()}`
const CAU_HINH: CauHinhSheets = docMaCaiDat(taoMaCaiDat({ diaChi: DIA_CHI, maBiMat: MA }))!

let kb: KichBanGia
let mang: ReturnType<typeof createFakeFetch>
beforeEach(() => {
  kb = createScript('apps-script/Code.gs', { properties: { MA_BI_MAT: MA } })
  mang = createFakeFetch(kb, DIA_CHI)
})

function mayMoi(tuDong = false) {
  const he = taoHeKhoSheets({
    cauHinh: () => CAU_HINH,
    fetch: mang.fetch,
    tuDong,
    bayGio: () => 1_700_000_000_000,
  })
  const khach = taoDichVuKhach({ khoKhach: he.khach, khoPhieu: he.phieu, homNay: () => '2026-11-15' })
  return {
    he,
    khach,
    phieu: taoDichVuPhieu({ kho: he.phieu, khach }),
    nhap: taoDichVuNhapLichSu({ khoPhieu: he.phieu, khoKhach: he.khach, khoDichVu: he.dichVu, homNay: () => '2026-11-15' }),
  }
}

const goi = (): GoiNhapLichSu => chuyenKiotViet(boKiotVietGia())
const soDong = (tab: string) => kb.sheets.get(tab)?.getLastRow() ?? 0
const o = (tab: string, hang: number, cot: number) => kb.sheets.get(tab)!.get(hang, cot)

describe('nhập lịch sử qua Google Sheet', () => {
  it('phiếu, khách và dịch vụ lên Sheet kèm các cột mới; máy khác kéo về đọc lại đúng', async () => {
    const a = mayMoi()
    await a.nhap.nhap(goi(), { xacNhan: true })
    await a.he.dongBo.dongBo()
    expect(a.he.dongBo.trangThai()).toMatchObject({ kieu: 'da-dong-bo', choGui: 0 })
    expect(soDong('Phiếu')).toBe(1 + 4)
    expect(soDong('Khách')).toBe(1 + 6) // 5 khách trong file + khách lẻ giữ chỗ
    expect(soDong('Dịch vụ')).toBe(1 + 4)

    const hang = [2, 3, 4, 5].find((r) => o('Phiếu', r, 15) === 'HD000003')!
    expect(o('Phiếu', hang, 17)).toBe('TRUE') // Nhập sai quy trình
    expect(o('Phiếu', hang, 18)).toBe('gio-nhap-kiotviet')
    expect(String(o('Phiếu', hang, 19))).toContain('SP000001')

    const b = mayMoi()
    await b.he.dongBo.dongBo()
    expect(await b.phieu.danhSach()).toEqual(await a.phieu.danhSach())
    expect(await b.khach.danhSach()).toEqual(await a.khach.danhSach())
    expect(await b.he.dichVu.tatCa()).toEqual(await a.he.dichVu.tatCa())
    const ds = await b.phieu.danhSach()
    expect(tongHopThu(ds, { tuNgay: '2026-01-01', denNgay: '2026-12-31' })).toMatchObject({ tienMat: 238000, chuyenKhoan: 60000 })
    const topper = (await b.he.dichVu.tatCa()).find((d) => d.ma === 'SP000023')!
    expect(topper).toMatchObject({ toiThieu: { duoiKg: 3, tien: 100000 }, canhBaoTuKg: 6, kieu: 'kg', dangDung: true })
    expect(topper.giaVon).toBeUndefined()
  })

  it('nhập lại cùng gói rồi đồng bộ không thêm dòng nào trên Sheet', async () => {
    const a = mayMoi()
    await a.nhap.nhap(goi(), { xacNhan: true })
    await a.he.dongBo.dongBo()
    await a.nhap.nhap(goi(), { xacNhan: true })
    await a.he.dongBo.dongBo()
    expect(soDong('Phiếu')).toBe(5)
    expect(soDong('Khách')).toBe(7)
    expect(soDong('Dịch vụ')).toBe(5)

    // Máy khác (bản đệm trống) kéo về rồi nhập lại cũng nhận ra là đã có.
    const b = mayMoi()
    await b.he.dongBo.dongBo()
    const kq = await b.nhap.nhap(goi(), { xacNhan: true })
    expect(kq).toMatchObject({ phieuMoi: 0, khachMoi: 0, khachLeMoi: 0, dichVuMoi: 0 })
    await b.he.dongBo.dongBo()
    expect(soDong('Phiếu')).toBe(5)
  })

  it('lô lớn chỉ đồng bộ vài lượt, không mỗi bản ghi một lượt', async () => {
    const g = goi()
    const mau = g.phieu.find((p) => p.maHoaDonCu === 'HD000002')!
    for (let i = 0; i < 450; i++) g.phieu.push({ ...mau, maHoaDonCu: `HD1${String(i).padStart(5, '0')}`, maDatHangCu: undefined })
    const a = mayMoi(true) // đồng bộ tự động bật như app thật
    await a.nhap.nhap(g, { xacNhan: true })
    await a.he.dongBo.dongBo()
    expect(soDong('Phiếu')).toBe(1 + 4 + 450)
    expect(mang.trangThai.soLanGoi).toBeLessThan(60)
  })

  it('đọc được dòng Phiếu và Khách cũ (trước ticket 07) còn thiếu cột mới', async () => {
    const dongCu = ['P1', 'K1', '2026-11-01', 'đồ', '', '', '', '', 'chua-thanh-toan', '', '1', '', '', '']
    kb.post({ secret: MA, action: 'ping' })
    const sh = kb.sheets.get('Phiếu')!
    dongCu.forEach((v, i) => (sh as unknown as { set(r: number, c: number, v: string): void }).set(2, i + 1, v))
    const kh = kb.sheets.get('Khách')!
    ;['K1', 'Khách Mẫu', '', '', 'chua-hoi', 'nhap-tay', '2026-11-01', '', '1'].forEach((v, i) =>
      (kh as unknown as { set(r: number, c: number, v: string): void }).set(2, i + 1, v),
    )
    const a = mayMoi()
    await a.he.dongBo.dongBo()
    expect(await a.phieu.danhSach()).toHaveLength(1)
    expect((await a.phieu.danhSach())[0]!.maHoaDonCu).toBeUndefined()
  })
})

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createFakeFetch, createScript, type KichBanGia } from '../../tools/fakegas.mjs'
import { taoBangDemTrongBoNho } from './bang-dem.ts'
import { bangGiaGia } from './bang-gia-gia.ts'
import { taoDichVuKhach } from './khach-service.ts'
import type { BanGhiKhach, NhatKyGop } from './khach.ts'
import { taoHeKhoSheets, type TuyChonHeKhoSheets } from './kho-sheets.ts'
import { taoMaCaiDat, docMaCaiDat, type CauHinhSheets } from './ma-cai-dat.ts'
import { taoDichVuPhieu } from './phieu-service.ts'
import type { BanGhiPhieu } from './types.ts'

// Kiểm thử bộ chuyển lưu trữ qua các cổng KhoPhieu và KhoKhach, nói chuyện với Code.gs thật chạy trong Apps Script giả lập.
// Dữ liệu và mã bí mật đều là giả, sinh ngẫu nhiên lúc chạy.
const DIA_CHI = 'https://script.google.com/macros/s/GIA-LAP-KHONG-THAT/exec'
const MA = `gia-${crypto.randomUUID()}`
const SAI = 'ma-sai-khong-dung-0000'
const CAU_HINH: CauHinhSheets = docMaCaiDat(taoMaCaiDat({ diaChi: DIA_CHI, maBiMat: MA }))!

let kb: KichBanGia
let mang: ReturnType<typeof createFakeFetch>

beforeEach(() => {
  kb = createScript('apps-script/Code.gs', { properties: { MA_BI_MAT: MA } })
  mang = createFakeFetch(kb, DIA_CHI)
})

type BangDemBo = NonNullable<TuyChonHeKhoSheets['bangDem']>
const bangDemMoi = (): BangDemBo => ({
  phieu: taoBangDemTrongBoNho<BanGhiPhieu>(),
  khach: taoBangDemTrongBoNho<BanGhiKhach>(),
  nhatKy: taoBangDemTrongBoNho<NhatKyGop>(),
})

function mayMoi(tuy: { cauHinh?: CauHinhSheets | null; bangDem?: BangDemBo } = {}) {
  const bangDem = tuy.bangDem ?? bangDemMoi()
  let cauHinh: CauHinhSheets | null = tuy.cauHinh === undefined ? CAU_HINH : tuy.cauHinh
  const dem: Record<string, number> = {}
  const he = taoHeKhoSheets({
    bangDem,
    cauHinh: () => cauHinh,
    fetch: mang.fetch,
    tuDong: false,
    taoId: (t) => {
      dem[t] = (dem[t] ?? 0) + 1
      return `${t}2026-T${String(dem[t]).padStart(3, '0')}`
    },
    bayGio: () => 1_700_000_000_000,
  })
  const khach = taoDichVuKhach({ khoKhach: he.khach, khoPhieu: he.phieu, homNay: () => '2026-11-10' })
  return {
    kho: he.dongBo,
    bangDem,
    khach,
    dv: taoDichVuPhieu({ kho: he.phieu, khach }),
    datCauHinh: (c: CauHinhSheets | null) => {
      cauHinh = c
    },
  }
}

const khach = { tenKhach: 'Khách Mẫu A', ngayNhan: '2026-11-01', moTa: '1 túi quần áo', soDienThoai: '0900000001' }
const soDong = (tab: string) => kb.sheets.get(tab)?.getLastRow() ?? 0
const soDongPhieu = () => soDong('Phiếu')

describe('lưu và đọc lại qua Google Sheet', () => {
  it('phiếu nhận, chốt tiền, trả khách đều lên Sheet và máy khác đọc lại đúng', async () => {
    const a = mayMoi()
    const p = await a.dv.nhanDo({ ...khach, ghiChu: 'tầng 2' })
    await a.dv.chotTien(p.id, 120000)
    await a.dv.traKhach(p.id, { ngayTra: '2026-11-05', phuongThuc: 'chuyen-khoan' })
    await a.kho.dongBo()
    expect(a.kho.trangThai()).toMatchObject({ kieu: 'da-dong-bo', choGui: 0 })
    expect(soDongPhieu()).toBe(2) // tiêu đề + đúng 1 phiếu

    const b = mayMoi() // máy mới, bản đệm trống
    expect(await b.dv.danhSach()).toEqual([])
    await b.kho.dongBo()
    const ds = await b.dv.danhSach()
    expect(ds).toEqual(await a.dv.danhSach())
    expect(ds[0]).toMatchObject({
      khach: { ten: 'Khách Mẫu A', soDienThoai: '0900000001' },
      ghiChu: 'tầng 2',
      tongTien: 120000,
      ngayTra: '2026-11-05',
      phuongThuc: 'chuyen-khoan',
      nhan: 'Đã trả',
    })
  })

  it('phiếu chưa có tiền/ngày trả/ghi chú đọc lại không bị thêm giá trị thừa', async () => {
    const a = mayMoi()
    await a.dv.nhanDo({ tenKhach: 'Khách Mẫu B', ngayNhan: '2026-11-02', moTa: '2 chăn' })
    await a.kho.dongBo()
    const b = mayMoi()
    await b.kho.dongBo()
    const [p] = await b.dv.danhSach()
    expect(p).toEqual({
      id: 'P2026-T001',
      khachId: 'K2026-T001',
      khach: { id: 'K2026-T001', ten: 'Khách Mẫu B', tenHienThi: 'Khách Mẫu B' },
      ngayNhan: '2026-11-02',
      moTa: '2 chăn',
      trangThai: 'chua-thanh-toan',
      nhan: 'Chưa tính tiền',
    })
  })

  it('số điện thoại bắt đầu bằng 0 giữ nguyên trong Sheet (chữ thuần)', async () => {
    const a = mayMoi()
    await a.dv.nhanDo(khach)
    await a.kho.dongBo()
    expect(kb.sheets.get('Khách')?.get(2, 4)).toBe('0900000001')
  })
})

describe('khách, gộp khách và chi tiết tiền', () => {
  it('khách và phiếu cùng lên Sheet; máy khác đọc lại đủ tên khách và chi tiết tiền', async () => {
    const a = mayMoi()
    const p = await a.dv.nhanDo(khach)
    await a.dv.chotTien(p.id, 120000, {
      dong: [{ dichVu: bangGiaGia.quanAoThuong, kg: 3.5 }],
      phuThu: [{ soTien: 5000, ghiChu: '+5K' }],
    })
    await a.kho.dongBo()
    expect(soDong('Khách')).toBe(2)
    expect(soDong('Phiếu')).toBe(2)

    const b = mayMoi()
    await b.kho.dongBo()
    const [pb] = await b.dv.danhSach()
    expect(pb.khach).toMatchObject({ ten: 'Khách Mẫu A', soDienThoai: '0900000001' })
    expect(pb.chiTietTien?.dong[0]).toMatchObject({ kg: 3.5, dichVu: { ma: 'GIAT-SAY-QA' } })
    expect(pb.chiTietTien?.phuThu).toEqual([{ soTien: 5000, ghiChu: '+5K' }])
    expect(pb).toEqual((await a.dv.danhSach())[0])
  })

  it('gộp khách: nhật ký, khách bị gộp và phiếu đã chuyển đọc lại đúng ở máy khác', async () => {
    const a = mayMoi()
    const k1 = await a.khach.them({ ten: 'Lan Mẫu' })
    const k2 = await a.khach.them({ ten: 'lan mau', soDienThoai: '0900 000 111' })
    await a.dv.nhanDo({ khachId: k2.id, ngayNhan: '2026-11-02', moTa: 'rèm' })
    const kq = await a.khach.gop({ giuLai: k1.id, gopVao: [k2.id], xacNhan: true })
    await a.kho.dongBo()

    const b = mayMoi()
    await b.kho.dongBo()
    expect(await b.khach.nhatKyGop()).toEqual([
      expect.objectContaining({ id: kq.nhatKyId, giuLai: k1.id, gopVao: [k2.id], daHoanTac: false }),
    ])
    expect((await b.dv.danhSach())[0].khach.id).toBe(k1.id)
    expect((await b.khach.lay(k2.id))?.daGopVao).toBe(k1.id)
  })
})

describe('bản đệm để mở nhanh', () => {
  it('mở lại với bản đệm có sẵn thì hiện ngay, không cần gọi mạng', async () => {
    const a = mayMoi()
    await a.dv.nhanDo(khach)
    await a.kho.dongBo()
    const goiTruoc = mang.trangThai.soLanGoi
    const lai = mayMoi({ bangDem: a.bangDem })
    expect(await lai.dv.danhSach()).toHaveLength(1)
    expect(mang.trangThai.soLanGoi).toBe(goiTruoc)
  })
})

describe('mất mạng', () => {
  it('vẫn ghi được, báo đang chờ gửi; có mạng lại thì đẩy đủ, không nhân đôi', async () => {
    const a = mayMoi()
    mang.trangThai.matMang = true
    const p = await a.dv.nhanDo(khach)
    await a.dv.chotTien(p.id, 90000)
    await a.kho.dongBo()
    expect(a.kho.trangThai()).toMatchObject({ kieu: 'cho-mang', choGui: 2 }) // 1 khách + 1 phiếu
    expect((await a.dv.danhSach())[0].tongTien).toBe(90000)
    expect(soDongPhieu()).toBe(0)

    mang.trangThai.matMang = false
    await a.kho.dongBo()
    await a.kho.dongBo() // đồng bộ thừa không được tạo thêm dòng
    expect(a.kho.trangThai()).toMatchObject({ kieu: 'da-dong-bo', choGui: 0 })
    expect(soDongPhieu()).toBe(2)
    expect(soDong('Khách')).toBe(2)
    expect(kb.sheets.get('Phiếu')?.get(2, 6)).toBe('90000')
  })

  it('script đã ghi nhưng phản hồi không về: gửi lại không tạo dòng trùng', async () => {
    const a = mayMoi()
    await a.dv.nhanDo(khach)
    mang.trangThai.matPhanHoi = true
    await a.kho.dongBo()
    expect(a.kho.trangThai()).toMatchObject({ kieu: 'cho-mang', choGui: 2 })
    expect(soDong('Khách')).toBe(2) // khách đã ghi lên Sheet dù phản hồi mất
    mang.trangThai.matPhanHoi = false
    await a.kho.dongBo()
    expect(a.kho.trangThai()).toMatchObject({ kieu: 'da-dong-bo', choGui: 0 })
    expect(soDong('Khách')).toBe(2)
    expect(soDongPhieu()).toBe(2)
  })

  it('máy chủ trả lỗi 500 được coi là chờ mạng và thử lại được', async () => {
    const a = mayMoi()
    await a.dv.nhanDo(khach)
    mang.trangThai.hangDoiLoi = 1
    await a.kho.dongBo()
    expect(a.kho.trangThai().kieu).toBe('cho-mang')
    await a.kho.dongBo()
    expect(a.kho.trangThai().kieu).toBe('da-dong-bo')
  })

  it('đồng bộ kéo bản mới từ máy khác nhưng không đè phiếu mình đang sửa chưa gửi', async () => {
    const a = mayMoi()
    const b = mayMoi()
    const pa = await a.dv.nhanDo(khach)
    await a.kho.dongBo()
    await b.kho.dongBo()
    // b sửa khi đang mất mạng, a sửa và gửi lên trước
    mang.trangThai.matMang = true
    await b.dv.chotTien(pa.id, 70000)
    mang.trangThai.matMang = false
    await a.dv.chotTien(pa.id, 50000)
    await a.kho.dongBo()
    // b đồng bộ: bản của b đang chờ gửi nên được giữ và gửi lên
    await b.kho.dongBo()
    expect((await b.dv.danhSach())[0].tongTien).toBe(70000)
    await a.kho.dongBo()
    expect((await a.dv.danhSach())[0].tongTien).toBe(70000)
  })
})

describe('chưa cài đặt hoặc cài sai', () => {
  it('chưa có mã cài đặt: dùng bình thường trong máy, báo "chưa cài đặt"; cài xong thì tự đẩy lên', async () => {
    const a = mayMoi({ cauHinh: null })
    await a.dv.nhanDo(khach)
    await a.kho.dongBo()
    expect(a.kho.trangThai()).toMatchObject({ kieu: 'chua-cai-dat', choGui: 2 })
    expect(mang.trangThai.soLanGoi).toBe(0)
    a.datCauHinh(CAU_HINH)
    await a.kho.dongBo()
    expect(a.kho.trangThai()).toMatchObject({ kieu: 'da-dong-bo', choGui: 0 })
    expect(soDongPhieu()).toBe(2)
  })

  it('sai mã bí mật: báo lỗi, giữ nguyên hàng đợi, thông báo không lộ mã hay địa chỉ', async () => {
    const a = mayMoi({ cauHinh: { diaChi: DIA_CHI, maBiMat: SAI } })
    await a.dv.nhanDo(khach)
    await a.kho.dongBo()
    const tt = a.kho.trangThai()
    expect(tt).toMatchObject({ kieu: 'loi', choGui: 2 })
    expect(tt.thongBao).toBe('Sai mã bí mật.')
    expect(JSON.stringify(tt)).not.toContain(MA)
    expect(JSON.stringify(tt)).not.toContain('script.google.com')
    a.datCauHinh(CAU_HINH)
    await a.kho.dongBo()
    expect(a.kho.trangThai().kieu).toBe('da-dong-bo')
  })

  it('không bao giờ ghi mã bí mật hay địa chỉ ra console', async () => {
    const chan = (['log', 'info', 'warn', 'error', 'debug'] as const).map((m) =>
      vi.spyOn(console, m).mockImplementation(() => {}),
    )
    const a = mayMoi()
    await a.dv.nhanDo(khach)
    mang.trangThai.matMang = true
    await a.kho.dongBo()
    mang.trangThai.matMang = false
    a.datCauHinh({ diaChi: DIA_CHI, maBiMat: SAI })
    await a.kho.dongBo()
    const ra = JSON.stringify(chan.flatMap((s) => s.mock.calls))
    expect(ra).not.toContain(MA)
    expect(ra).not.toContain('GIA-LAP-KHONG-THAT')
    chan.forEach((s) => s.mockRestore())
  })
})

describe('tự đẩy lên sau mỗi lần ghi', () => {
  afterEach(() => vi.restoreAllMocks())
  it('bật tuDong: ghi xong là hàng đợi tự được gửi', async () => {
    const he = taoHeKhoSheets({ bangDem: bangDemMoi(), cauHinh: () => CAU_HINH, fetch: mang.fetch })
    const kd = taoDichVuKhach({ khoKhach: he.khach, khoPhieu: he.phieu })
    await taoDichVuPhieu({ kho: he.phieu, khach: kd }).nhanDo(khach)
    await he.dongBo.dongBo() // chờ lượt đồng bộ tự động đang chạy xong
    expect(soDongPhieu()).toBe(2)
    expect(soDong('Khách')).toBe(2)
    expect(he.dongBo.trangThai().kieu).toBe('da-dong-bo')
  })

  it('mã phiếu, khách sinh sẵn theo thứ tự thời gian, có tiền tố', async () => {
    const he = taoHeKhoSheets({ bangDem: bangDemMoi(), cauHinh: () => null, tuDong: false })
    const a = await he.phieu.them({ khachId: 'K', ngayNhan: '2026-11-01', moTa: 'x', trangThai: 'chua-thanh-toan' })
    await new Promise((r) => setTimeout(r, 3))
    const b = await he.phieu.them({ khachId: 'K', ngayNhan: '2026-11-01', moTa: 'x', trangThai: 'chua-thanh-toan' })
    expect(a.id).toMatch(/^P\d{4}-[0-9A-Z]+$/)
    expect(a.id < b.id).toBe(true)
  })
})

describe('theo dõi thay đổi', () => {
  it('báo cho giao diện khi trạng thái hoặc dữ liệu đổi', async () => {
    const a = mayMoi()
    const nghe = vi.fn()
    const huy = a.kho.theoDoi(nghe)
    await a.dv.nhanDo(khach)
    expect(nghe).toHaveBeenCalled()
    nghe.mockClear()
    await a.kho.dongBo()
    expect(nghe).toHaveBeenCalled()
    huy()
    nghe.mockClear()
    await a.dv.nhanDo(khach)
    expect(nghe).not.toHaveBeenCalled()
  })
})

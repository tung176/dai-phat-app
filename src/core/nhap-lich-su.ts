import { chuanHoaSoDienThoai, type BanGhiKhach } from './khach.ts'
import type { BanGhiDichVu, KhoDichVu } from './kho-dich-vu.ts'
import type { KhoKhach } from './kho-khach.ts'
import type { KhoPhieu } from './kho-phieu.ts'
import {
  phanLoaiSoDienThoai,
  type BaoCaoGoi,
  type GoiDichVu,
  type GoiKhach,
  type GoiNhapLichSu,
  type GoiPhieu,
  type MucDoiChieu,
} from './kiotviet-goi.ts'
import { ngayHopLe } from './phieu-service.ts'
import { LoiNghiepVu, type BanGhiPhieu, type NgayIso } from './types.ts'

/** Mã khách giữ chỗ cho hóa đơn KiotViet không có mã khách. */
export const MA_KHACH_LE = 'KV-KHACH-LE'
const TEN_KHACH_LE = 'Khách lẻ (KiotViet)'

const maPhieu = (p: GoiPhieu) => `KV-${p.loai === 'da-tra' ? p.maHoaDonCu : p.maDatHangCu}`
const maKhach = (ma: string) => `KV-${ma}`
const maDichVu = (ma: string) => ma

export interface BanKiemTra {
  soPhieuDaTra: number
  soPhieuChuaThanhToan: number
  soKhach: number
  soDichVu: number
  tienMat: number
  chuyenKhoan: number
  soNhapSaiQuyTrinh: number
  soKhachLe: number
  soDienThoai: BaoCaoGoi['soDienThoai']
  /** Bản ghi chưa có trong kho (sẽ được thêm). */
  moi: { phieu: number; khach: number; dichVu: number }
  /** Bản ghi đã có trong kho (bỏ qua, không ghi đè). */
  daCo: { phieu: number; khach: number; dichVu: number }
  doiChieu: MucDoiChieu[]
  canhBao: string[]
  /** Có lỗi thì không nhập được. */
  loi: string[]
}

export interface KetQuaNhap {
  phieuMoi: number
  khachMoi: number
  /** 1 nếu lần này phải tạo khách lẻ giữ chỗ. */
  khachLeMoi: number
  dichVuMoi: number
  phieuDaCo: number
  khachDaCo: number
  dichVuDaCo: number
}

export interface DichVuNhapLichSu {
  /** Đọc gói, báo số liệu và lỗi. Không ghi gì. */
  kiemTra(goi: GoiNhapLichSu): Promise<BanKiemTra>
  /** Ghi các bản ghi chưa có (theo mã KiotViet). Chạy lại không nhân đôi và không ghi đè bản ghi đã có. */
  nhap(goi: GoiNhapLichSu, dauVao: { xacNhan: true }): Promise<KetQuaNhap>
}

function trungMa<T>(ds: T[], ma: (x: T) => string | undefined): string[] {
  const thay = new Set<string>()
  const lap = new Set<string>()
  for (const x of ds) {
    const m = ma(x)
    if (m === undefined) continue
    if (thay.has(m)) lap.add(m)
    thay.add(m)
  }
  return [...lap]
}

function sangKhach(k: GoiKhach): BanGhiKhach {
  const sdt = k.soDienThoai?.trim() ?? ''
  const chuan = chuanHoaSoDienThoai(sdt)
  // Số dùng được thì lưu dạng chuẩn; số sai giữ nguyên như KiotViet để anh tự sửa.
  const luu = chuan.dungDuoc ? chuan.soDienThoai : sdt
  return {
    id: maKhach(k.maCu),
    tenGoc: k.ten,
    ...(luu ? { soDienThoai: luu } : {}),
    dongYNhanTin: 'chua-hoi',
    nguon: 'kiotviet',
    ngayTao: k.ngayTao,
    maCu: k.maCu,
  }
}

function sangDichVu(d: GoiDichVu): BanGhiDichVu {
  return {
    id: maDichVu(d.maCu),
    ma: d.maCu,
    ten: d.ten,
    kieu: d.kieu,
    donGia: d.donGia,
    ...(d.toiThieu ? { toiThieu: { ...d.toiThieu } } : {}),
    ...(d.canhBaoTuKg !== undefined ? { canhBaoTuKg: d.canhBaoTuKg } : {}),
    ...(d.nhom ? { nhom: d.nhom } : {}),
    maCu: d.maCu,
    dangDung: d.dangDung,
  }
}

function sangPhieu(p: GoiPhieu): BanGhiPhieu {
  const daTra = p.loai === 'da-tra'
  return {
    id: maPhieu(p),
    khachId: p.khachMaCu === undefined ? MA_KHACH_LE : maKhach(p.khachMaCu),
    ngayNhan: p.ngayNhan ?? '',
    moTa: p.moTa,
    ...(p.ghiChu ? { ghiChu: p.ghiChu } : {}),
    tongTien: p.tongTien,
    ...(daTra && p.ngayTra && p.phuongThuc
      ? { ngayTra: p.ngayTra, phuongThuc: p.phuongThuc, nguonNgayTra: 'gio-nhap-kiotviet' as const }
      : {}),
    trangThai: daTra ? 'da-tra' : 'chua-thanh-toan',
    ...(p.maHoaDonCu ? { maHoaDonCu: p.maHoaDonCu } : {}),
    ...(p.maDatHangCu ? { maDatHangCu: p.maDatHangCu } : {}),
    ...(p.nhapSaiQuyTrinh ? { nhapSaiQuyTrinh: true } : {}),
    dongCu: p.dong.map((d) => ({ ...d })),
  }
}

export function taoDichVuNhapLichSu(phuThuoc: {
  khoPhieu: KhoPhieu
  khoKhach: KhoKhach
  khoDichVu: KhoDichVu
  /** Ngày tạo của khách lẻ giữ chỗ. */
  homNay?: () => NgayIso
}): DichVuNhapLichSu {
  const { khoPhieu, khoKhach, khoDichVu } = phuThuoc
  const homNay =
    phuThuoc.homNay ??
    (() => {
      const d = new Date()
      const p = (x: number) => String(x).padStart(2, '0')
      return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
    })

  async function kiemTra(goi: GoiNhapLichSu): Promise<BanKiemTra> {
    const loi: string[] = [...goi.baoCao.loi]
    const maKhGoi = new Set(goi.khach.map((k) => k.maCu))
    const maDvGoi = new Set(goi.dichVu.map((d) => d.maCu))

    for (const m of trungMa(goi.khach, (k) => k.maCu)) loi.push(`Mã khách ${m} xuất hiện nhiều lần trong gói.`)
    for (const m of trungMa(goi.dichVu, (d) => d.maCu)) loi.push(`Mã dịch vụ ${m} xuất hiện nhiều lần trong gói.`)
    for (const m of trungMa(goi.phieu, maPhieu)) loi.push(`Mã phiếu ${m.slice(3)} xuất hiện nhiều lần trong gói.`)

    let tienMat = 0
    let chuyenKhoan = 0
    for (const p of goi.phieu) {
      const ten = p.maHoaDonCu ?? p.maDatHangCu ?? '(không mã)'
      if (p.loai === 'da-tra') {
        if (!p.maHoaDonCu || !p.ngayTra || !p.phuongThuc) {
          loi.push(`Phiếu ${ten} đã trả nhưng thiếu mã hóa đơn, ngày trả hoặc phương thức.`)
        } else if (p.phuongThuc === 'tien-mat') tienMat += p.tongTien
        else chuyenKhoan += p.tongTien
        if (p.ngayTra && !ngayHopLe(p.ngayTra)) loi.push(`Phiếu ${ten} có ngày trả không hợp lệ.`)
      } else if (!p.maDatHangCu) {
        loi.push(`Phiếu tạm ${ten} thiếu mã đặt hàng.`)
      }
      if (p.ngayNhan !== undefined && !ngayHopLe(p.ngayNhan)) loi.push(`Phiếu ${ten} có ngày nhận không hợp lệ.`)
      if (p.ngayNhan !== undefined && p.ngayTra !== undefined && p.ngayTra < p.ngayNhan) {
        loi.push(`Phiếu ${ten} có ngày trả trước ngày nhận.`)
      }
      if (p.khachMaCu !== undefined && !maKhGoi.has(p.khachMaCu)) {
        loi.push(`Phiếu ${ten} trỏ tới khách ${p.khachMaCu} không có trong gói.`)
      }
      for (const d of p.dong) {
        if (!maDvGoi.has(d.maHang)) loi.push(`Phiếu ${ten} có dịch vụ ${d.maHang} không có trong gói.`)
      }
    }

    const [phieuCo, khachCo, dichVuCo] = await Promise.all([
      khoPhieu.tatCa(),
      khoKhach.tatCa(),
      khoDichVu.tatCa(),
    ])
    const idPhieu = new Set(phieuCo.map((b) => b.id))
    const idKhach = new Set(khachCo.map((b) => b.id))
    const idDichVu = new Set(dichVuCo.map((b) => b.id))
    const daCoPhieu = goi.phieu.filter((p) => idPhieu.has(maPhieu(p))).length
    const daCoKhach = goi.khach.filter((k) => idKhach.has(maKhach(k.maCu))).length
    const daCoDichVu = goi.dichVu.filter((d) => idDichVu.has(maDichVu(d.maCu))).length

    const soDienThoai = { hopLe: 0, saiDoDai: 0, coChu: 0, trong: 0 }
    for (const k of goi.khach) soDienThoai[phanLoaiSoDienThoai(k.soDienThoai)] += 1

    const co: Record<string, number> = {
      soPhieuDaTra: goi.phieu.filter((p) => p.loai === 'da-tra').length,
      soPhieuChuaThanhToan: goi.phieu.filter((p) => p.loai === 'chua-thanh-toan').length,
      soKhach: goi.khach.length,
      soDichVu: goi.dichVu.length,
      tienMat,
      chuyenKhoan,
    }
    // Số "mong đợi" do công cụ ghi vào gói; số "có" tính lại ở đây.
    const doiChieu = goi.baoCao.doiChieu.map((m) => {
      const c = co[m.ten] ?? m.co
      return { ten: m.ten, co: c, mong: m.mong, khop: c === m.mong }
    })

    return {
      soPhieuDaTra: co.soPhieuDaTra!,
      soPhieuChuaThanhToan: co.soPhieuChuaThanhToan!,
      soKhach: co.soKhach!,
      soDichVu: co.soDichVu!,
      tienMat,
      chuyenKhoan,
      soNhapSaiQuyTrinh: goi.phieu.filter((p) => p.nhapSaiQuyTrinh).length,
      soKhachLe: goi.phieu.filter((p) => p.khachMaCu === undefined).length,
      soDienThoai,
      moi: {
        phieu: goi.phieu.length - daCoPhieu,
        khach: goi.khach.length - daCoKhach,
        dichVu: goi.dichVu.length - daCoDichVu,
      },
      daCo: { phieu: daCoPhieu, khach: daCoKhach, dichVu: daCoDichVu },
      doiChieu,
      canhBao: [...goi.baoCao.canhBao],
      loi,
    }
  }

  async function ghiLo<T>(kho: { ghi(b: T): Promise<void>; ghiNhieu?(b: T[]): Promise<void> }, ds: T[]) {
    if (ds.length === 0) return
    if (kho.ghiNhieu) await kho.ghiNhieu(ds)
    else for (const b of ds) await kho.ghi(b)
  }

  return {
    kiemTra,
    async nhap(goi, dauVao) {
      if (dauVao?.xacNhan !== true) {
        throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', 'Cần xác nhận trước khi nhập lịch sử.')
      }
      const kt = await kiemTra(goi)
      if (kt.loi.length > 0) {
        throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', `Gói còn lỗi, chưa nhập gì: ${kt.loi.slice(0, 3).join(' ')}`)
      }
      const [phieuCo, khachCo, dichVuCo] = await Promise.all([
        khoPhieu.tatCa(),
        khoKhach.tatCa(),
        khoDichVu.tatCa(),
      ])
      const idPhieu = new Set(phieuCo.map((b) => b.id))
      const idKhach = new Set(khachCo.map((b) => b.id))
      const idDichVu = new Set(dichVuCo.map((b) => b.id))

      const dichVuMoi = goi.dichVu.map(sangDichVu).filter((b) => !idDichVu.has(b.id))
      const khachMoi = goi.khach.map(sangKhach).filter((b) => !idKhach.has(b.id))
      const canKhachLe = goi.phieu.some((p) => p.khachMaCu === undefined) && !idKhach.has(MA_KHACH_LE)
      const khachLe: BanGhiKhach[] = canKhachLe
        ? [{ id: MA_KHACH_LE, tenGoc: TEN_KHACH_LE, dongYNhanTin: 'chua-hoi', nguon: 'kiotviet', ngayTao: homNay() }]
        : []
      const phieuMoi = goi.phieu.map(sangPhieu).filter((b) => !idPhieu.has(b.id))

      // Thứ tự: dịch vụ, khách, rồi phiếu, để phiếu không bao giờ trỏ tới khách chưa có.
      await ghiLo(khoDichVu, dichVuMoi)
      await ghiLo(khoKhach, [...khachMoi, ...khachLe])
      await ghiLo(khoPhieu, phieuMoi)
      return {
        phieuMoi: phieuMoi.length,
        khachMoi: khachMoi.length,
        khachLeMoi: khachLe.length,
        dichVuMoi: dichVuMoi.length,
        phieuDaCo: goi.phieu.length - phieuMoi.length,
        khachDaCo: goi.khach.length - khachMoi.length,
        dichVuDaCo: goi.dichVu.length - dichVuMoi.length,
      }
    },
  }
}

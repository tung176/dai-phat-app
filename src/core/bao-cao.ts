import { tinhChiTiet } from './tinh-tien.ts'
import type { NgayIso, Phieu } from './types.ts'

export interface TongHopThu {
  soPhieu: number
  tongTien: number
  tienMat: number
  chuyenKhoan: number
}

/**
 * Tổng tiền đã thu theo ngày trả (gồm cả hai đầu). Chỉ tính phiếu "Đã trả":
 * bỏ phiếu đã hủy và phiếu xóa mềm; phiếu đã sửa tính theo giá trị mới nhất.
 */
export function tongHopThu(phieus: Phieu[], khoang: { tuNgay: NgayIso; denNgay: NgayIso }): TongHopThu {
  const kq: TongHopThu = { soPhieu: 0, tongTien: 0, tienMat: 0, chuyenKhoan: 0 }
  for (const p of phieus) {
    if (p.daXoa || p.nhan !== 'Đã trả' || p.ngayTra === undefined || p.tongTien === undefined) continue
    if (p.ngayTra < khoang.tuNgay || p.ngayTra > khoang.denNgay) continue
    kq.soPhieu += 1
    kq.tongTien += p.tongTien
    if (p.phuongThuc === 'tien-mat') kq.tienMat += p.tongTien
    else kq.chuyenKhoan += p.tongTien
  }
  return kq
}

export interface Khoang {
  tuNgay: NgayIso
  denNgay: NgayIso
}

export interface TongHopNgay extends TongHopThu {
  ngay: NgayIso
}

export interface DongTopDichVu {
  ma: string
  ten: string
  /** Số phiếu có dòng dịch vụ này. */
  soPhieu: number
  /** Cộng tiền các dòng dịch vụ này (chưa trừ giảm giá, chưa cộng phụ thu của phiếu). */
  doanhThu: number
}

export interface BaoCaoKy {
  khoang: Khoang
  tong: TongHopThu
  theoNgay: TongHopNgay[]
  topDichVu: DongTopDichVu[]
  /** Phiếu trong kỳ có dòng dịch vụ (đủ chi tiết để vào top dịch vụ). */
  phieuCoDongDichVu: { soPhieu: number; tongTien: number }
  /** Phiếu trong kỳ chỉ có tổng tiền (vd dữ liệu lịch sử): có trong tổng thu nhưng không vào top dịch vụ. */
  phieuChiCoTongTien: { soPhieu: number; tongTien: number }
}

export function khoangCuaNgay(ngay: NgayIso): Khoang {
  return { tuNgay: ngay, denNgay: ngay }
}

/** `thang` dạng "YYYY-MM". */
export function khoangCuaThang(thang: string): Khoang {
  const nam = Number(thang.slice(0, 4))
  const th = Number(thang.slice(5, 7))
  const soNgay = new Date(Date.UTC(nam, th, 0)).getUTCDate()
  return { tuNgay: `${thang}-01`, denNgay: `${thang}-${String(soNgay).padStart(2, '0')}` }
}

function tinhDuoc(p: Phieu, khoang: Khoang): p is Phieu & { ngayTra: NgayIso; tongTien: number } {
  return (
    !p.daXoa &&
    p.nhan === 'Đã trả' &&
    p.ngayTra !== undefined &&
    p.tongTien !== undefined &&
    p.ngayTra >= khoang.tuNgay &&
    p.ngayTra <= khoang.denNgay
  )
}

export function tongHopTheoNgay(phieus: Phieu[], khoang: Khoang): TongHopNgay[] {
  const theo = new Map<NgayIso, TongHopThu>()
  for (const p of phieus) {
    if (!tinhDuoc(p, khoang)) continue
    const t = theo.get(p.ngayTra) ?? { soPhieu: 0, tongTien: 0, tienMat: 0, chuyenKhoan: 0 }
    t.soPhieu += 1
    t.tongTien += p.tongTien
    if (p.phuongThuc === 'tien-mat') t.tienMat += p.tongTien
    else t.chuyenKhoan += p.tongTien
    theo.set(p.ngayTra, t)
  }
  return [...theo.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([ngay, t]) => ({ ngay, ...t }))
}

function dongDichVuCuaPhieu(p: Phieu): Array<{ ma: string; ten: string; tien: number }> {
  const chiTiet = p.chiTietTien
  if (!chiTiet || chiTiet.dong.length === 0) return []
  try {
    return tinhChiTiet(chiTiet).dong.map((d) => ({ ma: d.dichVu.ma, ten: d.dichVu.ten, tien: d.tien }))
  } catch {
    return [] // chi tiết hỏng: coi như chỉ có tổng tiền, vẫn tính vào thu
  }
}

export function baoCaoKy(phieus: Phieu[], khoang: Khoang): BaoCaoKy {
  const top = new Map<string, DongTopDichVu>()
  const coDong = { soPhieu: 0, tongTien: 0 }
  const chiTong = { soPhieu: 0, tongTien: 0 }
  for (const p of phieus) {
    if (!tinhDuoc(p, khoang)) continue
    const dong = dongDichVuCuaPhieu(p)
    if (dong.length === 0) {
      chiTong.soPhieu += 1
      chiTong.tongTien += p.tongTien
      continue
    }
    coDong.soPhieu += 1
    coDong.tongTien += p.tongTien
    const maTrongPhieu = new Set<string>()
    for (const d of dong) {
      const r = top.get(d.ma) ?? { ma: d.ma, ten: d.ten, soPhieu: 0, doanhThu: 0 }
      r.doanhThu += d.tien
      if (!maTrongPhieu.has(d.ma)) r.soPhieu += 1
      maTrongPhieu.add(d.ma)
      top.set(d.ma, r)
    }
  }
  return {
    khoang,
    tong: tongHopThu(phieus, khoang),
    theoNgay: tongHopTheoNgay(phieus, khoang),
    topDichVu: [...top.values()].sort((a, b) => b.doanhThu - a.doanhThu || a.ten.localeCompare(b.ten)),
    phieuCoDongDichVu: coDong,
    phieuChiCoTongTien: chiTong,
  }
}

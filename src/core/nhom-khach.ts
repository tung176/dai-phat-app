/** Ticket 10: chia khách thành 5 nhóm theo số lần mua và độ gần đây. Phần thuần, không I/O. */
import type { Khach } from './khach.ts'
import type { NgayIso, Phieu } from './types.ts'

export type MaNhom = 'trung-thanh' | 'than-thiet' | 'tiem-nang' | 'can-quan-tam' | 'sap-roi-bo'

/** Thứ tự hiển thị. */
export const CAC_NHOM: readonly MaNhom[] = ['trung-thanh', 'than-thiet', 'tiem-nang', 'can-quan-tam', 'sap-roi-bo']

export const TEN_NHOM: Record<MaNhom, string> = {
  'trung-thanh': 'Trung thành',
  'than-thiet': 'Thân thiết',
  'tiem-nang': 'Tiềm năng',
  'can-quan-tam': 'Cần quan tâm',
  'sap-roi-bo': 'Sắp rời bỏ',
}

export interface NguongNhom {
  /** "Gần đây" là mua cách hôm nay không quá số ngày này (đúng ngưỡng vẫn là gần đây). */
  ngayGanDay: number
  /** Từ số lần này trở lên (và mua gần đây) là Trung thành. */
  tuLanTrungThanh: number
  /** Từ số lần này đến dưới ngưỡng Trung thành (và mua gần đây) là Thân thiết. */
  tuLanThanThiet: number
  /** Quá hạn mà từ số lần này trở lên là Cần quan tâm, ít hơn là Sắp rời bỏ. */
  tuLanCanQuanTam: number
}

export const NGUONG_MAC_DINH: NguongNhom = {
  ngayGanDay: 90,
  tuLanTrungThanh: 8,
  tuLanThanThiet: 3,
  tuLanCanQuanTam: 2,
}

/** Ngưỡng hợp lệ: số nguyên dương và thứ tự 1 < thân thiết < trung thành... (thân thiết >= 2, trung thành > thân thiết). */
export function nguongHopLe(n: NguongNhom): boolean {
  const nguyenDuong = (x: number) => Number.isInteger(x) && x >= 1
  return (
    nguyenDuong(n.ngayGanDay) &&
    nguyenDuong(n.tuLanTrungThanh) &&
    nguyenDuong(n.tuLanThanThiet) &&
    nguyenDuong(n.tuLanCanQuanTam) &&
    n.tuLanThanThiet >= 2 &&
    n.tuLanTrungThanh > n.tuLanThanThiet
  )
}

export interface KhachTheoNhom {
  khachId: string
  tenHienThi: string
  soDienThoai?: string
  dungDuocSo: boolean
  dongYNhanTin: boolean
  soLanMua: number
  ngayMuaGanNhat?: NgayIso
  doanhThu: number
  /** Số ngày từ lần mua gần nhất đến hôm nay. */
  soNgayChuaQuayLai?: number
  /** Chưa mua lần nào (phiếu đã trả) thì chưa thuộc nhóm nào. */
  nhom?: MaNhom
}

export interface TongHopNhom {
  nhom: MaNhom
  soKhach: number
  doanhThu: number
  /** Tỷ trọng trên tổng doanh thu của mọi khách đã mua (0 đến 1). */
  tyTrong: number
  /** Số khách trong nhóm chưa có số điện thoại hợp lệ. */
  thieuSo: number
  soDaDongY: number
}

export interface KetQuaNhomKhach {
  khach: KhachTheoNhom[]
  nhom: TongHopNhom[]
  /** Khách chưa có phiếu đã trả nào. */
  chuaCoNhom: number
}

function soNgayGiua(tu: NgayIso, den: NgayIso): number {
  return Math.round((Date.parse(`${den}T00:00:00Z`) - Date.parse(`${tu}T00:00:00Z`)) / 86_400_000)
}

export function phanNhom(soLan: number, soNgay: number, n: NguongNhom): MaNhom | undefined {
  if (soLan < 1) return undefined
  if (soNgay <= n.ngayGanDay) {
    if (soLan >= n.tuLanTrungThanh) return 'trung-thanh'
    if (soLan >= n.tuLanThanThiet) return 'than-thiet'
    return 'tiem-nang'
  }
  return soLan >= n.tuLanCanQuanTam ? 'can-quan-tam' : 'sap-roi-bo'
}

/**
 * Tính nhóm của từng khách tại ngày xem. Chỉ phiếu "Đã trả" còn hiệu lực được tính
 * (phiếu hủy, xóa mềm, chưa trả thì không). Ngày mua là ngày trả.
 */
export function tinhNhomKhach(dau: {
  khach: Khach[]
  phieus: Phieu[]
  homNay: NgayIso
  nguong?: NguongNhom
}): KetQuaNhomKhach {
  const nguong = dau.nguong ?? NGUONG_MAC_DINH
  const theoKhach = new Map<string, { so: number; gan?: NgayIso; tien: number }>()
  for (const p of dau.phieus) {
    if (p.daXoa || p.nhan !== 'Đã trả' || p.ngayTra === undefined) continue
    const g = theoKhach.get(p.khachId) ?? { so: 0, tien: 0 }
    g.so += 1
    g.tien += p.tongTien ?? 0
    if (g.gan === undefined || p.ngayTra > g.gan) g.gan = p.ngayTra
    theoKhach.set(p.khachId, g)
  }

  const khach: KhachTheoNhom[] = dau.khach.map((k) => {
    const g = theoKhach.get(k.id)
    const soNgay = g?.gan !== undefined ? soNgayGiua(g.gan, dau.homNay) : undefined
    return {
      khachId: k.id,
      tenHienThi: k.tenHienThi,
      ...(k.soDienThoai ? { soDienThoai: k.soDienThoai } : {}),
      dungDuocSo: k.dungDuocSo,
      dongYNhanTin: k.dongYNhanTin === 'dong-y',
      soLanMua: g?.so ?? 0,
      ...(g?.gan !== undefined ? { ngayMuaGanNhat: g.gan } : {}),
      doanhThu: g?.tien ?? 0,
      ...(soNgay !== undefined ? { soNgayChuaQuayLai: soNgay } : {}),
      ...(g && soNgay !== undefined ? { nhom: phanNhom(g.so, soNgay, nguong) } : {}),
    }
  })

  const tongDoanhThu = khach.reduce((s, k) => (k.nhom ? s + k.doanhThu : s), 0)
  const nhom: TongHopNhom[] = CAC_NHOM.map((ma) => {
    const trong = khach.filter((k) => k.nhom === ma)
    const doanhThu = trong.reduce((s, k) => s + k.doanhThu, 0)
    return {
      nhom: ma,
      soKhach: trong.length,
      doanhThu,
      tyTrong: tongDoanhThu === 0 ? 0 : doanhThu / tongDoanhThu,
      thieuSo: trong.filter((k) => !k.dungDuocSo).length,
      soDaDongY: trong.filter((k) => k.dongYNhanTin).length,
    }
  })
  return { khach, nhom, chuaCoNhom: khach.filter((k) => !k.nhom).length }
}

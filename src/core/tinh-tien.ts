import type { DichVu } from './bang-gia.ts'
import { LoiNghiepVu } from './types.ts'

/** 'ghi-that': kg ghi trong sổ. 'suy-ra': kg suy từ tiền chia đơn giá. */
export type NguonKg = 'ghi-that' | 'suy-ra'

export interface KetQuaTienTuKg {
  tien: number
  apDungToiThieu: boolean
  canhBao?: string
}

export interface KetQuaKgTuTien {
  /** Số thật, không làm tròn. Chỉ làm tròn khi hiển thị (hienKg). */
  kg: number
  nguonKg: 'suy-ra'
  canhBao?: string
}

export function khongHopLe(thongBao: string): never {
  throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', thongBao)
}

export function hienKg(kg: number): string {
  return kg.toFixed(2).replace('.', ',')
}

function canhBaoQuaNguong(dichVu: DichVu, kg: number): string | undefined {
  if (dichVu.canhBaoTuKg === undefined || kg < dichVu.canhBaoTuKg) return undefined
  return `${dichVu.ten} chỉ nhận dưới ${dichVu.canhBaoTuKg}kg (đang ${hienKg(kg)}kg), anh quyết định.`
}

export function tinhTienTuKg(dichVu: DichVu, kg: number): KetQuaTienTuKg {
  if (!Number.isFinite(kg) || kg <= 0) khongHopLe('Số kg phải lớn hơn 0.')
  const canhBao = canhBaoQuaNguong(dichVu, kg)
  const min = dichVu.toiThieu
  const tien = min && kg < min.duoiKg ? min.tien : Math.round(kg * dichVu.donGia)
  return {
    tien,
    apDungToiThieu: min !== undefined && kg < min.duoiKg,
    ...(canhBao ? { canhBao } : {}),
  }
}

export function tinhKgTuTien(dichVu: DichVu, tien: number): KetQuaKgTuTien {
  if (!Number.isInteger(tien) || tien <= 0) khongHopLe('Số tiền phải là số đồng nguyên dương.')
  if (dichVu.donGia <= 0) khongHopLe('Dịch vụ chưa có đơn giá.')
  const kg = tien / dichVu.donGia
  const canhBao = canhBaoQuaNguong(dichVu, kg)
  return { kg, nguonKg: 'suy-ra', ...(canhBao ? { canhBao } : {}) }
}

/** Dòng dịch vụ kiểu kg nhập kg (ghi thật) hoặc tiền (kg suy ra); kiểu số lượng nhập soLuong. */
export interface DongDichVu {
  dichVu: DichVu
  kg?: number
  soLuong?: number
  tien?: number
}

export interface PhuThu {
  soTien: number
  /** Ghi chú tự do, không cố định ý nghĩa ("+5K"...). */
  ghiChu: string
}

export type GiamGia =
  | { loai: 'tien'; soTien: number; lyDo?: string }
  | { loai: 'phan-tram'; phanTram: number; lyDo?: string }

export interface ChiTietTien {
  dong: DongDichVu[]
  phuThu?: PhuThu[]
  giamGia?: GiamGia
  /** Tổng tiền theo sổ. Mặc định đúng. */
  tongTienSo?: number
  /** Khi kg x đơn giá lệch sổ: 'so' (mặc định) giữ tiền sổ, 'tinh' lấy số tính được. */
  chon?: 'so' | 'tinh'
}

export interface DongDaTinh {
  dichVu: DichVu
  kg?: number
  nguonKg?: NguonKg
  soLuong?: number
  tien: number
  apDungToiThieu: boolean
}

export interface KetQuaChiTiet {
  dong: DongDaTinh[]
  tienDichVu: number
  tongPhuThu: number
  giamGia: number
  /** Tổng tính từ các dòng, phụ thu, giảm giá. */
  tongTinh: number
  tongTienSo?: number
  /** tongTinh - tongTienSo; chỉ có khi có tiền sổ. */
  chenhLech?: number
  vuotNguong: boolean
  /** Tổng tiền cuối: mặc định theo sổ, hoặc số tính được nếu chọn 'tinh'. */
  tongChot: number
  canhBao: string[]
}

export const NGUONG_CHENH_MAC_DINH = 10000

function soDongDuong(n: number | undefined): n is number {
  return n !== undefined && Number.isInteger(n) && n > 0
}

function tinhDong(d: DongDichVu): { dong: DongDaTinh; canhBao?: string } {
  const { dichVu } = d
  if (dichVu.kieu === 'so-luong') {
    if (!soDongDuong(d.soLuong) || d.kg !== undefined || d.tien !== undefined) {
      khongHopLe(`${dichVu.ten}: chỉ nhập số lượng nguyên dương.`)
    }
    return { dong: { dichVu, soLuong: d.soLuong, tien: d.soLuong * dichVu.donGia, apDungToiThieu: false } }
  }
  if ((d.kg === undefined) === (d.tien === undefined) || d.soLuong !== undefined) {
    khongHopLe(`${dichVu.ten}: nhập kg hoặc tiền, chọn một.`)
  }
  if (d.kg !== undefined) {
    const r = tinhTienTuKg(dichVu, d.kg)
    return {
      dong: { dichVu, kg: d.kg, nguonKg: 'ghi-that', tien: r.tien, apDungToiThieu: r.apDungToiThieu },
      canhBao: r.canhBao,
    }
  }
  const tien = d.tien as number
  const r = tinhKgTuTien(dichVu, tien)
  return { dong: { dichVu, kg: r.kg, nguonKg: 'suy-ra', tien, apDungToiThieu: false }, canhBao: r.canhBao }
}

export function tinhChiTiet(
  chiTiet: ChiTietTien,
  tuyChon: { nguongChenh?: number } = {},
): KetQuaChiTiet {
  if (chiTiet.dong.length === 0) khongHopLe('Cần ít nhất một dòng dịch vụ.')
  const canhBao: string[] = []
  const dong = chiTiet.dong.map((d) => {
    const r = tinhDong(d)
    if (r.canhBao) canhBao.push(r.canhBao)
    return r.dong
  })
  const tienDichVu = dong.reduce((s, d) => s + d.tien, 0)
  const phuThu = chiTiet.phuThu ?? []
  for (const p of phuThu) {
    if (!soDongDuong(p.soTien)) khongHopLe('Phụ thu phải là số đồng nguyên dương.')
  }
  const tongPhuThu = phuThu.reduce((s, p) => s + p.soTien, 0)
  const truocGiam = tienDichVu + tongPhuThu

  let giamGia = 0
  const g = chiTiet.giamGia
  if (g?.loai === 'tien') {
    if (!soDongDuong(g.soTien)) khongHopLe('Giảm giá phải là số đồng nguyên dương.')
    giamGia = g.soTien
  } else if (g?.loai === 'phan-tram') {
    if (!Number.isFinite(g.phanTram) || g.phanTram <= 0 || g.phanTram > 100) {
      khongHopLe('Giảm giá theo phần trăm phải trong khoảng từ 0 đến 100.')
    }
    giamGia = Math.round((truocGiam * g.phanTram) / 100)
  }
  if (giamGia > truocGiam) khongHopLe('Giảm giá không được lớn hơn tiền hàng.')
  const tongTinh = truocGiam - giamGia
  if (tongTinh <= 0) khongHopLe('Tổng tiền sau giảm giá phải lớn hơn 0.')

  const so = chiTiet.tongTienSo
  if (so !== undefined && !soDongDuong(so)) khongHopLe('Tổng tiền theo sổ phải là số đồng nguyên dương.')
  const nguong = tuyChon.nguongChenh ?? NGUONG_CHENH_MAC_DINH
  const chenhLech = so === undefined ? undefined : tongTinh - so
  const vuotNguong = chenhLech !== undefined && Math.abs(chenhLech) > nguong
  const tongChot = so === undefined || chiTiet.chon === 'tinh' ? tongTinh : so

  return {
    dong,
    tienDichVu,
    tongPhuThu,
    giamGia,
    tongTinh,
    ...(so !== undefined ? { tongTienSo: so } : {}),
    ...(chenhLech !== undefined ? { chenhLech } : {}),
    vuotNguong,
    tongChot,
    canhBao,
  }
}

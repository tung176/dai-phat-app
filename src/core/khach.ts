/** Khách là thực thể riêng; phiếu tham chiếu khách bằng mã. Phần thuần (không I/O) của miền khách. */
import type { NgayIso } from './types.ts'

export type NguonKhach = 'nhap-tay' | 'tu-phieu' | 'nhap-so'
export type DongYNhanTin = 'chua-hoi' | 'dong-y'

/** Bản ghi lưu trữ của khách. Tên hiển thị và cờ số dùng được là giá trị suy ra, không lưu. */
export interface BanGhiKhach {
  id: string
  tenGoc: string
  viTri?: string
  /** Đã chuẩn hóa (bỏ khoảng trắng, dấu chấm, gạch). Số sai vẫn lưu để anh sửa, nhưng bị cờ. */
  soDienThoai?: string
  dongYNhanTin: DongYNhanTin
  nguon: NguonKhach
  ngayTao: NgayIso
  /** Có giá trị khi khách đã bị gộp vào khách khác (ẩn khỏi danh sách, còn để hoàn tác). */
  daGopVao?: string
}

export interface Khach extends BanGhiKhach {
  tenHienThi: string
  dungDuocSo: boolean
}

export type LyDoGiong = 'trung-ten' | 'doi-thu-tu-tu' | 'gan-giong'

export interface CapGoiYGop {
  a: Khach
  b: Khach
  lyDo: LyDoGiong
  /** Cả hai đều có số dùng được nhưng khác nhau: nhiều khả năng là hai người khác nhau. */
  khacSoDienThoai: boolean
}

export interface NhatKyGop {
  id: string
  ngay: NgayIso
  giuLai: string
  gopVao: string[]
  phieuDaChuyen: Array<{ phieuId: string; khachIdCu: string }>
  daHoanTac: boolean
}

export function chuanHoaSoDienThoai(tho: string): { soDienThoai?: string; dungDuoc: boolean } {
  const so = tho.replace(/[\s.-]/g, '')
  if (so === '') return { dungDuoc: false }
  return { soDienThoai: so, dungDuoc: /^0\d{9}$/.test(so) }
}

function boDau(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/đ/g, 'd')
}

/** Dạng so khớp: bỏ dấu, chữ thường, một khoảng trắng giữa các từ, bỏ dấu câu. */
export function chuanHoaTen(ten: string): string {
  return boDau(ten)
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

export function tenHienThi(tenGoc: string, viTri?: string): string {
  return viTri ? `${tenGoc} (${viTri})` : tenGoc
}

function cachNhauMotKyTu(a: string, b: string): boolean {
  if (a === b) return false
  if (Math.abs(a.length - b.length) > 1) return false
  let i = 0
  while (i < a.length && i < b.length && a[i] === b[i]) i += 1
  if (a.length === b.length) return a.slice(i + 1) === b.slice(i + 1)
  const [dai, ngan] = a.length > b.length ? [a, b] : [b, a]
  return dai.slice(i + 1) === ngan.slice(i)
}

/** Hai tên có gần giống không (chỉ so tên gốc, không so ghi chú vị trí). */
export function doGiong(tenA: string, tenB: string): LyDoGiong | undefined {
  const a = chuanHoaTen(tenA)
  const b = chuanHoaTen(tenB)
  if (a === '' || b === '') return undefined
  if (a === b) return 'trung-ten'
  const tuA = a.split(' ')
  const tuB = b.split(' ')
  if (tuA.length === tuB.length) {
    if ([...tuA].sort().join(' ') === [...tuB].sort().join(' ')) return 'doi-thu-tu-tu'
    // Gõ nhầm đúng một ký tự trong một từ (từ dài từ 4 ký tự trở lên), các từ còn lại giống hệt.
    const khac = tuA.map((t, i) => [t, tuB[i]!] as const).filter(([x, y]) => x !== y)
    if (khac.length === 1 && khac[0]![0].length >= 4 && cachNhauMotKyTu(khac[0]![0], khac[0]![1])) {
      return 'gan-giong'
    }
  }
  return undefined
}

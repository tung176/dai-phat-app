/** Khách là thực thể riêng; phiếu tham chiếu khách bằng mã. Phần thuần (không I/O) của miền khách. */
import type { NgayIso } from './types.ts'

export type NguonKhach = 'nhap-tay' | 'tu-phieu' | 'nhap-so' | 'kiotviet'
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
  /** Ticket 07: mã khách KiotViet, để nhập lại không nhân đôi. */
  maCu?: string
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

/** Tên một từ ngắn hơn ngưỡng này (đã bỏ dấu) quá phổ biến, không gợi ý chỉ vì gõ nhầm một ký tự. */
const DO_DAI_TOI_THIEU_TEN_MOT_TU = 5

/** Như `doGiong` nhưng nhận tên đã qua `chuanHoaTen` (để so nhiều cặp mà không chuẩn hóa lại). */
export function doGiongDaChuanHoa(a: string, b: string): LyDoGiong | undefined {
  if (a === '' || b === '') return undefined
  if (a === b) return 'trung-ten'
  const tuA = a.split(' ')
  const tuB = b.split(' ')
  if (tuA.length === tuB.length) {
    if ([...tuA].sort().join(' ') === [...tuB].sort().join(' ')) return 'doi-thu-tu-tu'
    // Gõ nhầm đúng một ký tự trong một từ (từ dài từ 4 ký tự trở lên), các từ còn lại giống hệt.
    // Tên chỉ một từ thì phải từ 5 ký tự trở lên: Mai, Lan, Hạnh... quá phổ biến.
    const khac = tuA.map((t, i) => [t, tuB[i]!] as const).filter(([x, y]) => x !== y)
    const duDai = tuA.length === 1 ? DO_DAI_TOI_THIEU_TEN_MOT_TU : 4
    if (khac.length === 1) {
      const [x, y] = khac[0]!
      if (Math.min(x.length, y.length) >= duDai && cachNhauMotKyTu(x, y)) return 'gan-giong'
    }
  }
  return undefined
}

/** Hai tên có gần giống không (chỉ so tên gốc, không so ghi chú vị trí). */
export function doGiong(tenA: string, tenB: string): LyDoGiong | undefined {
  return doGiongDaChuanHoa(chuanHoaTen(tenA), chuanHoaTen(tenB))
}

/** Nhóm các khách nối với nhau qua các cặp gợi ý (một khách nằm trong nhiều cặp thì gom lại). */
export interface CumGoiY {
  khach: Khach[]
  cap: CapGoiYGop[]
  /** Các lý do khác nhau trong cụm, mạnh nhất trước (trùng tên, đổi thứ tự từ, gần giống). */
  lyDo: LyDoGiong[]
}

export interface GoiYGopTheoCum {
  /** Cụm cần chủ tiệm xem. */
  canXem: CumGoiY[]
  /** Cụm chỉ gồm các cặp mà cả hai khách đều có số hợp lệ và khác nhau: nhiều khả năng là hai người. */
  itKhaNangTrung: CumGoiY[]
}

const THU_TU_LY_DO: LyDoGiong[] = ['trung-ten', 'doi-thu-tu-tu', 'gan-giong']

function gomCum(caps: CapGoiYGop[]): CumGoiY[] {
  const cha = new Map<string, string>()
  const goc = (id: string): string => {
    let x = id
    while (cha.get(x) !== x) {
      const tren = cha.get(x) ?? x
      cha.set(x, cha.get(tren) ?? tren)
      x = tren
    }
    return x
  }
  for (const c of caps) {
    for (const id of [c.a.id, c.b.id]) if (!cha.has(id)) cha.set(id, id)
    cha.set(goc(c.a.id), goc(c.b.id))
  }
  const cum = new Map<string, { khach: Map<string, Khach>; cap: CapGoiYGop[] }>()
  for (const c of caps) {
    const g = goc(c.a.id)
    const o = cum.get(g) ?? { khach: new Map<string, Khach>(), cap: [] }
    o.khach.set(c.a.id, c.a)
    o.khach.set(c.b.id, c.b)
    o.cap.push(c)
    cum.set(g, o)
  }
  return [...cum.values()].map(({ khach, cap }) => ({
    khach: [...khach.values()].sort((x, y) => x.id.localeCompare(y.id)),
    cap,
    lyDo: THU_TU_LY_DO.filter((l) => cap.some((c) => c.lyDo === l)),
  }))
}

/**
 * Gom các cặp gợi ý thành cụm và tách cụm ít khả năng trùng ra khỏi mục chính.
 * Cặp bị ẩn mà hai khách đã chung một cụm cần xem thì bỏ đi (không lặp lại ở mục ẩn).
 */
export function chiaGoiYGop(caps: CapGoiYGop[]): GoiYGopTheoCum {
  const canXem = gomCum(caps.filter((c) => !c.khacSoDienThoai))
  const cumCua = new Map<string, number>()
  canXem.forEach((c, i) => c.khach.forEach((k) => cumCua.set(k.id, i)))
  const bi = caps.filter(
    (c) => c.khacSoDienThoai && (!cumCua.has(c.a.id) || cumCua.get(c.a.id) !== cumCua.get(c.b.id)),
  )
  return { canXem, itKhaNangTrung: gomCum(bi) }
}

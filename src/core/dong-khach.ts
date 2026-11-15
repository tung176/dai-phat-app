import type { BanGhiKhach, DongYNhanTin, NguonKhach, NhatKyGop } from './khach.ts'

/**
 * Chuyển khách và nhật ký gộp khách <-> dòng trong Sheet (tab "Khách" và "Nhật ký").
 * Thứ tự cột phải khớp TABS trong apps-script/Code.gs. Cột cuối "Cập nhật lúc" chỉ để chủ tiệm xem.
 */
export const TAB_KHACH = 'Khách'
export const SO_COT_KHACH = 9
export const TAB_NHAT_KY = 'Nhật ký'
export const SO_COT_NHAT_KY = 7

const chuoi = (v: unknown) => (v === null || v === undefined ? '' : String(v))

export function khachSangDong(b: BanGhiKhach, capNhatLuc: number): string[] {
  return [
    b.id,
    b.tenGoc,
    b.viTri ?? '',
    b.soDienThoai ?? '',
    b.dongYNhanTin,
    b.nguon,
    b.ngayTao,
    b.daGopVao ?? '',
    String(capNhatLuc),
  ]
}

const DONG_Y: readonly string[] = ['chua-hoi', 'dong-y']
const NGUON: readonly string[] = ['nhap-tay', 'tu-phieu', 'nhap-so']

export function khachTuDong(d: readonly unknown[]): BanGhiKhach | undefined {
  if (d.length < SO_COT_KHACH) return undefined
  const [id, tenGoc, viTri, sdt, dongY, nguon, ngayTao, daGopVao] = d.map(chuoi)
  if (!id || !tenGoc || !DONG_Y.includes(dongY) || !NGUON.includes(nguon)) return undefined
  return {
    id,
    tenGoc,
    ...(viTri ? { viTri } : {}),
    ...(sdt ? { soDienThoai: sdt } : {}),
    dongYNhanTin: dongY as DongYNhanTin,
    nguon: nguon as NguonKhach,
    ngayTao,
    ...(daGopVao ? { daGopVao } : {}),
  }
}

export function nhatKySangDong(n: NhatKyGop, capNhatLuc: number): string[] {
  return [
    n.id,
    n.ngay,
    n.giuLai,
    JSON.stringify(n.gopVao),
    JSON.stringify(n.phieuDaChuyen),
    n.daHoanTac ? 'TRUE' : 'FALSE',
    String(capNhatLuc),
  ]
}

export function nhatKyTuDong(d: readonly unknown[]): NhatKyGop | undefined {
  if (d.length < SO_COT_NHAT_KY) return undefined
  const [id, ngay, giuLai, gopVao, phieuDaChuyen, daHoanTac] = d.map(chuoi)
  if (!id || !giuLai) return undefined
  try {
    const gop = JSON.parse(gopVao) as NhatKyGop['gopVao']
    const chuyen = JSON.parse(phieuDaChuyen) as NhatKyGop['phieuDaChuyen']
    if (!Array.isArray(gop) || !Array.isArray(chuyen)) return undefined
    return { id, ngay, giuLai, gopVao: gop, phieuDaChuyen: chuyen, daHoanTac: daHoanTac.toUpperCase() === 'TRUE' }
  } catch {
    return undefined
  }
}

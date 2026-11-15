import type { CaiDatPhieu, DaXem, NhatKyPhieu } from './nhat-ky-phieu.ts'

/**
 * Ticket 05: chuyển nhật ký phiếu, đánh dấu đã xem và cài đặt <-> dòng trong Sheet.
 * Thứ tự cột phải khớp TABS trong apps-script/Code.gs. Các cột nhiều giá trị là JSON.
 * Nhật ký chỉ thêm: mỗi dòng gửi một lần, không bao giờ sửa. Cột cuối "Cập nhật lúc" chỉ để chủ tiệm xem.
 */
export const TAB_NHAT_KY_PHIEU = 'Nhật ký phiếu'
export const SO_COT_NHAT_KY_PHIEU = 13
export const TAB_DA_XEM = 'Đã xem'
export const SO_COT_DA_XEM = 5
export const TAB_CAI_DAT_PHIEU = 'Cài đặt phiếu'
export const SO_COT_CAI_DAT_PHIEU = 3

/** Mã cố định của dòng cài đặt duy nhất. */
export const MA_CAI_DAT_PHIEU = 'cai-dat'

export type DongNhatKyPhieu = NhatKyPhieu
/** Đã xem: mã dòng chính là mã nhật ký được xem (mỗi mục chỉ đánh dấu một lần). */
export type DongDaXem = DaXem & { id: string }
export type DongCaiDatPhieu = CaiDatPhieu & { id: string }

const chuoi = (v: unknown) => (v === null || v === undefined ? '' : String(v))

function docJson<T>(s: string): T | undefined {
  try {
    return JSON.parse(s) as T
  } catch {
    return undefined
  }
}

export function nhatKyPhieuSangDong(n: NhatKyPhieu, capNhatLuc: number): string[] {
  return [
    n.id,
    n.luc,
    n.ngay,
    n.nguoi.id,
    n.nguoi.ten,
    n.loai,
    n.phieuId ?? '',
    n.phieuLienKetId ?? '',
    JSON.stringify(n.thayDoi),
    n.lyDo,
    JSON.stringify(n.batThuong),
    'chua-xac-thuc',
    String(capNhatLuc),
  ]
}

export function nhatKyPhieuTuDong(d: readonly unknown[]): NhatKyPhieu | undefined {
  if (d.length < SO_COT_NHAT_KY_PHIEU) return undefined
  const [id, luc, ngay, nguoiId, nguoiTen, loai, phieuId, lienKet, thayDoi, lyDo, batThuong] = d.map(chuoi)
  if (!id || !luc || !nguoiId) return undefined
  const td = docJson<NhatKyPhieu['thayDoi']>(thayDoi)
  const bt = docJson<NhatKyPhieu['batThuong']>(batThuong)
  if (!Array.isArray(td) || !Array.isArray(bt)) return undefined
  return {
    id,
    luc,
    ngay,
    nguoi: { id: nguoiId, ten: nguoiTen, xacThuc: false },
    loai: loai as NhatKyPhieu['loai'],
    phieuId: phieuId === '' ? null : phieuId,
    ...(lienKet ? { phieuLienKetId: lienKet } : {}),
    thayDoi: td,
    lyDo,
    batThuong: bt,
  }
}

export function daXemSangDong(x: DongDaXem, capNhatLuc: number): string[] {
  return [x.id, x.nguoi.id, x.nguoi.ten, x.luc, String(capNhatLuc)]
}

export function daXemTuDong(d: readonly unknown[]): DongDaXem | undefined {
  if (d.length < SO_COT_DA_XEM) return undefined
  const [id, nguoiId, nguoiTen, luc] = d.map(chuoi)
  if (!id || !nguoiId) return undefined
  return { id, nhatKyId: id, nguoi: { id: nguoiId, ten: nguoiTen, xacThuc: false }, luc }
}

export function caiDatSangDong(c: DongCaiDatPhieu, capNhatLuc: number): string[] {
  const { id, ...noiDung } = c
  return [id, JSON.stringify(noiDung), String(capNhatLuc)]
}

export function caiDatTuDong(d: readonly unknown[]): DongCaiDatPhieu | undefined {
  if (d.length < SO_COT_CAI_DAT_PHIEU) return undefined
  const [id, noiDung] = d.map(chuoi)
  const c = docJson<CaiDatPhieu>(noiDung)
  if (!id || !c || typeof c !== 'object' || !c.congTac || !c.nguong || !c.khoaThang) return undefined
  return { ...c, id }
}

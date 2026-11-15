import type { BanGhiPhieu, PhuongThuc, TrangThai } from './types.ts'

/**
 * Chuyển phiếu <-> dòng của tab "Phiếu" trong Sheet. Mọi ô là chữ; thứ tự cột phải khớp TABS['Phiếu'] trong apps-script/Code.gs.
 * Cột cuối "Cập nhật lúc" chỉ để chủ tiệm xem, app không đọc lại.
 */
export const TAB_PHIEU = 'Phiếu'
export const SO_COT_PHIEU = 11

export function sangDong(b: BanGhiPhieu, capNhatLuc: number): string[] {
  return [
    b.id,
    b.khach.ten,
    b.khach.soDienThoai ?? '',
    b.ngayNhan,
    b.moTa,
    b.ghiChu ?? '',
    b.tongTien === undefined ? '' : String(b.tongTien),
    b.ngayTra ?? '',
    b.phuongThuc ?? '',
    b.trangThai,
    String(capNhatLuc),
  ]
}

/** Trả undefined nếu dòng hỏng (thiếu mã, trạng thái lạ...) để bỏ qua, không làm sập app. */
export function tuDong(d: readonly unknown[]): BanGhiPhieu | undefined {
  if (d.length < SO_COT_PHIEU) return undefined
  const o = d.map((v) => (v === null || v === undefined ? '' : String(v)))
  const [id, ten, sdt, ngayNhan, moTa, ghiChu, tien, ngayTra, phuongThuc, trangThai] = o
  if (!id || !ten || (trangThai !== 'chua-thanh-toan' && trangThai !== 'da-tra')) return undefined
  const tongTien = tien === '' ? undefined : Number(tien)
  if (tongTien !== undefined && !Number.isFinite(tongTien)) return undefined
  return {
    id,
    khach: { ten, ...(sdt ? { soDienThoai: sdt } : {}) },
    ngayNhan,
    moTa,
    ...(ghiChu ? { ghiChu } : {}),
    ...(tongTien !== undefined ? { tongTien } : {}),
    ...(ngayTra ? { ngayTra } : {}),
    ...(phuongThuc ? { phuongThuc: phuongThuc as PhuongThuc } : {}),
    trangThai: trangThai as TrangThai,
  }
}

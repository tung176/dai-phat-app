import type { BanGhiDichVu } from './kho-dich-vu.ts'

/**
 * Chuyển dịch vụ <-> dòng của tab "Dịch vụ" trong Sheet. Mọi ô là chữ; thứ tự cột phải khớp TABS['Dịch vụ'] trong apps-script/Code.gs.
 * Năm cột đầu có từ trước (ticket 02): Mã dịch vụ, Tên, Đơn vị ('kg' hoặc 'so-luong'), Đơn giá, Cập nhật lúc.
 * Ticket 07 thêm ở cuối: Tối thiểu dưới kg, Tối thiểu tiền, Cảnh báo từ kg, Giá vốn, Mã cũ, Nhóm, Đang dùng.
 */
export const TAB_DICH_VU = 'Dịch vụ'
export const SO_COT_DICH_VU = 12

const chuoi = (v: unknown) => (v === null || v === undefined ? '' : String(v))
const so = (s: string): number | undefined => {
  if (s === '') return undefined
  const n = Number(s)
  return Number.isFinite(n) ? n : undefined
}

export function dichVuSangDong(b: BanGhiDichVu, capNhatLuc: number): string[] {
  return [
    b.id,
    b.ten,
    b.kieu,
    String(b.donGia),
    String(capNhatLuc),
    b.toiThieu ? String(b.toiThieu.duoiKg) : '',
    b.toiThieu ? String(b.toiThieu.tien) : '',
    b.canhBaoTuKg === undefined ? '' : String(b.canhBaoTuKg),
    b.giaVon === undefined ? '' : String(b.giaVon),
    b.maCu ?? '',
    b.nhom ?? '',
    b.dangDung ? 'TRUE' : 'FALSE',
  ]
}

/** Trả undefined nếu dòng hỏng (thiếu mã, đơn vị lạ, đơn giá không phải số) để bỏ qua, không làm sập app. */
export function dichVuTuDong(d: readonly unknown[]): BanGhiDichVu | undefined {
  if (d.length < SO_COT_DICH_VU) return undefined
  const [id, ten, kieu, gia, , duoiKg, tienToiThieu, canhBao, giaVon, maCu, nhom, dangDung] = d.map(chuoi)
  const donGia = so(gia ?? '')
  if (!id || !ten || (kieu !== 'kg' && kieu !== 'so-luong') || donGia === undefined) return undefined
  const kg = so(duoiKg ?? '')
  const tien = so(tienToiThieu ?? '')
  const canh = so(canhBao ?? '')
  const von = so(giaVon ?? '')
  return {
    id,
    ma: id,
    ten,
    kieu,
    donGia,
    ...(kg !== undefined && tien !== undefined ? { toiThieu: { duoiKg: kg, tien } } : {}),
    ...(canh !== undefined ? { canhBaoTuKg: canh } : {}),
    ...(von !== undefined ? { giaVon: von } : {}),
    ...(maCu ? { maCu } : {}),
    ...(nhom ? { nhom } : {}),
    dangDung: (dangDung ?? '').toUpperCase() !== 'FALSE',
  }
}

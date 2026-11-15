import type { ChiTietTien } from './tinh-tien.ts'
import type { BanGhiPhieu, PhuongThuc, TrangThai } from './types.ts'

/**
 * Chuyển phiếu <-> dòng của tab "Phiếu" trong Sheet. Mọi ô là chữ; thứ tự cột phải khớp TABS['Phiếu'] trong apps-script/Code.gs.
 * Cột "Chi tiết tiền" là JSON của dòng dịch vụ, phụ thu, giảm giá lúc chốt tiền.
 * Cột "Cập nhật lúc" chỉ để chủ tiệm xem, app không đọc lại.
 * Ticket 05 thêm ba cột: Đã xóa (TRUE khi xóa mềm), Thay thế cho (mã phiếu cũ), Thay bằng (mã phiếu mới).
 * Ticket 09 thêm cột cuối "Khóa nhập lô" ("mã lô:mã dòng" của dòng sổ sinh ra phiếu).
 */
export const TAB_PHIEU = 'Phiếu'
export const SO_COT_PHIEU = 15
/** Đọc được cả dòng cũ 11 cột (trước ticket 05) hoặc 14 cột (trước ticket 09): cột thiếu coi như trống. */
const SO_COT_PHIEU_CU = 11

export function sangDong(b: BanGhiPhieu, capNhatLuc: number): string[] {
  return [
    b.id,
    b.khachId,
    b.ngayNhan,
    b.moTa,
    b.ghiChu ?? '',
    b.tongTien === undefined ? '' : String(b.tongTien),
    b.ngayTra ?? '',
    b.phuongThuc ?? '',
    b.trangThai,
    b.chiTietTien === undefined ? '' : JSON.stringify(b.chiTietTien),
    String(capNhatLuc),
    b.daXoa ? 'TRUE' : '',
    b.thayTheCho ?? '',
    b.thayTheBoi ?? '',
    b.khoaNhapLo ?? '',
  ]
}

function docChiTiet(chuoi: string): ChiTietTien | undefined {
  if (chuoi === '') return undefined
  try {
    const o = JSON.parse(chuoi) as ChiTietTien
    return o && typeof o === 'object' && Array.isArray(o.dong) ? o : undefined
  } catch {
    return undefined
  }
}

/** Trả undefined nếu dòng hỏng (thiếu mã, trạng thái lạ...) để bỏ qua, không làm sập app. */
export function tuDong(d: readonly unknown[]): BanGhiPhieu | undefined {
  if (d.length < SO_COT_PHIEU_CU) return undefined
  const o = d.map((v) => (v === null || v === undefined ? '' : String(v)))
  const [id, khachId, ngayNhan, moTa, ghiChu, tien, ngayTra, phuongThuc, trangThai, chiTiet, , daXoa, thayTheCho, thayTheBoi, khoaNhapLo] = o
  if (!id || !khachId || (trangThai !== 'chua-thanh-toan' && trangThai !== 'da-tra' && trangThai !== 'da-huy')) return undefined
  const tongTien = tien === '' ? undefined : Number(tien)
  if (tongTien !== undefined && !Number.isFinite(tongTien)) return undefined
  const chiTietTien = docChiTiet(chiTiet)
  return {
    id,
    khachId,
    ngayNhan,
    moTa,
    ...(ghiChu ? { ghiChu } : {}),
    ...(tongTien !== undefined ? { tongTien } : {}),
    ...(chiTietTien ? { chiTietTien } : {}),
    ...(ngayTra ? { ngayTra } : {}),
    ...(phuongThuc ? { phuongThuc: phuongThuc as PhuongThuc } : {}),
    trangThai: trangThai as TrangThai,
    ...(daXoa?.toUpperCase() === 'TRUE' ? { daXoa: true } : {}),
    ...(thayTheCho ? { thayTheCho } : {}),
    ...(thayTheBoi ? { thayTheBoi } : {}),
    ...(khoaNhapLo ? { khoaNhapLo } : {}),
  }
}

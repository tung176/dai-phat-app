export const SO_MONG_KIOTVIET: {
  soPhieuDaTra: number
  soPhieuChuaThanhToan: number
  soKhach: number
  soDichVu: number
  tienMat: number
  chuyenKhoan: number
}
export function docThuMuc(thuMuc: string): {
  hoaDon: Array<Record<string, string | number | undefined>>
  datHang: Array<Record<string, string | number | undefined>>
  khach: Array<Record<string, string | number | undefined>>
  sanPham: Array<Record<string, string | number | undefined>>
}
export function chay(argv: string[], dau?: { in?: (s: string) => void }): number

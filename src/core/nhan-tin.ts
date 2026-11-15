/** Ticket 10: danh sách nhắn tin theo nhóm và xuất CSV. Chỉ lấy khách có số hợp lệ VÀ đã đồng ý nhận tin. */
import { TEN_NHOM, type KhachTheoNhom, type MaNhom } from './nhom-khach.ts'
import type { NgayIso } from './types.ts'

export interface DongNhanTin {
  khachId: string
  ten: string
  soDienThoai: string
  nhom: MaNhom
  ngayMuaGanNhat: NgayIso
}

export interface DanhSachNhanTin {
  dong: DongNhanTin[]
  tongTrongNhom: number
  /** Bị loại vì chưa có số điện thoại hợp lệ (kể cả khi đã đồng ý). */
  thieuSo: number
  /** Có số hợp lệ nhưng chưa tick đồng ý nhận tin. */
  chuaDongY: number
}

export function danhSachNhanTin(khach: KhachTheoNhom[], nhom: MaNhom): DanhSachNhanTin {
  const trong = khach.filter((k) => k.nhom === nhom)
  const dong: DongNhanTin[] = []
  let thieuSo = 0
  let chuaDongY = 0
  for (const k of trong) {
    if (!k.dungDuocSo || !k.soDienThoai) thieuSo += 1
    else if (!k.dongYNhanTin) chuaDongY += 1
    else if (k.ngayMuaGanNhat) {
      dong.push({
        khachId: k.khachId,
        ten: k.tenHienThi,
        soDienThoai: k.soDienThoai,
        nhom,
        ngayMuaGanNhat: k.ngayMuaGanNhat,
      })
    }
  }
  return { dong, tongTrongNhom: trong.length, thieuSo, chuaDongY }
}

function oCsv(v: string): string {
  // Chặn công thức trong Excel/Sheets: ô bắt đầu bằng = + - @ thì thêm nháy đơn đứng đầu.
  const an = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v
  return /[",\r\n]/.test(an) ? `"${an.replace(/"/g, '""')}"` : an
}

function ngayDmy(n: NgayIso): string {
  return `${n.slice(8, 10)}/${n.slice(5, 7)}/${n.slice(0, 4)}`
}

/** UTF-8 có BOM (mở đúng tiếng Việt trong Excel), xuống dòng CRLF. */
export function nhanTinSangCsv(dong: DongNhanTin[]): string {
  const dauDe = ['Tên', 'Số điện thoại', 'Nhóm', 'Ngày mua gần nhất']
  const dongCsv = dong.map((d) =>
    [d.ten, d.soDienThoai, TEN_NHOM[d.nhom], ngayDmy(d.ngayMuaGanNhat)].map(oCsv).join(','),
  )
  return '\uFEFF' + [dauDe.join(','), ...dongCsv].join('\r\n')
}

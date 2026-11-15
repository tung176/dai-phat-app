import type { NgayIso, Phieu } from './types.ts'

export interface BaDanhSach {
  choTinhTien: Phieu[]
  choTraKhach: Phieu[]
  daTra: Phieu[]
}

/** Chia phiếu thành ba danh sách theo nhãn suy ra. Phiếu có nhãn khác (ví dụ đã hủy sau này) không vào danh sách nào. */
export function baDanhSach(phieus: Phieu[]): BaDanhSach {
  return {
    choTinhTien: phieus.filter((p) => p.nhan === 'Chưa tính tiền'),
    choTraKhach: phieus.filter((p) => p.nhan === 'Chờ trả khách'),
    daTra: phieus.filter((p) => p.nhan === 'Đã trả'),
  }
}

export interface NguongCanhBao {
  /** Quá số ngày này kể từ ngày nhận mà chưa tính tiền thì cảnh báo. */
  chuaTinhTien: number
  /** Quá số ngày này kể từ ngày nhận mà chưa trả khách thì cảnh báo. */
  chuaTraKhach: number
}

export const NGUONG_MAC_DINH: NguongCanhBao = { chuaTinhTien: 7, chuaTraKhach: 14 }

export interface MucDoChuaLay {
  phieu: Phieu
  soNgay: number
  quaNguong: boolean
}

const MOT_NGAY_MS = 24 * 60 * 60 * 1000

/** Số ngày lịch từ ngày nhận đến hôm nay (cả hai dạng "YYYY-MM-DD"). */
export function soNgayTon(ngayNhan: NgayIso, homNay: NgayIso): number {
  const t = (n: NgayIso) => Date.parse(`${n}T00:00:00Z`)
  return Math.round((t(homNay) - t(ngayNhan)) / MOT_NGAY_MS)
}

/**
 * Phiếu còn đồ ở tiệm (chưa tính tiền hoặc chờ trả khách), lâu nhất trước.
 * Cảnh báo khi số ngày vượt hẳn ngưỡng (đúng ngưỡng chưa cảnh báo).
 * `homNay` truyền vào để kết quả ổn định khi kiểm thử.
 */
export function doChuaLay(phieus: Phieu[], homNay: NgayIso, nguong: NguongCanhBao): MucDoChuaLay[] {
  return phieus
    .filter((p) => p.nhan === 'Chưa tính tiền' || p.nhan === 'Chờ trả khách')
    .map((phieu) => {
      const soNgay = soNgayTon(phieu.ngayNhan, homNay)
      const han = phieu.nhan === 'Chưa tính tiền' ? nguong.chuaTinhTien : nguong.chuaTraKhach
      return { phieu, soNgay, quaNguong: soNgay > han }
    })
    .sort((a, b) => b.soNgay - a.soNgay || a.phieu.id.localeCompare(b.phieu.id))
}

export interface DieuKienTim {
  /** Khớp tên khách hoặc ghi chú vị trí; không phân biệt hoa thường và dấu. */
  tuKhoa?: string
  /** Ngày nhận, gồm cả hai đầu. */
  tuNgay?: NgayIso
  denNgay?: NgayIso
}

function chuanHoa(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
}

export function timPhieu(phieus: Phieu[], dk: DieuKienTim): Phieu[] {
  const tu = chuanHoa(dk.tuKhoa?.trim() ?? '')
  return phieus.filter((p) => {
    if (dk.tuNgay && p.ngayNhan < dk.tuNgay) return false
    if (dk.denNgay && p.ngayNhan > dk.denNgay) return false
    if (tu === '') return true
    return chuanHoa(p.khach.ten).includes(tu) || chuanHoa(p.ghiChu ?? '').includes(tu)
  })
}

const laSoNgayHopLe = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0

/** Đọc ngưỡng đã lưu cục bộ; thiếu hoặc hỏng thì dùng mặc định. */
export function docNguong(chuoi: string | null): NguongCanhBao {
  if (!chuoi) return NGUONG_MAC_DINH
  try {
    const v: unknown = JSON.parse(chuoi)
    if (typeof v === 'object' && v !== null) {
      const { chuaTinhTien, chuaTraKhach } = v as Record<string, unknown>
      if (laSoNgayHopLe(chuaTinhTien) && laSoNgayHopLe(chuaTraKhach)) return { chuaTinhTien, chuaTraKhach }
    }
  } catch {
    // dữ liệu hỏng: dùng mặc định
  }
  return NGUONG_MAC_DINH
}

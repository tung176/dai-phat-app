import { taoDichVuKhach, type DichVuKhach } from './khach-service.ts'
import { taoKhoKhachTrongBoNho } from './kho-khach.ts'
import { taoKhoPhieuTrongBoNho } from './kho-trong-bo-nho.ts'
import { taoDichVuPhieu, type DichVuPhieu } from './phieu-service.ts'
import type { BanGhiPhieu } from './types.ts'

/**
 * Dữ liệu giả cùng quy mô tiệm thật (ticket 15): khoảng 264 khách, 1.500 phiếu, nhiều tên phổ biến một từ
 * (Mai, Lan, Hương, Phượng, Phương...) với số điện thoại khác nhau. Toàn bộ là dữ liệu bịa, không có tên hay số thật.
 */

/** Bộ sinh số giả ngẫu nhiên cố định hạt giống để kết quả lặp lại được. */
function taoNgauNhien(hat: number): () => number {
  let x = hat >>> 0
  return () => {
    x = (Math.imul(x, 1664525) + 1013904223) >>> 0
    return x / 0x100000000
  }
}

const TEN_PHO_BIEN: Array<[string, number]> = [
  ['Mai', 14],
  ['Lan', 12],
  ['Hương', 12],
  ['Phượng', 7],
  ['Phương', 9],
  ['Hà', 8],
  ['Linh', 8],
  ['Hoa', 7],
  ['Hạnh', 6],
  ['Hằng', 6],
  ['Thảo', 6],
  ['Ngọc', 5],
]
const HO = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Võ', 'Đặng', 'Bùi', 'Đỗ']
const DEM = ['Thị', 'Văn', 'Minh', 'Ngọc', 'Thanh', 'Hoàng']
const TEN = ['An', 'Bình', 'Châu', 'Dung', 'Đạt', 'Giang', 'Hiếu', 'Khoa', 'Lộc', 'Nam', 'Oanh', 'Quân', 'Sơn', 'Tuấn', 'Vy']
const NHAN_PHIEU = ['quần áo', 'chăn', 'rèm', 'áo khoác', 'giày', 'thú nhồi bông']

export interface DuLieuGia {
  khach: DichVuKhach
  phieu: DichVuPhieu
  soKhach: number
  soPhieu: number
}

export async function taoDuLieuGia(opt: { soKhach?: number; soPhieu?: number; hat?: number } = {}): Promise<DuLieuGia> {
  const soKhach = opt.soKhach ?? 264
  const soPhieu = opt.soPhieu ?? 1500
  const ngauNhien = taoNgauNhien(opt.hat ?? 15)
  const chon = <T>(ds: T[]): T => ds[Math.floor(ngauNhien() * ds.length)]!
  const khoKhach = taoKhoKhachTrongBoNho()
  const khoPhieu = taoKhoPhieuTrongBoNho()
  const khach = taoDichVuKhach({ khoKhach, khoPhieu, homNay: () => '2026-11-15' })
  const phieu = taoDichVuPhieu({ kho: khoPhieu, khach })

  const tenKhach: string[] = []
  for (const [ten, n] of TEN_PHO_BIEN) for (let i = 0; i < n; i += 1) tenKhach.push(ten)
  while (tenKhach.length < soKhach) tenKhach.push(`${chon(HO)} ${chon(DEM)} ${chon(TEN)} ${tenKhach.length}`)
  tenKhach.length = soKhach

  const idKhach: string[] = []
  for (let i = 0; i < tenKhach.length; i += 1) {
    const r = ngauNhien()
    // 80% có số hợp lệ khác nhau, 12% thiếu số, 8% số sai.
    const sdt = r < 0.8 ? `09${String(10000000 + i * 7919).slice(0, 8)}` : r < 0.92 ? undefined : '123456'
    const k = await khach.them({ ten: tenKhach[i]!, soDienThoai: sdt })
    idKhach.push(k.id)
  }

  for (let i = 0; i < soPhieu; i += 1) {
    const ngay = new Date(Date.UTC(2025, 0, 1) + Math.floor(ngauNhien() * 680) * 86_400_000).toISOString().slice(0, 10)
    const r = ngauNhien()
    const goc: Omit<BanGhiPhieu, 'id'> = {
      khachId: chon(idKhach),
      ngayNhan: ngay,
      moTa: `${1 + Math.floor(ngauNhien() * 5)} ${chon(NHAN_PHIEU)}`,
      trangThai: 'chua-thanh-toan',
    }
    if (r < 0.02) await khoPhieu.them(goc)
    else if (r < 0.04) await khoPhieu.them({ ...goc, tongTien: 120000 })
    else if (r < 0.05) await khoPhieu.them({ ...goc, trangThai: 'da-huy' })
    else {
      await khoPhieu.them({
        ...goc,
        tongTien: 50000 + Math.floor(ngauNhien() * 40) * 5000,
        trangThai: 'da-tra',
        ngayTra: ngay,
        phuongThuc: r < 0.5 ? 'tien-mat' : 'chuyen-khoan',
      })
    }
  }
  return { khach, phieu, soKhach, soPhieu }
}

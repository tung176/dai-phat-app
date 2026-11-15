import type { NgayIso, Phieu } from './types.ts'

export interface TongHopThu {
  soPhieu: number
  tongTien: number
  tienMat: number
  chuyenKhoan: number
}

/**
 * Tổng tiền đã thu theo ngày trả (gồm cả hai đầu). Chỉ tính phiếu "Đã trả":
 * bỏ phiếu đã hủy và phiếu xóa mềm; phiếu đã sửa tính theo giá trị mới nhất.
 */
export function tongHopThu(phieus: Phieu[], khoang: { tuNgay: NgayIso; denNgay: NgayIso }): TongHopThu {
  const kq: TongHopThu = { soPhieu: 0, tongTien: 0, tienMat: 0, chuyenKhoan: 0 }
  for (const p of phieus) {
    if (p.daXoa || p.nhan !== 'Đã trả' || p.ngayTra === undefined || p.tongTien === undefined) continue
    if (p.ngayTra < khoang.tuNgay || p.ngayTra > khoang.denNgay) continue
    kq.soPhieu += 1
    kq.tongTien += p.tongTien
    if (p.phuongThuc === 'tien-mat') kq.tienMat += p.tongTien
    else kq.chuyenKhoan += p.tongTien
  }
  return kq
}

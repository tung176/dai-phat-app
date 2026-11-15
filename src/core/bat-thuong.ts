import { soNgayTon } from './danh-sach-phieu.ts'
import type { BatThuong, CaiDatPhieu, LoaiThaoTac, ThoiDiem } from './nhat-ky-phieu.ts'
import type { BanGhiPhieu } from './types.ts'

export interface NguCanhBatThuong {
  loai: LoaiThaoTac
  truoc: BanGhiPhieu
  sau: BanGhiPhieu
  /** Ngày thao tác "YYYY-MM-DD". */
  ngayThaoTac: string
  luc: ThoiDiem
  /** Số thay đổi phiếu của người này trong ngày thao tác, đã gồm thay đổi đang xét. */
  soThayDoiTrongNgay: number
  caiDat: CaiDatPhieu
}

const thang = (ngay: string | undefined): string[] => (ngay ? [ngay.slice(0, 7)] : [])

/** Các tháng mà phiếu chạm tới (ngày nhận và ngày trả, trước và sau khi đổi). */
function thangLienQuan(...bg: BanGhiPhieu[]): Set<string> {
  return new Set(bg.flatMap((b) => [...thang(b.ngayNhan), ...thang(b.ngayTra)]))
}

/**
 * Chấm các quy tắc bất thường. Hàm thuần: không đọc kho, dễ thử ở sát ngưỡng.
 * Mức cao: đụng tiền đã thu, hủy/xóa phiếu đã trả tiền mặt, tháng đã khóa.
 * Mức trung bình: lùi ngày xa, quá nhiều thay đổi, giảm tiền mạnh.
 */
export function danhGiaBatThuong(c: NguCanhBatThuong): BatThuong[] {
  const { truoc, sau, caiDat } = c
  const ng = caiDat.nguong
  const kq: BatThuong[] = []

  const doiTienHoacPt = truoc.tongTien !== sau.tongTien || truoc.phuongThuc !== sau.phuongThuc
  if (c.loai === 'sua' && truoc.trangThai === 'da-tra' && doiTienHoacPt) {
    kq.push({
      quyTac: 'sua-tien-hoac-phuong-thuc-da-tra',
      mucDo: 'cao',
      moTa: 'Sửa tiền hoặc phương thức của phiếu đã trả.',
    })
  }

  const biHuy = truoc.trangThai !== 'da-huy' && sau.trangThai === 'da-huy'
  const biXoa = !truoc.daXoa && sau.daXoa === true
  if ((biHuy || biXoa) && truoc.trangThai === 'da-tra' && truoc.phuongThuc === 'tien-mat') {
    kq.push({
      quyTac: 'huy-hoac-xoa-da-tra-tien-mat',
      mucDo: 'cao',
      moTa: 'Hủy hoặc xóa phiếu đã trả bằng tiền mặt.',
    })
  }

  if (c.loai === 'lui-ngay') {
    const xaNhat = Math.max(
      sau.ngayNhan !== truoc.ngayNhan ? soNgayTon(sau.ngayNhan, c.ngayThaoTac) : 0,
      sau.ngayTra && sau.ngayTra !== truoc.ngayTra ? soNgayTon(sau.ngayTra, c.ngayThaoTac) : 0,
    )
    if (xaNhat > ng.luiNgayQuaNgay) {
      kq.push({
        quyTac: 'lui-ngay-qua-nguong',
        mucDo: 'trung-binh',
        moTa: `Lùi ngày ${xaNhat} ngày so với ngày thao tác (ngưỡng ${ng.luiNgayQuaNgay}).`,
      })
    }
  }

  if (caiDat.khoaThang.bat) {
    const dung = [...thangLienQuan(truoc, sau)].filter((t) => caiDat.khoaThang.cacThang.includes(t))
    if (dung.length > 0) {
      kq.push({
        quyTac: 'thang-da-khoa',
        mucDo: 'cao',
        moTa: `Thay đổi vào tháng đã khóa: ${dung.join(', ')}.`,
      })
    }
  }

  if (c.soThayDoiTrongNgay > ng.thayDoiMoiNgay) {
    kq.push({
      quyTac: 'qua-nhieu-thay-doi-trong-ngay',
      mucDo: 'trung-binh',
      moTa: `Thay đổi thứ ${c.soThayDoiTrongNgay} trong ngày của một người (ngưỡng ${ng.thayDoiMoiNgay}).`,
    })
  }

  if (
    c.loai === 'sua' &&
    truoc.tongTien !== undefined &&
    sau.tongTien !== undefined &&
    (truoc.tongTien - sau.tongTien) * 100 > truoc.tongTien * ng.giamTienPhanTram
  ) {
    kq.push({
      quyTac: 'giam-tong-tien-qua-nguong',
      mucDo: 'trung-binh',
      moTa: `Giảm tổng tiền từ ${truoc.tongTien} xuống ${sau.tongTien} (quá ${ng.giamTienPhanTram}%).`,
    })
  }

  return kq
}

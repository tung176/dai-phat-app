/** Dịch vụ trong bảng giá. Giá vốn để trống, ticket 07 nhập bảng giá thật. */
export interface DichVu {
  ma: string
  ten: string
  /** 'kg': tính theo cân; 'so-luong': tính theo cái/bộ (giày, vest...). */
  kieu: 'kg' | 'so-luong'
  /** Đơn giá mỗi kg hoặc mỗi đơn vị, đồng. */
  donGia: number
  /** Dưới số kg này thì tính đúng số tiền này (không nhân đơn giá). */
  toiThieu?: { duoiKg: number; tien: number }
  /** Từ số kg này trở lên thì cảnh báo (vd Topper chỉ nhận dưới 6kg). */
  canhBaoTuKg?: number
  giaVon?: number
}

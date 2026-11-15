import { describe, expect, it } from 'vitest'
import { boKiotVietGia, dongHoaDon, QUAN_AO } from './kiotviet.thu.ts'
import { chuyenKiotViet } from './kiotviet-chuyen.ts'

// Seam: chuyenKiotViet(các bảng đọc từ 4 file Excel KiotViet) -> gói nhập lịch sử + báo cáo kiểm tra.
// Dữ liệu giả cùng cấu trúc cột; số mong đợi là hằng số tính tay từ bộ dữ liệu giả.
describe('chuyển dữ liệu KiotViet thành gói nhập lịch sử', () => {
  it('đếm đúng phiếu đã trả, phiếu tạm, khách, dịch vụ và tách tiền mặt, chuyển khoản', () => {
    const g = chuyenKiotViet(boKiotVietGia())
    expect(g.baoCao).toMatchObject({
      soPhieuDaTra: 3, // hóa đơn đã hủy bị bỏ
      soPhieuChuaThanhToan: 1,
      soKhach: 5,
      soDichVu: 4,
      tienMat: 98000 + 140000,
      chuyenKhoan: 60000,
      soNhapSaiQuyTrinh: 1,
      soKhachLe: 1,
    })
    expect(g.baoCao.loi).toEqual([])
  })

  it('ngày nhận lấy từ phiếu đặt hàng liên kết, ngày trả từ thời gian hóa đơn, không qua đặt hàng thì bỏ trống và gắn nhãn', () => {
    const g = chuyenKiotViet(boKiotVietGia())
    const theoMa = (m: string) => g.phieu.find((p) => p.maHoaDonCu === m)!
    expect(theoMa('HD000001')).toMatchObject({
      loai: 'da-tra',
      ngayNhan: '2026-10-01',
      ngayTra: '2026-10-04',
      phuongThuc: 'tien-mat',
      maDatHangCu: 'DH000001',
      khachMaCu: 'KH000001',
    })
    expect(theoMa('HD000001').nhapSaiQuyTrinh).toBeUndefined()
    expect(theoMa('HD000002')).toMatchObject({ phuongThuc: 'chuyen-khoan', ngayNhan: '2026-10-02' })
    const le = theoMa('HD000003')
    expect(le.ngayNhan).toBeUndefined()
    expect(le).toMatchObject({ ngayTra: '2026-10-06', nhapSaiQuyTrinh: true })
    expect(le.khachMaCu).toBeUndefined()
    expect(le.ghiChu).toContain('Khách Lẻ Giả')
  })

  it('giữ nguyên số tiền khách đã trả của KiotViet dù khác tiền hàng', () => {
    const g = chuyenKiotViet(boKiotVietGia())
    const p = g.phieu.find((x) => x.maHoaDonCu === 'HD000001')!
    expect(p.tongTien).toBe(98000) // tiền hàng 99.000, giảm 1.000, đã trả 98.000
    expect(p.dong).toHaveLength(2)
    expect(p.moTa).toContain('Giặt & Sấy quần áo thông thường x3,5')
  })

  it('phiếu tạm thành phiếu chưa thanh toán kèm tiền khách cần trả và ngày nhận', () => {
    const g = chuyenKiotViet(boKiotVietGia())
    const tam = g.phieu.filter((p) => p.loai === 'chua-thanh-toan')
    expect(tam).toHaveLength(1)
    expect(tam[0]).toMatchObject({ maDatHangCu: 'DH000003', ngayNhan: '2026-10-20', tongTien: 50000, khachMaCu: 'KH000003' })
    expect(tam[0]!.ngayTra).toBeUndefined()
    expect(tam[0]!.maHoaDonCu).toBeUndefined()
  })

  it('phân loại số điện thoại, giữ nguyên số sai và vẫn giữ khách chưa mua', () => {
    const g = chuyenKiotViet(boKiotVietGia())
    expect(g.baoCao.soDienThoai).toEqual({ hopLe: 2, saiDoDai: 1, coChu: 1, trong: 1 })
    const ten = (m: string) => g.khach.find((k) => k.maCu === m)!
    expect(ten('KH000003').soDienThoai).toBe('09000003')
    expect(ten('KH000004').soDienThoai).toBe('gần chợ giả')
    expect(ten('KH000005').soDienThoai).toBeUndefined()
    expect(ten('KH000002').ngayTao).toBe('2026-09-02')
  })

  it('dịch vụ lấy giá bán, bỏ giá vốn; chăn ga, topper, quần áo thường gắn mức tối thiểu và cảnh báo', () => {
    const g = chuyenKiotViet(boKiotVietGia())
    const dv = (m: string) => g.dichVu.find((d) => d.maCu === m)!
    expect(dv('SP000001')).toMatchObject({ kieu: 'kg', donGia: 14000, toiThieu: { duoiKg: 2, tien: 28000 } })
    expect(dv('SP000022')).toMatchObject({ kieu: 'kg', donGia: 25000, toiThieu: { duoiKg: 2, tien: 50000 } })
    expect(dv('SP000023')).toMatchObject({ kieu: 'kg', donGia: 35000, toiThieu: { duoiKg: 3, tien: 100000 }, canhBaoTuKg: 6 })
    expect(dv('SP000024')).toMatchObject({ kieu: 'so-luong', donGia: 40000 })
    expect(dv('SP000024').toiThieu).toBeUndefined()
    expect(JSON.stringify(g.dichVu)).not.toContain('99999')
  })

  it('đối chiếu với số mong đợi: khớp thì khop true, lệch thì khop false', () => {
    const mong = { soPhieuDaTra: 3, soPhieuChuaThanhToan: 1, soKhach: 5, soDichVu: 4, tienMat: 238000, chuyenKhoan: 61000 }
    const g = chuyenKiotViet(boKiotVietGia(), { mong })
    const m = (t: string) => g.baoCao.doiChieu.find((x) => x.ten === t)!
    expect(m('tienMat')).toEqual({ ten: 'tienMat', co: 238000, mong: 238000, khop: true })
    expect(m('chuyenKhoan')).toEqual({ ten: 'chuyenKhoan', co: 60000, mong: 61000, khop: false })
    expect(g.baoCao.doiChieu).toHaveLength(6)
  })

  it('hóa đơn vừa tiền mặt vừa chuyển khoản, hoặc không có tiền, hoặc dịch vụ ngoài bảng giá là lỗi chặn', () => {
    const b = boKiotVietGia()
    b.hoaDon.push(
      ...dongHoaDon({ ma: 'HD000010', ngay: '2026-10-08', khach: 'KH000001', tienMat: 10000, chuyenKhoan: 18000, dong: [{ ...QUAN_AO, soLuong: 2 }] }),
      ...dongHoaDon({ ma: 'HD000011', ngay: '2026-10-08', khach: 'KH000001', dong: [{ ...QUAN_AO, soLuong: 2 }] }),
      ...dongHoaDon({ ma: 'HD000012', ngay: '2026-10-08', khach: 'KH000001', tienMat: 5000, dong: [{ ma: 'SP999999', ten: 'Lạ', soLuong: 1, donGia: 5000 }] }),
    )
    const loi = chuyenKiotViet(b).baoCao.loi.join('\n')
    expect(loi).toContain('HD000010')
    expect(loi).toContain('HD000011')
    expect(loi).toContain('SP999999')
  })

  it('mã khách trên hóa đơn không có trong danh sách khách là lỗi chặn', () => {
    const b = boKiotVietGia()
    b.hoaDon.push(...dongHoaDon({ ma: 'HD000020', ngay: '2026-10-08', khach: 'KH999999', tienMat: 28000, dong: [{ ...QUAN_AO, soLuong: 2 }] }))
    expect(chuyenKiotViet(b).baoCao.loi.join('\n')).toContain('KH999999')
  })

  it('phiếu đặt hàng muộn hơn hóa đơn thì bỏ ngày nhận (không để ngày trả trước ngày nhận) và cảnh báo', () => {
    const b = boKiotVietGia()
    for (const d of b.datHang) if (d['Mã đặt hàng'] === 'DH000001') d['Thời gian'] = Number(d['Thời gian']) + 30
    const g = chuyenKiotViet(b)
    expect(g.phieu.find((p) => p.maHoaDonCu === 'HD000001')!.ngayNhan).toBeUndefined()
    expect(g.baoCao.canhBao.join('\n')).toContain('muộn hơn')
  })

  it('báo cáo không chứa tên hay số điện thoại khách', () => {
    const text = JSON.stringify(chuyenKiotViet(boKiotVietGia()).baoCao)
    expect(text).not.toContain('Khách Giả')
    expect(text).not.toContain('0900000001')
  })

  it('chạy lại cùng dữ liệu cho cùng gói', () => {
    expect(chuyenKiotViet(boKiotVietGia())).toEqual(chuyenKiotViet(boKiotVietGia()))
  })
})

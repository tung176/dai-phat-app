import { bangGiaGia } from './bang-gia-gia.ts'
import type { DichVu } from './bang-gia.ts'
import {
  DINH_DANG_GOI,
  PHIEN_BAN_GOI,
  phanLoaiSoDienThoai,
  type BaoCaoGoi,
  type GoiDichVu,
  type GoiDongPhieu,
  type GoiKhach,
  type GoiNhapLichSu,
  type GoiPhieu,
  type MucDoiChieu,
} from './kiotviet-goi.ts'
import type { NgayIso, PhuongThuc } from './types.ts'

/** Một dòng của file Excel KiotViet: khóa là tên cột, giá trị là chữ hoặc số. */
export type DongKiotViet = Record<string, string | number | undefined>

/** Các bảng đã đọc từ file Excel. Không cần file sổ quỹ (thu chi suy ra từ phiếu). */
export interface BangKiotViet {
  /** DanhSachChiTietHoaDon: mỗi dòng là một dòng hàng, cột cấp hóa đơn lặp lại ở mọi dòng. */
  hoaDon: DongKiotViet[]
  /** DanhSachChiTietDatHang: cùng cấu trúc. */
  datHang: DongKiotViet[]
  /** DanhSachKhachHang. */
  khach: DongKiotViet[]
  /** DanhSachSanPham. */
  sanPham: DongKiotViet[]
}

export interface SoMong {
  soPhieuDaTra: number
  soPhieuChuaThanhToan: number
  soKhach: number
  soDichVu: number
  tienMat: number
  chuyenKhoan: number
}

export interface TuyChonChuyen {
  /** Số liệu cần khớp với KiotViet; có thì báo cáo có mục đối chiếu. */
  mong?: Partial<SoMong>
}

const chuoi = (d: DongKiotViet, cot: string): string => {
  const v = d[cot]
  return v === undefined ? '' : String(v).trim()
}
const so = (d: DongKiotViet, cot: string): number => {
  const v = d[cot]
  if (typeof v === 'number') return v
  const n = Number(String(v ?? '').trim())
  return Number.isFinite(n) ? n : 0
}

/** Ngày Excel là số ngày kể từ 30/12/1899, phần lẻ là giờ trong ngày (giờ địa phương, không đổi múi giờ). */
function ngayTuExcel(v: number): NgayIso {
  return new Date((Math.floor(v) - 25569) * 86_400_000).toISOString().slice(0, 10)
}

function hienSoLuong(x: number): string {
  return String(Math.round(x * 100) / 100).replace('.', ',')
}

function nhom(dong: DongKiotViet[], cot: string): Map<string, { dau: DongKiotViet; cacDong: DongKiotViet[] }> {
  const m = new Map<string, { dau: DongKiotViet; cacDong: DongKiotViet[] }>()
  for (const d of dong) {
    const ma = chuoi(d, cot)
    if (ma === '') continue
    const co = m.get(ma)
    if (co) co.cacDong.push(d)
    else m.set(ma, { dau: d, cacDong: [d] })
  }
  return m
}

/** Quy tắc tối thiểu và cảnh báo đã có ở bộ tính tiền, gắn vào dịch vụ thật theo mã hàng KiotViet hoặc theo tên. */
const MA_QUY_TAC: Record<string, DichVu> = {
  SP000001: bangGiaGia.quanAoThuong,
  SP000022: bangGiaGia.chanGa,
  SP000023: bangGiaGia.topper,
}

function boDau(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/đ/g, 'd')
}

function quyTacTheoTen(ten: string): DichVu | undefined {
  const t = boDau(ten)
  if (t.includes('topper')) return bangGiaGia.topper
  if (/chan\b.*\bga\b/.test(t)) return bangGiaGia.chanGa
  if (t.includes('quan ao thong thuong')) return bangGiaGia.quanAoThuong
  return undefined
}

/** Chủ tiệm xác nhận 15/11/2026: "Sấy Không Giặt" (8.000đ) tính theo kg, không có mức tối thiểu. */
function laDichVuTheoKgKhongToiThieu(ma: string, ten: string): boolean {
  return ma === 'SP000004' || boDau(ten).trim() === 'say khong giat'
}

function chuyenDichVu(d: DongKiotViet): GoiDichVu {
  const ma = chuoi(d, 'Mã hàng')
  const ten = chuoi(d, 'Tên hàng')
  const quyTac = MA_QUY_TAC[ma] ?? quyTacTheoTen(ten)
  const theoKg = quyTac !== undefined || chuoi(d, 'ĐVT').toLowerCase() === 'kg' || laDichVuTheoKgKhongToiThieu(ma, ten)
  const kieu = theoKg ? 'kg' : 'so-luong'
  const nhomHang = chuoi(d, 'Nhóm hàng(3 Cấp)')
  return {
    maCu: ma,
    ten,
    ...(nhomHang ? { nhom: nhomHang } : {}),
    kieu,
    donGia: so(d, 'Giá bán'),
    ...(quyTac?.toiThieu ? { toiThieu: { ...quyTac.toiThieu } } : {}),
    ...(quyTac?.canhBaoTuKg !== undefined ? { canhBaoTuKg: quyTac.canhBaoTuKg } : {}),
    // Không mang giá vốn: cột này KiotViet điền sai.
    dangDung: d['Đang kinh doanh'] === undefined ? true : so(d, 'Đang kinh doanh') !== 0,
  }
}

const laTien = (n: number) => Number.isInteger(n) && n > 0

/** Liệt kê tối đa vài mã để người đọc biết chỗ tìm, không kèm tên khách. */
function lietKe(ma: string[]): string {
  return ma.length <= 5 ? ma.join(', ') : `${ma.slice(0, 5).join(', ')} và ${ma.length - 5} mã khác`
}

export function chuyenKiotViet(b: BangKiotViet, tuyChon: TuyChonChuyen = {}): GoiNhapLichSu {
  const loi: string[] = []
  const canhBao: string[] = []

  const dichVu = b.sanPham.filter((d) => chuoi(d, 'Mã hàng') !== '').map(chuyenDichVu)
  const maDichVu = new Set(dichVu.map((d) => d.maCu))
  const tenDichVu = new Map(dichVu.map((d) => [d.maCu, d.ten]))

  const khach: GoiKhach[] = b.khach
    .filter((d) => chuoi(d, 'Mã khách hàng') !== '')
    .map((d) => {
      const sdt = chuoi(d, 'Điện thoại')
      return {
        maCu: chuoi(d, 'Mã khách hàng'),
        ten: chuoi(d, 'Tên khách hàng'),
        ...(sdt ? { soDienThoai: sdt } : {}),
        ngayTao: ngayTuExcel(so(d, 'Ngày tạo')),
      }
    })
  const maKhach = new Set(khach.map((k) => k.maCu))
  const dem = { hopLe: 0, saiDoDai: 0, coChu: 0, trong: 0 }
  for (const k of khach) dem[phanLoaiSoDienThoai(k.soDienThoai)] += 1

  const dongPhieu = (cacDong: DongKiotViet[], maDonCu: string): GoiDongPhieu[] =>
    cacDong.map((d) => {
      const maHang = chuoi(d, 'Mã hàng')
      if (!maDichVu.has(maHang)) loi.push(`${maDonCu}: dịch vụ ${maHang || '(trống)'} không có trong bảng giá.`)
      return { maHang, soLuong: so(d, 'Số lượng'), donGia: so(d, 'Đơn giá'), thanhTien: so(d, 'Thành tiền') }
    })

  const moTaTu = (dong: GoiDongPhieu[], cacDong: DongKiotViet[]): string =>
    dong
      .map((x, i) => `${tenDichVu.get(x.maHang) ?? chuoi(cacDong[i]!, 'Tên hàng')} x${hienSoLuong(x.soLuong)}`)
      .join(', ')

  const kiemTraKhach = (ma: string, maDonCu: string): void => {
    if (ma !== '' && !maKhach.has(ma)) loi.push(`${maDonCu}: mã khách ${ma} không có trong danh sách khách.`)
  }

  // Phiếu đặt hàng: lấy ngày nhận cho hóa đơn, và phiếu tạm thành phiếu chưa thanh toán.
  const datHang = nhom(b.datHang, 'Mã đặt hàng')
  const hoaDon = nhom(b.hoaDon, 'Mã hóa đơn')

  const phieu: GoiPhieu[] = []
  let tienMat = 0
  let chuyenKhoan = 0
  let soHuy = 0
  let soLechCanTra = 0
  let tongLechCanTra = 0
  const maLechCanTra: string[] = []
  const maNgayNhanMuon: string[] = []
  const maTheViDien: string[] = []

  for (const [ma, h] of hoaDon) {
    const d = h.dau
    const trangThai = chuoi(d, 'Trạng thái')
    if (trangThai === 'Đã hủy') {
      soHuy += 1
      continue
    }
    if (trangThai !== 'Hoàn thành') {
      canhBao.push(`Hóa đơn ${ma} có trạng thái "${trangThai}", không nhập.`)
      continue
    }
    const tm = so(d, 'Tiền mặt')
    const ck = so(d, 'Chuyển khoản')
    if (so(d, 'Thẻ') > 0 || so(d, 'Ví') > 0) maTheViDien.push(ma)
    let phuongThuc: PhuongThuc | undefined
    if (tm > 0 && ck > 0) loi.push(`Hóa đơn ${ma} trả cả tiền mặt và chuyển khoản, app chỉ nhận một phương thức mỗi phiếu.`)
    else if (tm > 0) phuongThuc = 'tien-mat'
    else if (ck > 0) phuongThuc = 'chuyen-khoan'
    else loi.push(`Hóa đơn ${ma} không có tiền mặt hay chuyển khoản.`)
    const tongTien = tm + ck
    if (phuongThuc && !laTien(tongTien)) loi.push(`Hóa đơn ${ma} có số tiền không phải số đồng nguyên dương.`)
    const canTra = so(d, 'Khách cần trả')
    if (canTra !== tongTien) {
      soLechCanTra += 1
      tongLechCanTra += canTra - tongTien
      maLechCanTra.push(ma)
    }
    const maKh = chuoi(d, 'Mã khách hàng')
    kiemTraKhach(maKh, `Hóa đơn ${ma}`)

    const maDat = chuoi(d, 'Mã đặt hàng')
    const dat = maDat === '' ? undefined : datHang.get(maDat)
    if (maDat !== '' && !dat) canhBao.push(`Hóa đơn ${ma} gắn mã đặt hàng ${maDat} không có trong file đặt hàng, coi như không có phiếu đặt hàng.`)
    const ngayTra = ngayTuExcel(so(d, 'Thời gian'))
    let ngayNhan: NgayIso | undefined = dat ? ngayTuExcel(so(dat.dau, 'Thời gian')) : undefined
    if (ngayNhan !== undefined && ngayNhan > ngayTra) {
      maNgayNhanMuon.push(ma)
      ngayNhan = undefined
    }
    const dong = dongPhieu(h.cacDong, `Hóa đơn ${ma}`)
    const ghiChuKh = maKh === '' && chuoi(d, 'Tên khách hàng') ? `Tên ghi trên hóa đơn: ${chuoi(d, 'Tên khách hàng')}` : ''
    const ghiChu = [ghiChuKh, chuoi(d, 'Ghi chú')].filter((x) => x !== '').join('; ')
    if (phuongThuc === 'tien-mat') tienMat += tongTien
    if (phuongThuc === 'chuyen-khoan') chuyenKhoan += tongTien
    phieu.push({
      loai: 'da-tra',
      maHoaDonCu: ma,
      ...(dat ? { maDatHangCu: maDat } : {}),
      ...(maKh ? { khachMaCu: maKh } : {}),
      ...(ngayNhan ? { ngayNhan } : {}),
      ngayTra,
      ...(phuongThuc ? { phuongThuc } : {}),
      tongTien,
      moTa: moTaTu(dong, h.cacDong),
      ...(ghiChu ? { ghiChu } : {}),
      ...(dat ? {} : { nhapSaiQuyTrinh: true }),
      dong,
    })
  }

  const datCoHoaDon = new Set([...hoaDon.values()].map((h) => chuoi(h.dau, 'Mã đặt hàng')))
  let soDatHangKhac = 0
  let soDatHangHoanThanhKhongHoaDon = 0
  for (const [ma, o] of datHang) {
    const d = o.dau
    const trangThai = chuoi(d, 'Trạng thái')
    if (trangThai === 'Phiếu tạm') {
      if (chuoi(d, 'Mã hóa đơn') !== '') canhBao.push(`Phiếu tạm ${ma} lại có mã hóa đơn, vẫn nhập là chưa thanh toán.`)
      const maKh = chuoi(d, 'Mã khách hàng')
      kiemTraKhach(maKh, `Phiếu tạm ${ma}`)
      const tongTien = so(d, 'Khách cần trả')
      if (!laTien(tongTien)) loi.push(`Phiếu tạm ${ma} có số tiền không phải số đồng nguyên dương.`)
      const dong = dongPhieu(o.cacDong, `Phiếu tạm ${ma}`)
      phieu.push({
        loai: 'chua-thanh-toan',
        maDatHangCu: ma,
        ...(maKh ? { khachMaCu: maKh } : {}),
        ngayNhan: ngayTuExcel(so(d, 'Thời gian')),
        tongTien,
        moTa: moTaTu(dong, o.cacDong),
        dong,
      })
    } else if (trangThai === 'Hoàn thành') {
      if (!datCoHoaDon.has(ma)) soDatHangHoanThanhKhongHoaDon += 1
    } else {
      soDatHangKhac += 1
    }
  }

  // Sắp theo thời gian rồi theo mã để gói ổn định giữa các lần chạy.
  const khoa = (p: GoiPhieu) => `${p.ngayTra ?? p.ngayNhan ?? ''}|${p.maHoaDonCu ?? p.maDatHangCu ?? ''}`
  phieu.sort((x, y) => khoa(x).localeCompare(khoa(y)))

  const nhapSaiQuyTrinh = phieu.filter((p) => p.nhapSaiQuyTrinh).length
  const soKhachLe = phieu.filter((p) => p.khachMaCu === undefined).length

  if (maTheViDien.length) loi.push(`Hóa đơn có thanh toán bằng thẻ hoặc ví (app chưa hỗ trợ): ${lietKe(maTheViDien)}.`)
  if (soHuy) canhBao.push(`${soHuy} hóa đơn đã hủy, không nhập.`)
  if (soLechCanTra)
    canhBao.push(
      `${soLechCanTra} hóa đơn có khách cần trả khác khách đã trả (lệch tổng ${tongLechCanTra}đ), giữ số khách đã trả: ${lietKe(maLechCanTra)}.`,
    )
  if (maNgayNhanMuon.length)
    canhBao.push(`${maNgayNhanMuon.length} hóa đơn có phiếu đặt hàng muộn hơn hóa đơn, bỏ ngày nhận: ${lietKe(maNgayNhanMuon)}.`)
  if (soDatHangKhac) canhBao.push(`${soDatHangKhac} phiếu đặt hàng có trạng thái khác "Phiếu tạm" và "Hoàn thành", không nhập.`)
  if (soDatHangHoanThanhKhongHoaDon)
    canhBao.push(`${soDatHangHoanThanhKhongHoaDon} phiếu đặt hàng "Hoàn thành" không có hóa đơn tương ứng, không nhập.`)
  if (soKhachLe) canhBao.push(`${soKhachLe} phiếu không có mã khách, sẽ gắn vào một khách lẻ giữ chỗ (tên ghi trên hóa đơn nằm ở ghi chú phiếu).`)

  // Dịch vụ có số lượng lẻ trong lịch sử nhưng đang kiểu "số lượng": người dùng xem lại.
  const leTheoMa = new Map<string, number>()
  for (const p of phieu) for (const x of p.dong) if (!Number.isInteger(x.soLuong)) leTheoMa.set(x.maHang, (leTheoMa.get(x.maHang) ?? 0) + 1)
  const dichVuLe = dichVu.filter((d) => d.kieu === 'so-luong' && leTheoMa.has(d.maCu)).map((d) => d.maCu)
  if (dichVuLe.length)
    canhBao.push(`${dichVuLe.length} dịch vụ kiểu số lượng nhưng lịch sử có số lượng lẻ (có thể tính theo kg): ${lietKe(dichVuLe)}.`)

  const co: SoMong = {
    soPhieuDaTra: phieu.filter((p) => p.loai === 'da-tra').length,
    soPhieuChuaThanhToan: phieu.filter((p) => p.loai === 'chua-thanh-toan').length,
    soKhach: khach.length,
    soDichVu: dichVu.length,
    tienMat,
    chuyenKhoan,
  }
  const doiChieu: MucDoiChieu[] = []
  if (tuyChon.mong) {
    for (const ten of ['soPhieuDaTra', 'soPhieuChuaThanhToan', 'soKhach', 'soDichVu', 'tienMat', 'chuyenKhoan'] as const) {
      const mong = tuyChon.mong[ten]
      if (mong !== undefined) doiChieu.push({ ten, co: co[ten], mong, khop: co[ten] === mong })
    }
  }

  const baoCao: BaoCaoGoi = {
    ...co,
    soNhapSaiQuyTrinh: nhapSaiQuyTrinh,
    soKhachLe,
    soDienThoai: dem,
    doiChieu,
    canhBao,
    loi,
  }
  return { dinhDang: DINH_DANG_GOI, phienBan: PHIEN_BAN_GOI, nguon: 'kiotviet', dichVu, khach, phieu, baoCao }
}


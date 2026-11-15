/**
 * Ticket 09: định dạng "bảng đối chiếu" của lô nhập từ sổ giấy (phần thuần, không I/O).
 * Ticket 12 để Claude đọc ảnh sổ rồi xuất đúng định dạng này; màn nhập lô dán hoặc chọn file này.
 * Mô tả đầy đủ: docs/bang-doi-chieu-so.md.
 */
import { ngayHopLe } from './phieu-service.ts'
import { LoiNghiepVu, type NgayIso } from './types.ts'

export const TEN_DINH_DANG = 'bang-doi-chieu-so'
export const PHIEN_BAN_DINH_DANG = 1

/** Các ô của một dòng sổ có thể bị đánh dấu "không chắc". */
export const CAC_TRUONG_O = ['khach', 'viTri', 'moTa', 'tien', 'ngayNhan', 'ngayTra', 'tienMat', 'chuyenKhoan'] as const
export type TruongO = (typeof CAC_TRUONG_O)[number]

/** Một dòng sổ. Ô không chắc luôn để trống và nằm trong khongChac (tô vàng), không bao giờ đoán. */
export interface DongSo {
  /** Mã dòng, duy nhất trong lô. Cùng mã ở hai lần nhập nghĩa là cùng một dòng sổ. */
  ma: string
  /** Các dòng cùng mã nhóm là một phiếu một tổng tiền (dấu ngoặc nhọn trong sổ). */
  nhom?: string
  khach: string
  /** Ghi chú vị trí của khách (tầng 2, B5, bách khoa...). */
  viTri?: string
  moTa: string
  /** Đồng, số nguyên dương. */
  tien?: number
  ngayNhan?: NgayIso
  ngayTra?: NgayIso
  tienMat?: boolean
  chuyenKhoan?: boolean
  khongChac?: TruongO[]
}

export interface BangDoiChieu {
  lo: string
  dong: DongSo[]
}

function loi(thongBao: string): never {
  throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', thongBao)
}

const laDoiTuong = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

function docDong(
  tho: unknown,
  stt: number,
  ngayNhom: NgayIso | undefined,
  canhBao: string[],
): DongSo {
  if (!laDoiTuong(tho)) loi(`Dòng thứ ${stt} không phải một đối tượng.`)
  const ma = tho.ma === undefined || tho.ma === null || tho.ma === '' ? `d${stt}` : String(tho.ma).trim()
  const nhan = `dòng "${ma}"`
  const chuoi = (v: unknown): string | undefined =>
    typeof v === 'string' && v.trim() !== '' ? v.trim() : undefined

  const khongChac = new Set<TruongO>()
  if (tho.khongChac !== undefined) {
    if (!Array.isArray(tho.khongChac)) loi(`Ô "khongChac" của ${nhan} phải là danh sách.`)
    for (const t of tho.khongChac) {
      if (!(CAC_TRUONG_O as readonly unknown[]).includes(t)) loi(`Tên ô không chắc lạ ở ${nhan}: ${String(t)}.`)
      khongChac.add(t as TruongO)
    }
  }
  /** Ô có giá trị sai kiểu bị tô vàng và để trống. */
  const hong = (truong: TruongO, lyDo: string) => {
    khongChac.add(truong)
    canhBao.push(`${nhan}: ô "${truong}" ${lyDo}, đã để trống và tô vàng.`)
  }

  const d: DongSo = { ma, khach: '', moTa: '' }
  const nhom = chuoi(tho.nhom)
  if (nhom) d.nhom = nhom
  d.khach = chuoi(tho.khach) ?? ''
  const viTri = chuoi(tho.viTri)
  if (viTri) d.viTri = viTri
  d.moTa = chuoi(tho.moTa) ?? ''

  if (tho.tien !== undefined && tho.tien !== null) {
    if (typeof tho.tien === 'number' && Number.isInteger(tho.tien) && tho.tien > 0) d.tien = tho.tien
    else hong('tien', 'không phải số đồng nguyên dương')
  }
  const ngay = (v: unknown, truong: 'ngayNhan' | 'ngayTra'): NgayIso | undefined => {
    if (v === undefined || v === null || v === '') return undefined
    if (typeof v === 'string' && ngayHopLe(v)) return v
    hong(truong, 'không phải ngày dạng YYYY-MM-DD')
    return undefined
  }
  const ngayNhan = ngay(tho.ngayNhan, 'ngayNhan') ?? (khongChac.has('ngayNhan') ? undefined : ngayNhom)
  if (ngayNhan) d.ngayNhan = ngayNhan
  const ngayTra = ngay(tho.ngayTra, 'ngayTra')
  if (ngayTra) d.ngayTra = ngayTra
  for (const dau of ['tienMat', 'chuyenKhoan'] as const) {
    const v = tho[dau]
    if (v === undefined || v === null || v === false) continue
    if (v === true) d[dau] = true
    else hong(dau, 'không phải true hoặc false')
  }

  if (khongChac.size > 0) {
    // Ô không chắc không bao giờ giữ giá trị: để trống để chủ tiệm tự điền.
    for (const t of khongChac) delete d[t]
    d.khongChac = CAC_TRUONG_O.filter((t) => khongChac.has(t))
  }
  return d
}

/** Đọc bảng đối chiếu từ chuỗi JSON. Sai định dạng thì ném DU_LIEU_KHONG_HOP_LE. canhBao liệt kê ô bị tô vàng vì giá trị hỏng. */
export function docBangDoiChieu(nguon: string): { bang: BangDoiChieu; canhBao: string[] } {
  let tho: unknown
  try {
    tho = JSON.parse(nguon)
  } catch {
    loi('Nội dung không phải JSON hợp lệ.')
  }
  if (!laDoiTuong(tho) || tho.dinhDang !== TEN_DINH_DANG) loi(`Không phải bảng đối chiếu (dinhDang phải là "${TEN_DINH_DANG}").`)
  if (tho.phienBan !== PHIEN_BAN_DINH_DANG) loi(`Chỉ đọc được phienBan ${PHIEN_BAN_DINH_DANG}.`)
  const lo = typeof tho.lo === 'string' ? tho.lo.trim() : ''
  if (lo === '') loi('Thiếu mã lô ("lo").')

  const canhBao: string[] = []
  const dong: DongSo[] = []
  const them = (d: unknown, ngayNhom?: NgayIso) => dong.push(docDong(d, dong.length + 1, ngayNhom, canhBao))
  if (tho.dong !== undefined) {
    if (!Array.isArray(tho.dong)) loi('"dong" phải là danh sách.')
    for (const d of tho.dong) them(d)
  }
  if (tho.nhomNgay !== undefined) {
    if (!Array.isArray(tho.nhomNgay)) loi('"nhomNgay" phải là danh sách.')
    for (const n of tho.nhomNgay) {
      if (!laDoiTuong(n) || typeof n.ngayNhan !== 'string' || !ngayHopLe(n.ngayNhan) || !Array.isArray(n.dong)) {
        loi('Mỗi nhóm ngày cần "ngayNhan" (YYYY-MM-DD) và danh sách "dong".')
      }
      for (const d of n.dong) them(d, n.ngayNhan)
    }
  }
  const daThay = new Set<string>()
  for (const d of dong) {
    if (daThay.has(d.ma)) loi(`Trùng mã dòng "${d.ma}".`)
    daThay.add(d.ma)
  }
  return { bang: { lo, dong }, canhBao }
}

/** Xuất bảng ra JSON dạng phẳng (mỗi dòng có ngày nhận riêng). */
export function xuatBangDoiChieu(bang: BangDoiChieu): string {
  return JSON.stringify({ dinhDang: TEN_DINH_DANG, phienBan: PHIEN_BAN_DINH_DANG, lo: bang.lo, dong: bang.dong }, null, 2)
}

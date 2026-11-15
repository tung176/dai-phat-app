/**
 * Ticket 09: dịch vụ nhập lô từ sổ giấy.
 * xemTruoc: phân loại từng phiếu dự kiến, gợi ý khách, đề xuất ghép phiếu tạm KiotViet. Không ghi gì.
 * ghi: chỉ chạy khi chủ tiệm đã duyệt; chỉ ghi các phiếu đã sẵn sàng (không còn câu hỏi), bằng đúng
 * các thao tác của dịch vụ lõi (nhận đồ, chốt tiền, trả khách).
 */
import type { DichVuKhach } from './khach-service.ts'
import { chuanHoaTen, doGiong, type Khach } from './khach.ts'
import type { KhoPhieu } from './kho-phieu.ts'
import type { DongThayDoi, GiaTriJson, KhoNhatKyPhieu, ThoiDiem } from './nhat-ky-phieu.ts'
import type { BangDoiChieu, DongSo, TruongO } from './nhap-lo.ts'
import type { DichVuPhieu } from './phieu-service.ts'
import type { DichVuSuaSai } from './sua-sai-service.ts'
import { LoiNghiepVu, type BanGhiPhieu, type NgayIso, type Phieu, type PhuongThuc } from './types.ts'

/** Mốc ngày ranh giới với KiotViet và ngưỡng lệch tiền. Mặc định theo ticket 09, đặt thành tham số. */
export interface ThamSoNhapLo {
  /** Dòng có ngày trả đến ngày này đã nằm trong KiotViet: bỏ qua. */
  ngayTraDaCoDen: NgayIso
  /** Dòng nhận đến ngày này (mà chưa trả hoặc trả từ ngayTraMoiTu) khớp với phiếu tạm KiotViet. */
  ngayNhanCuDen: NgayIso
  ngayTraMoiTu: NgayIso
  /** Dòng nhận từ ngày này trở đi tạo phiếu mới. */
  ngayNhanMoiTu: NgayIso
  /** Lệch tiền tối đa (đồng) giữa tiền sổ và tiền phiếu tạm cũ để còn coi là gần đúng. */
  nguongLechTien: number
}

export const THAM_SO_MAC_DINH: ThamSoNhapLo = {
  ngayTraDaCoDen: '2026-10-30',
  ngayNhanCuDen: '2026-10-29',
  // KiotViet có hóa đơn đến hết 30/10, nên khoản trả từ 31/10 chưa có trong KiotViet.
  ngayTraMoiTu: '2026-10-31',
  ngayNhanMoiTu: '2026-10-30',
  nguongLechTien: 500,
}

export type LoaiPhieuDuKien = 'tam' | 'cho-tra' | 'da-tra' | 'can-hoi' | 'bo-qua' | 'da-nhap'

export type KhachChon = { khachId: string } | 'moi'
export type GhepChon = { phieuId: string } | 'tao-moi'

/** Các quyết định của chủ tiệm. Khóa khách là PhieuDuKien.khach.khoa, khóa ghép là PhieuDuKien.khoa. */
export interface QuyetDinhNhapLo {
  khach?: Record<string, KhachChon>
  ghep?: Record<string, GhepChon>
}

export interface UngVienGhep {
  phieuId: string
  tenKhach: string
  ngayNhan: NgayIso
  tongTien?: number
  /** Chênh lệch tiền tuyệt đối với tiền sổ; undefined khi một trong hai bên chưa có tiền. */
  lechTien?: number
}

export interface PhieuDuKien {
  /** Khóa nhận diện ổn định: "mã lô:mã dòng" (nhóm: "mã lô:g:mã nhóm"). */
  khoa: string
  maDong: string[]
  loai: LoaiPhieuDuKien
  lyDoHoi: string[]
  canhBao: string[]
  khach: {
    ten: string
    viTri?: string
    khoa: string
    goiY: Khach[]
    trangThai: 'moi' | 'can-chon' | 'da-chon'
    chon?: KhachChon
  }
  ngayNhan?: NgayIso
  moTa: string
  tien?: number
  ngayTra?: NgayIso
  phuongThuc?: PhuongThuc
  /** Có khi loai = 'bo-qua' mà đã có phiếu trùng trong kho. */
  trungVoi?: string
  /** Có khi loai = 'da-nhap'. */
  phieuDaCo?: string
  /** Có khi dòng nằm ở vùng ghép với phiếu tạm KiotViet, hoặc đang làm nốt một phiếu nhập dở. */
  ghep?: {
    ungVien: UngVienGhep[]
    chon?: GhepChon
    trangThai: 'can-chon' | 'da-chon'
    tiepTuc: boolean
  }
  sanSang: boolean
}

export interface KetQuaXemTruoc {
  lo: string
  phieu: PhieuDuKien[]
  soSanSang: number
  tongKet: Record<LoaiPhieuDuKien, number>
}

export interface KetQuaGhiPhieu {
  khoa: string
  maDong: string[]
  ket: 'da-tao' | 'hoan-thanh-phieu-cu' | 'loi'
  phieuId?: string
  loi?: string
}

export interface DichVuNhapLo {
  xemTruoc(bang: BangDoiChieu, quyetDinh?: QuyetDinhNhapLo): Promise<KetQuaXemTruoc>
  /** duyet phải là true: chủ tiệm đã xem bảng đối chiếu. Chỉ ghi các phiếu sẵn sàng. */
  ghi(bang: BangDoiChieu, quyetDinh: QuyetDinhNhapLo, dauVao: { duyet: true }): Promise<{ ketQua: KetQuaGhiPhieu[] }>
}

function homNayMacDinh(): ThoiDiem {
  const d = new Date()
  const p = (x: number) => String(x).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

const TEN_O: Record<TruongO, string> = {
  khach: 'khách',
  viTri: 'ghi chú vị trí',
  moTa: 'mô tả',
  tien: 'tiền',
  ngayNhan: 'ngày nhận',
  ngayTra: 'ngày trả',
  tienMat: 'dấu tiền mặt',
  chuyenKhoan: 'dấu chuyển khoản',
}

export const khoaTenKhach = (ten: string, viTri?: string): string =>
  `${chuanHoaTen(ten)}|${chuanHoaTen(viTri ?? '')}`

const TRUONG_NHAT_KY = ['khachId', 'ngayNhan', 'moTa', 'tongTien', 'ngayTra', 'phuongThuc', 'trangThai', 'khoaNhapLo'] as const

function thayDoiGiua(truoc: BanGhiPhieu | undefined, sau: BanGhiPhieu): DongThayDoi[] {
  const ra: DongThayDoi[] = []
  for (const k of TRUONG_NHAT_KY) {
    const a = (truoc?.[k] ?? null) as GiaTriJson
    const b = (sau[k] ?? null) as GiaTriJson
    if (a !== b) ra.push({ truong: k, truoc: a, sau: b })
  }
  return ra
}

interface NhomDong {
  khoa: string
  dong: DongSo[]
}

function gomNhom(bang: BangDoiChieu): NhomDong[] {
  const ra: NhomDong[] = []
  const theoNhom = new Map<string, NhomDong>()
  for (const d of bang.dong) {
    if (d.nhom === undefined) {
      ra.push({ khoa: `${bang.lo}:${d.ma}`, dong: [d] })
      continue
    }
    const co = theoNhom.get(d.nhom)
    if (co) co.dong.push(d)
    else {
      const moi = { khoa: `${bang.lo}:g:${d.nhom}`, dong: [d] }
      theoNhom.set(d.nhom, moi)
      ra.push(moi)
    }
  }
  return ra
}

/** Dữ liệu một phiếu dự kiến, gộp từ các dòng của nhóm. Mâu thuẫn hoặc thiếu thì ghi vào lyDoHoi. */
function gopDong(nhom: NhomDong): {
  ten: string
  viTri?: string
  ngayNhan?: NgayIso
  moTa: string
  tien?: number
  ngayTra?: NgayIso
  phuongThuc?: PhuongThuc
  lyDoHoi: string[]
  canhBao: string[]
} {
  const lyDoHoi: string[] = []
  const canhBao: string[] = []
  const { dong } = nhom
  for (const d of dong) {
    for (const t of d.khongChac ?? []) lyDoHoi.push(`Dòng ${d.ma}: ô ${TEN_O[t]} chưa chắc, cần điền.`)
  }
  /** Giá trị duy nhất của một ô trong nhóm; khác nhau thì hỏi. */
  const duyNhat = <T extends string | number>(lay: (d: DongSo) => T | undefined, ten: string): T | undefined => {
    const co = [...new Set(dong.map(lay).filter((v): v is T => v !== undefined))]
    if (co.length > 1) lyDoHoi.push(`Các dòng cùng nhóm có ${ten} khác nhau (${co.join(', ')}).`)
    return co.length === 1 ? co[0] : undefined
  }
  const khachCoDau = duyNhat((d) => (d.khach === '' ? undefined : d.khach), 'khách')
  const ten = khachCoDau ?? ''
  const viTri = duyNhat((d) => d.viTri, 'ghi chú vị trí')
  const ngayNhan = duyNhat((d) => d.ngayNhan, 'ngày nhận')
  const ngayTra = duyNhat((d) => d.ngayTra, 'ngày trả')
  const moTa = [...new Set(dong.map((d) => d.moTa).filter((m) => m !== ''))].join('; ')
  const cacTien = dong.map((d) => d.tien).filter((t): t is number => t !== undefined)
  let tien: number | undefined
  if (cacTien.length > 1) lyDoHoi.push('Nhóm có nhiều số tiền; mỗi nhóm chỉ ghi một tổng tiền.')
  else tien = cacTien[0]
  const tienMat = dong.some((d) => d.tienMat)
  const chuyenKhoan = dong.some((d) => d.chuyenKhoan)

  if (ten === '') lyDoHoi.push('Thiếu tên khách.')
  if (moTa === '') lyDoHoi.push('Thiếu mô tả đồ.')
  if (ngayNhan === undefined) lyDoHoi.push('Thiếu ngày nhận.')
  if (ngayNhan && ngayTra && ngayTra < ngayNhan) lyDoHoi.push('Ngày trả trước ngày nhận.')
  let phuongThuc: PhuongThuc | undefined
  if (tienMat && chuyenKhoan) lyDoHoi.push('Dấu ở cả hai cột tiền mặt và chuyển khoản.')
  else if (tienMat || chuyenKhoan) {
    phuongThuc = tienMat ? 'tien-mat' : 'chuyen-khoan'
    if (tien === undefined) lyDoHoi.push('Có dấu thanh toán mà thiếu tiền.')
    if (ngayTra === undefined) lyDoHoi.push('Có dấu thanh toán mà thiếu ngày trả.')
  } else if (ngayTra !== undefined) {
    if (tien !== undefined) {
      lyDoHoi.push('Có tiền và ngày trả nhưng thiếu dấu tiền mặt hay chuyển khoản; cần điền dấu, không tự đoán.')
    } else {
      canhBao.push('Có ngày trả nhưng chưa có tiền và chưa có dấu tiền mặt hay chuyển khoản: bỏ qua ngày trả.')
    }
  }
  return {
    ten,
    ...(viTri !== undefined ? { viTri } : {}),
    ...(ngayNhan !== undefined ? { ngayNhan } : {}),
    moTa,
    ...(tien !== undefined ? { tien } : {}),
    ...(ngayTra !== undefined ? { ngayTra } : {}),
    ...(phuongThuc ? { phuongThuc } : {}),
    lyDoHoi,
    canhBao,
  }
}

export function taoDichVuNhapLo(phuThuoc: {
  kho: KhoPhieu
  phieu: DichVuPhieu
  khach: DichVuKhach
  suaSai: DichVuSuaSai
  khoNhatKy: KhoNhatKyPhieu
  dongHo?: () => ThoiDiem
  thamSo?: Partial<ThamSoNhapLo>
}): DichVuNhapLo {
  const { kho, phieu, khach, suaSai, khoNhatKy } = phuThuoc
  const dongHo = phuThuoc.dongHo ?? homNayMacDinh
  const ts: ThamSoNhapLo = { ...THAM_SO_MAC_DINH, ...phuThuoc.thamSo }

  async function tinh(bang: BangDoiChieu, quyetDinh: QuyetDinhNhapLo): Promise<KetQuaXemTruoc> {
    const [tatCa, dsKhach] = await Promise.all([phieu.danhSachDayDu(), khach.danhSach()])
    const theoKhoa = new Map(tatCa.filter((p) => p.khoaNhapLo).map((p) => [p.khoaNhapLo!, p]))
    const viTriKhach = new Map(dsKhach.map((k) => [k.id, k.viTri]))
    const phieuMo = tatCa.filter((p) => !p.daXoa && p.trangThai === 'chua-thanh-toan' && !p.khoaNhapLo)
    const dangHieuLuc = tatCa.filter((p) => !p.daXoa && p.trangThai !== 'da-huy')

    const ra: PhieuDuKien[] = []
    for (const nhom of gomNhom(bang)) {
      const g = gopDong(nhom)
      const lyDoHoi = [...g.lyDoHoi]
      let loai: LoaiPhieuDuKien
      if (lyDoHoi.length > 0) loai = 'can-hoi'
      else if (g.phuongThuc) loai = 'da-tra'
      else loai = g.tien === undefined ? 'tam' : 'cho-tra'

      const khoaKhach = khoaTenKhach(g.ten, g.viTri)
      const goiY = g.ten === '' ? [] : await khach.goiYKhop(g.ten)
      const chonKhach = quyetDinh.khach?.[khoaKhach]
      const chonHopLe =
        chonKhach === 'moi' || (chonKhach !== undefined && dsKhach.some((k) => k.id === chonKhach.khachId))
          ? chonKhach
          : undefined
      const dp: PhieuDuKien = {
        khoa: nhom.khoa,
        maDong: nhom.dong.map((d) => d.ma),
        loai,
        lyDoHoi,
        canhBao: g.canhBao,
        khach: {
          ten: g.ten,
          ...(g.viTri !== undefined ? { viTri: g.viTri } : {}),
          khoa: khoaKhach,
          goiY,
          trangThai: chonHopLe ? 'da-chon' : goiY.length > 0 ? 'can-chon' : 'moi',
          ...(chonHopLe ? { chon: chonHopLe } : {}),
        },
        ngayNhan: g.ngayNhan,
        moTa: g.moTa,
        ...(g.tien !== undefined ? { tien: g.tien } : {}),
        ...(g.ngayTra !== undefined ? { ngayTra: g.ngayTra } : {}),
        ...(g.phuongThuc ? { phuongThuc: g.phuongThuc } : {}),
        sanSang: false,
      }
      if (dp.ngayNhan === undefined) delete dp.ngayNhan

      const daCo = theoKhoa.get(nhom.khoa)
      if (daCo) {
        const xong =
          daCo.trangThai !== 'chua-thanh-toan' ||
          daCo.daXoa === true ||
          loai === 'tam' ||
          (loai === 'cho-tra' && daCo.tongTien !== undefined)
        if (xong) {
          dp.loai = 'da-nhap'
          dp.phieuDaCo = daCo.id
          ra.push(dp)
          continue
        }
        if (loai !== 'can-hoi') {
          dp.ghep = {
            ungVien: [dongUngVien(daCo, g.tien)],
            chon: { phieuId: daCo.id },
            trangThai: 'da-chon',
            tiepTuc: true,
          }
          dp.sanSang = true
          ra.push(dp)
          continue
        }
      }

      if (loai !== 'can-hoi') {
        const { ngayNhan, ngayTra } = g
        if (ngayTra !== undefined && ngayTra <= ts.ngayTraDaCoDen) {
          dp.loai = 'bo-qua'
          const trung = dangHieuLuc.find(
            (p) =>
              p.trangThai === 'da-tra' &&
              doGiong(p.khach.ten, g.ten) !== undefined &&
              (p.ngayNhan === ngayNhan || p.ngayTra === ngayTra) &&
              (p.tongTien === undefined || g.tien === undefined || Math.abs(p.tongTien - g.tien) <= ts.nguongLechTien),
          )
          if (trung) dp.trungVoi = trung.id
          ra.push(dp)
          continue
        }
        if (ngayNhan !== undefined && ngayNhan >= ts.ngayNhanMoiTu) {
          // Nhận từ mốc mới: tạo phiếu mới.
        } else if (ngayNhan !== undefined && ngayNhan <= ts.ngayNhanCuDen) {
          if (ngayTra !== undefined && ngayTra < ts.ngayTraMoiTu) {
            dp.loai = 'can-hoi'
            dp.lyDoHoi.push(
              'Nhận từ trước mốc KiotViet nhưng ngày trả nằm giữa hai mốc: kiểm tra lại ngày trong sổ.',
            )
            ra.push(dp)
            continue
          }
          const lechToiDa = ts.nguongLechTien
          const ungVien = phieuMo
            .filter(
              (p) =>
                p.ngayNhan === ngayNhan &&
                doGiong(p.khach.ten, g.ten) !== undefined &&
                !viTriKhacNhau(viTriKhach.get(p.khachId), g.viTri) &&
                (p.tongTien === undefined || g.tien === undefined || Math.abs(p.tongTien - g.tien) <= lechToiDa),
            )
            .map((p) => dongUngVien(p, g.tien))
            .sort((a, b) => (a.lechTien ?? 0) - (b.lechTien ?? 0) || a.phieuId.localeCompare(b.phieuId))
          const chon = quyetDinh.ghep?.[nhom.khoa]
          const chonHopLe =
            chon === 'tao-moi' || (chon !== undefined && ungVien.some((u) => u.phieuId === chon.phieuId)) ? chon : undefined
          dp.ghep = {
            ungVien,
            ...(chonHopLe ? { chon: chonHopLe } : {}),
            trangThai: chonHopLe ? 'da-chon' : 'can-chon',
            tiepTuc: false,
          }
        } else {
          dp.loai = 'can-hoi'
          dp.lyDoHoi.push('Ngày nhận nằm giữa hai mốc ranh giới KiotViet: kiểm tra tham số mốc ngày.')
          ra.push(dp)
          continue
        }
        const khachXong = dp.khach.trangThai !== 'can-chon'
        const ghepXong = dp.ghep === undefined || dp.ghep.trangThai === 'da-chon'
        const ghepPhieuCu = typeof dp.ghep?.chon === 'object'
        dp.sanSang = ghepXong && (khachXong || ghepPhieuCu)
      }
      ra.push(dp)
    }
    const tongKet: Record<LoaiPhieuDuKien, number> = { tam: 0, 'cho-tra': 0, 'da-tra': 0, 'can-hoi': 0, 'bo-qua': 0, 'da-nhap': 0 }
    for (const p of ra) tongKet[p.loai] += 1
    return { lo: bang.lo, phieu: ra, soSanSang: ra.filter((p) => p.sanSang).length, tongKet }
  }

  function viTriKhacNhau(a?: string, b?: string): boolean {
    return a !== undefined && b !== undefined && chuanHoaTen(a) !== chuanHoaTen(b)
  }

  function dongUngVien(p: Phieu, tienSo: number | undefined): UngVienGhep {
    return {
      phieuId: p.id,
      tenKhach: p.khach.tenHienThi,
      ngayNhan: p.ngayNhan,
      ...(p.tongTien !== undefined ? { tongTien: p.tongTien } : {}),
      ...(p.tongTien !== undefined && tienSo !== undefined ? { lechTien: Math.abs(p.tongTien - tienSo) } : {}),
    }
  }

  return {
    xemTruoc: (bang, quyetDinh = {}) => tinh(bang, quyetDinh),

    async ghi(bang, quyetDinh, dauVao) {
      if (dauVao?.duyet !== true) {
        throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', 'Cần duyệt bảng đối chiếu trước khi ghi.')
      }
      const kq = await tinh(bang, quyetDinh)
      const khachMoi = new Map<string, string>()
      const ketQua: KetQuaGhiPhieu[] = []

      async function layKhachId(p: PhieuDuKien): Promise<string> {
        const chon = p.khach.chon
        if (chon && chon !== 'moi') return chon.khachId
        const da = khachMoi.get(p.khach.khoa)
        if (da) return da
        const moi = await khach.them({ ten: p.khach.ten, viTri: p.khach.viTri, nguon: 'nhap-so' })
        khachMoi.set(p.khach.khoa, moi.id)
        return moi.id
      }

      async function dongBanGhi(id: string): Promise<BanGhiPhieu> {
        const b = await kho.lay(id)
        if (!b) throw new LoiNghiepVu('KHONG_TIM_THAY', 'Không tìm thấy phiếu.')
        return b
      }

      for (const p of kq.phieu) {
        if (!p.sanSang) continue
        const lyDoNk = `Nhập lô "${bang.lo}", dòng ${p.maDong.join(', ')}`
        let truoc: BanGhiPhieu | undefined
        let phieuId: string | undefined
        const ghepCu = typeof p.ghep?.chon === 'object' ? p.ghep.chon.phieuId : undefined
        try {
          if (ghepCu !== undefined) {
            phieuId = ghepCu
            truoc = await dongBanGhi(ghepCu)
          } else {
            const moi = await phieu.nhanDo({ khachId: await layKhachId(p), ngayNhan: p.ngayNhan!, moTa: p.moTa })
            phieuId = moi.id
          }
          const b0 = await dongBanGhi(phieuId)
          await kho.ghi({ ...b0, khoaNhapLo: p.khoa })

          let hienTai = (await phieu.lay(phieuId))!
          if (p.tien !== undefined) {
            if (hienTai.tongTien === undefined) hienTai = await phieu.chotTien(phieuId, p.tien)
            else if (hienTai.tongTien !== p.tien && hienTai.trangThai === 'chua-thanh-toan') {
              hienTai = await suaSai.sua(phieuId, { tongTien: p.tien }, `${lyDoNk}: lấy tiền theo sổ`)
            }
          }
          if (p.loai === 'da-tra' && hienTai.trangThai === 'chua-thanh-toan') {
            await phieu.traKhach(phieuId, { ngayTra: p.ngayTra!, phuongThuc: p.phuongThuc! })
          }
          ketQua.push({
            khoa: p.khoa,
            maDong: p.maDong,
            ket: ghepCu !== undefined && !p.ghep?.tiepTuc ? 'hoan-thanh-phieu-cu' : 'da-tao',
            phieuId,
          })
        } catch (e) {
          ketQua.push({
            khoa: p.khoa,
            maDong: p.maDong,
            ket: 'loi',
            ...(phieuId ? { phieuId } : {}),
            loi: e instanceof LoiNghiepVu ? e.message : 'Có lỗi xảy ra khi ghi dòng này.',
          })
        }
        if (phieuId) {
          const sau = await kho.lay(phieuId)
          if (sau) {
            const luc = dongHo()
            const nguoi = await suaSai.nguoiHienTai()
            await khoNhatKy.them({
              luc,
              ngay: luc.slice(0, 10),
              nguoi,
              loai: 'nhap-lo',
              phieuId,
              thayDoi: thayDoiGiua(truoc, sau),
              lyDo: lyDoNk,
              batThuong: [],
            })
          }
        }
      }
      return { ketQua }
    },
  }
}

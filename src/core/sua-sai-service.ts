import { danhGiaBatThuong } from './bat-thuong.ts'
import type { DichVuKhach } from './khach-service.ts'
import type { KhoPhieu } from './kho-phieu.ts'
import {
  CAI_DAT_MAC_DINH,
  type CaiDatPhieu,
  type CongTacChucNang,
  type DaXem,
  type DongThayDoi,
  type GiaTriJson,
  type KhoCaiDatPhieu,
  type KhoNhatKyPhieu,
  type LoaiThaoTac,
  type NguoiThucHien,
  type NguongBatThuong,
  type NhatKyPhieu,
  type ThoiDiem,
} from './nhat-ky-phieu.ts'
import { ngayHopLe, type DichVuPhieu } from './phieu-service.ts'
import { LoiNghiepVu, type BanGhiPhieu, type NgayIso, type Phieu, type PhuongThuc } from './types.ts'

export interface DauVaoSua {
  moTa?: string
  /** Chuỗi trống nghĩa là xóa ghi chú. */
  ghiChu?: string
  /** Sửa tổng tiền: bỏ dòng dịch vụ đã chốt (số mới là số cuối cùng). */
  tongTien?: number
  /** Chỉ phiếu đã trả. */
  phuongThuc?: PhuongThuc
  /** Chỉ dời về sau hoặc giữ nguyên; muốn lùi về trước dùng luiNgay. */
  ngayNhan?: NgayIso
  /** Chỉ phiếu đã trả; cùng quy tắc với ngayNhan. */
  ngayTra?: NgayIso
  khachId?: string
}

export interface DauVaoLuiNgay {
  ngayNhan?: NgayIso
  /** Chỉ phiếu đã trả. */
  ngayTra?: NgayIso
}

export interface DauVaoThayThe {
  khachId?: string
  ngayNhan?: NgayIso
  moTa?: string
  ghiChu?: string
  tongTien?: number
}

export interface MucXemLai {
  nhatKy: NhatKyPhieu
  daXem?: DaXem
}

export interface XemLaiTuan {
  tuNgay: NgayIso
  denNgay: NgayIso
  /** Bất thường lên đầu (mức cao trước), rồi mới đến thay đổi thường; mới nhất trước. */
  muc: MucXemLai[]
  soChuaXem: number
}

export interface DauVaoCaiDat {
  congTac?: Partial<CongTacChucNang>
  nguong?: Partial<NguongBatThuong>
  khoaThang?: { bat?: boolean; cacThang?: string[] }
}

export interface DichVuSuaSai {
  sua(id: string, dauVao: DauVaoSua, lyDo: string): Promise<Phieu>
  huy(id: string, lyDo: string): Promise<Phieu>
  xoaMem(id: string, lyDo: string): Promise<Phieu>
  luiNgay(id: string, dauVao: DauVaoLuiNgay, lyDo: string): Promise<Phieu>
  /** Tạo phiếu mới thay phiếu cũ (cũ chuyển "Đã hủy" và trỏ sang phiếu mới). */
  thayThe(id: string, dauVao: DauVaoThayThe, lyDo: string): Promise<{ cu: Phieu; moi: Phieu }>

  /** Chỉ đọc. Dịch vụ cố ý không có thao tác sửa hay xóa nhật ký. */
  nhatKy(): Promise<NhatKyPhieu[]>
  nhatKyCuaPhieu(phieuId: string): Promise<NhatKyPhieu[]>

  caiDat(): Promise<CaiDatPhieu>
  capNhatCaiDat(dauVao: DauVaoCaiDat, lyDo: string): Promise<CaiDatPhieu>
  /** Chọn người dùng hiện tại (chưa xác thực). Có ghi nhật ký. */
  datNguoiHienTai(nguoiId: string): Promise<CaiDatPhieu>
  nguoiHienTai(): Promise<NguoiThucHien>

  xemLaiTuan(ngayTrongTuan: NgayIso): Promise<XemLaiTuan>
  danhDauDaXem(nhatKyId: string): Promise<void>
  danhDauDaXemTuan(ngayTrongTuan: NgayIso): Promise<number>
  soChuaXem(): Promise<number>
}

function homNayMacDinh(): ThoiDiem {
  const d = new Date()
  const p = (x: number) => String(x).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

const TRUONG_THEO_DOI = [
  'khachId',
  'ngayNhan',
  'moTa',
  'ghiChu',
  'tongTien',
  'chiTietTien',
  'ngayTra',
  'phuongThuc',
  'trangThai',
  'daXoa',
  'thayTheBoi',
] as const

const json = (v: unknown): GiaTriJson => (v === undefined ? null : (structuredClone(v) as GiaTriJson))

function soSanhBanGhi(truoc: BanGhiPhieu, sau: BanGhiPhieu): DongThayDoi[] {
  const ra: DongThayDoi[] = []
  for (const k of TRUONG_THEO_DOI) {
    const a = json(truoc[k])
    const b = json(sau[k])
    if (JSON.stringify(a) !== JSON.stringify(b)) ra.push({ truong: k, truoc: a, sau: b })
  }
  return ra
}

function loi(ma: LoiNghiepVu['ma'], thongBao: string): never {
  throw new LoiNghiepVu(ma, thongBao)
}

function chuanLyDo(lyDo: unknown): string {
  const s = typeof lyDo === 'string' ? lyDo.trim() : ''
  if (s === '') loi('THIEU_LY_DO', 'Cần ghi lý do.')
  return s
}

const THANG_RE = /^\d{4}-(0[1-9]|1[0-2])$/
const laSoKhongAm = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0

/** Thứ Hai đến Chủ Nhật chứa ngày đã cho. */
function tuanCua(ngay: NgayIso): { tuNgay: NgayIso; denNgay: NgayIso } {
  if (!ngayHopLe(ngay)) loi('DU_LIEU_KHONG_HOP_LE', 'Ngày không hợp lệ.')
  const d = new Date(`${ngay}T00:00:00Z`)
  const lui = (d.getUTCDay() + 6) % 7
  const dau = new Date(d.getTime() - lui * 86_400_000)
  const cuoi = new Date(dau.getTime() + 6 * 86_400_000)
  return { tuNgay: dau.toISOString().slice(0, 10), denNgay: cuoi.toISOString().slice(0, 10) }
}

export function taoDichVuSuaSai(phuThuoc: {
  kho: KhoPhieu
  phieu: DichVuPhieu
  khach: DichVuKhach
  khoNhatKy: KhoNhatKyPhieu
  khoCaiDat: KhoCaiDatPhieu
  /** Đồng hồ tiêm vào để thử; trả thời điểm địa phương "YYYY-MM-DDTHH:mm:ss". */
  dongHo?: () => ThoiDiem
}): DichVuSuaSai {
  const { kho, phieu, khach, khoNhatKy, khoCaiDat } = phuThuoc
  const dongHo = phuThuoc.dongHo ?? homNayMacDinh

  async function docCaiDat(): Promise<CaiDatPhieu> {
    return (await khoCaiDat.doc()) ?? structuredClone(CAI_DAT_MAC_DINH)
  }

  function nguoiTu(c: CaiDatPhieu): NguoiThucHien {
    const n = c.danhSachNguoi.find((x) => x.id === c.nguoiHienTai)
    if (!n) loi('DU_LIEU_KHONG_HOP_LE', 'Chưa chọn người dùng hiện tại hợp lệ trong cài đặt.')
    return { id: n.id, ten: n.ten, xacThuc: false }
  }

  async function chuanBi(lyDo: string, congTac?: keyof CongTacChucNang) {
    const lyDoChuan = chuanLyDo(lyDo)
    const caiDat = await docCaiDat()
    if (congTac && !caiDat.congTac[congTac]) {
      loi('CHUC_NANG_TAT', 'Chức năng này đang tắt trong cài đặt.')
    }
    return { lyDo: lyDoChuan, caiDat, nguoi: nguoiTu(caiDat) }
  }

  async function lanTruoc(id: string, choPhep: { daHuy?: boolean } = {}): Promise<BanGhiPhieu> {
    const b = await kho.lay(id)
    if (!b || b.daXoa) loi('KHONG_TIM_THAY', 'Không tìm thấy phiếu.')
    if (b.trangThai === 'da-huy' && !choPhep.daHuy) {
      loi('SAI_TRANG_THAI', 'Phiếu đã hủy, không thao tác thêm được.')
    }
    return b
  }

  /** Ghi một dòng nhật ký, đã chấm bất thường. Gọi sau khi dữ liệu phiếu đã ghi. */
  async function ghiNhatKy(o: {
    loai: LoaiThaoTac
    truoc: BanGhiPhieu
    sau: BanGhiPhieu
    lyDo: string
    caiDat: CaiDatPhieu
    nguoi: NguoiThucHien
    phieuLienKetId?: string
  }): Promise<void> {
    const luc = dongHo()
    const ngay = luc.slice(0, 10)
    const daCo = (await khoNhatKy.tatCa()).filter(
      (n) => n.phieuId !== null && n.nguoi.id === o.nguoi.id && n.ngay === ngay,
    ).length
    await khoNhatKy.them({
      luc,
      ngay,
      nguoi: o.nguoi,
      loai: o.loai,
      phieuId: o.sau.id,
      ...(o.phieuLienKetId ? { phieuLienKetId: o.phieuLienKetId } : {}),
      thayDoi: soSanhBanGhi(o.truoc, o.sau),
      lyDo: o.lyDo,
      batThuong: danhGiaBatThuong({
        loai: o.loai,
        truoc: o.truoc,
        sau: o.sau,
        ngayThaoTac: ngay,
        luc,
        soThayDoiTrongNgay: daCo + 1,
        caiDat: o.caiDat,
      }),
    })
  }

  async function ghiVaTraVe(sau: BanGhiPhieu): Promise<Phieu> {
    await kho.ghi(sau)
    return (await phieu.lay(sau.id))!
  }

  async function kiemTraKhach(khachId: string): Promise<void> {
    const k = await khach.lay(khachId)
    if (!k || k.daGopVao !== undefined) loi('KHONG_TIM_THAY', 'Không tìm thấy khách.')
  }

  function kiemTraNgay(b: BanGhiPhieu): void {
    if (!ngayHopLe(b.ngayNhan)) loi('DU_LIEU_KHONG_HOP_LE', 'Ngày nhận không hợp lệ.')
    if (b.ngayTra !== undefined) {
      if (!ngayHopLe(b.ngayTra)) loi('DU_LIEU_KHONG_HOP_LE', 'Ngày trả không hợp lệ.')
      if (b.ngayTra < b.ngayNhan) loi('DU_LIEU_KHONG_HOP_LE', 'Ngày trả không được trước ngày nhận.')
    }
  }

  const dongTienHopLe = (t: unknown): t is number => typeof t === 'number' && Number.isInteger(t) && t > 0

  return {
    async sua(id, dauVao, lyDo) {
      const c = await chuanBi(lyDo, 'suaTaiCho')
      const truoc = await lanTruoc(id)
      const sau: BanGhiPhieu = { ...truoc }
      if (dauVao.moTa !== undefined) {
        const moTa = dauVao.moTa.trim()
        if (moTa === '') loi('DU_LIEU_KHONG_HOP_LE', 'Cần nhập mô tả đồ.')
        sau.moTa = moTa
      }
      if (dauVao.ghiChu !== undefined) {
        const g = dauVao.ghiChu.trim()
        if (g) sau.ghiChu = g
        else delete sau.ghiChu
      }
      if (dauVao.tongTien !== undefined) {
        if (!dongTienHopLe(dauVao.tongTien)) {
          loi('DU_LIEU_KHONG_HOP_LE', 'Tổng tiền phải là số đồng nguyên dương.')
        }
        sau.tongTien = dauVao.tongTien
        delete sau.chiTietTien
      }
      if (dauVao.phuongThuc !== undefined) {
        if (truoc.trangThai !== 'da-tra') loi('SAI_TRANG_THAI', 'Chỉ phiếu đã trả mới có phương thức.')
        if (dauVao.phuongThuc !== 'tien-mat' && dauVao.phuongThuc !== 'chuyen-khoan') {
          loi('DU_LIEU_KHONG_HOP_LE', 'Cần chọn đúng một phương thức: tiền mặt hoặc chuyển khoản.')
        }
        sau.phuongThuc = dauVao.phuongThuc
      }
      if (dauVao.ngayNhan !== undefined) {
        if (!ngayHopLe(dauVao.ngayNhan)) loi('DU_LIEU_KHONG_HOP_LE', 'Ngày nhận không hợp lệ.')
        if (dauVao.ngayNhan < truoc.ngayNhan) loi('DU_LIEU_KHONG_HOP_LE', 'Muốn lùi ngày nhận hãy dùng "lùi ngày".')
        sau.ngayNhan = dauVao.ngayNhan
      }
      if (dauVao.ngayTra !== undefined) {
        if (truoc.trangThai !== 'da-tra') loi('SAI_TRANG_THAI', 'Chỉ phiếu đã trả mới có ngày trả.')
        if (!ngayHopLe(dauVao.ngayTra)) loi('DU_LIEU_KHONG_HOP_LE', 'Ngày trả không hợp lệ.')
        if (truoc.ngayTra && dauVao.ngayTra < truoc.ngayTra) {
          loi('DU_LIEU_KHONG_HOP_LE', 'Muốn lùi ngày trả hãy dùng "lùi ngày".')
        }
        sau.ngayTra = dauVao.ngayTra
      }
      if (dauVao.khachId !== undefined) {
        await kiemTraKhach(dauVao.khachId)
        sau.khachId = dauVao.khachId
      }
      kiemTraNgay(sau)
      if (soSanhBanGhi(truoc, sau).length === 0) loi('DU_LIEU_KHONG_HOP_LE', 'Không có thay đổi nào để lưu.')
      const ra = await ghiVaTraVe(sau)
      await ghiNhatKy({ loai: 'sua', truoc, sau, ...c })
      return ra
    },

    async huy(id, lyDo) {
      const c = await chuanBi(lyDo, 'huy')
      const truoc = await lanTruoc(id)
      const sau: BanGhiPhieu = { ...truoc, trangThai: 'da-huy' }
      const ra = await ghiVaTraVe(sau)
      await ghiNhatKy({ loai: 'huy', truoc, sau, ...c })
      return ra
    },

    async xoaMem(id, lyDo) {
      const c = await chuanBi(lyDo, 'xoaMem')
      const truoc = await lanTruoc(id, { daHuy: true })
      const sau: BanGhiPhieu = { ...truoc, daXoa: true }
      const ra = await ghiVaTraVe(sau)
      await ghiNhatKy({ loai: 'xoa-mem', truoc, sau, ...c })
      return ra
    },

    async luiNgay(id, dauVao, lyDo) {
      const c = await chuanBi(lyDo, 'luiNgay')
      const truoc = await lanTruoc(id)
      const sau: BanGhiPhieu = { ...truoc }
      if (dauVao.ngayNhan === undefined && dauVao.ngayTra === undefined) {
        loi('DU_LIEU_KHONG_HOP_LE', 'Cần chọn ngày để lùi.')
      }
      if (dauVao.ngayNhan !== undefined) {
        if (!ngayHopLe(dauVao.ngayNhan)) loi('DU_LIEU_KHONG_HOP_LE', 'Ngày nhận không hợp lệ.')
        if (dauVao.ngayNhan >= truoc.ngayNhan) loi('DU_LIEU_KHONG_HOP_LE', 'Lùi ngày nhận phải về trước ngày hiện tại của phiếu.')
        sau.ngayNhan = dauVao.ngayNhan
      }
      if (dauVao.ngayTra !== undefined) {
        if (truoc.trangThai !== 'da-tra' || !truoc.ngayTra) loi('SAI_TRANG_THAI', 'Chỉ phiếu đã trả mới có ngày trả.')
        if (!ngayHopLe(dauVao.ngayTra)) loi('DU_LIEU_KHONG_HOP_LE', 'Ngày trả không hợp lệ.')
        if (dauVao.ngayTra >= truoc.ngayTra) loi('DU_LIEU_KHONG_HOP_LE', 'Lùi ngày trả phải về trước ngày hiện tại của phiếu.')
        sau.ngayTra = dauVao.ngayTra
      }
      kiemTraNgay(sau)
      const ra = await ghiVaTraVe(sau)
      await ghiNhatKy({ loai: 'lui-ngay', truoc, sau, ...c })
      return ra
    },

    async thayThe(id, dauVao, lyDo) {
      const c = await chuanBi(lyDo, 'thayThe')
      const truoc = await lanTruoc(id, { daHuy: true })
      if (truoc.thayTheBoi !== undefined) loi('SAI_TRANG_THAI', 'Phiếu này đã được thay thế rồi.')
      const khachId = dauVao.khachId ?? truoc.khachId
      await kiemTraKhach(khachId)
      const moTa = (dauVao.moTa ?? truoc.moTa).trim()
      if (moTa === '') loi('DU_LIEU_KHONG_HOP_LE', 'Cần nhập mô tả đồ.')
      const ngayNhan = dauVao.ngayNhan ?? truoc.ngayNhan
      if (!ngayHopLe(ngayNhan)) loi('DU_LIEU_KHONG_HOP_LE', 'Ngày nhận không hợp lệ.')
      const ghiChu = (dauVao.ghiChu ?? truoc.ghiChu)?.trim()
      let tien: Pick<BanGhiPhieu, 'tongTien' | 'chiTietTien'> = {
        ...(truoc.tongTien !== undefined ? { tongTien: truoc.tongTien } : {}),
        ...(truoc.chiTietTien ? { chiTietTien: structuredClone(truoc.chiTietTien) } : {}),
      }
      if (dauVao.tongTien !== undefined) {
        if (!dongTienHopLe(dauVao.tongTien)) {
          loi('DU_LIEU_KHONG_HOP_LE', 'Tổng tiền phải là số đồng nguyên dương.')
        }
        tien = { tongTien: dauVao.tongTien }
      }
      const moi = await kho.them({
        khachId,
        ngayNhan,
        moTa,
        ...(ghiChu ? { ghiChu } : {}),
        ...tien,
        trangThai: 'chua-thanh-toan',
        thayTheCho: truoc.id,
      })
      const sau: BanGhiPhieu = { ...truoc, trangThai: 'da-huy', thayTheBoi: moi.id }
      const cu = await ghiVaTraVe(sau)
      await ghiNhatKy({ loai: 'thay-the', truoc, sau, phieuLienKetId: moi.id, ...c })
      return { cu, moi: (await phieu.lay(moi.id))! }
    },

    async nhatKy() {
      return khoNhatKy.tatCa()
    },

    async nhatKyCuaPhieu(phieuId) {
      return (await khoNhatKy.tatCa()).filter((n) => n.phieuId === phieuId || n.phieuLienKetId === phieuId)
    },

    caiDat: docCaiDat,

    async capNhatCaiDat(dauVao, lyDo) {
      const c = await chuanBi(lyDo)
      const truoc = c.caiDat
      const sau: CaiDatPhieu = structuredClone(truoc)
      if (dauVao.congTac) {
        for (const [k, v] of Object.entries(dauVao.congTac)) {
          if (!(k in sau.congTac) || typeof v !== 'boolean') loi('DU_LIEU_KHONG_HOP_LE', 'Công tắc không hợp lệ.')
          sau.congTac[k as keyof CongTacChucNang] = v
        }
      }
      if (dauVao.nguong) {
        for (const [k, v] of Object.entries(dauVao.nguong)) {
          if (!(k in sau.nguong) || !laSoKhongAm(v)) loi('DU_LIEU_KHONG_HOP_LE', 'Ngưỡng phải là số nguyên không âm.')
          sau.nguong[k as keyof NguongBatThuong] = v
        }
      }
      if (dauVao.khoaThang) {
        if (dauVao.khoaThang.bat !== undefined) sau.khoaThang.bat = dauVao.khoaThang.bat
        if (dauVao.khoaThang.cacThang) {
          if (!dauVao.khoaThang.cacThang.every((t) => THANG_RE.test(t))) {
            loi('DU_LIEU_KHONG_HOP_LE', 'Tháng khóa phải có dạng YYYY-MM.')
          }
          sau.khoaThang.cacThang = [...new Set(dauVao.khoaThang.cacThang)].sort()
        }
      }
      const thayDoi: DongThayDoi[] = []
      for (const [nhom, a] of [
        ['congTac', truoc.congTac],
        ['nguong', truoc.nguong],
        ['khoaThang', truoc.khoaThang],
      ] as const) {
        const b = sau[nhom] as unknown as Record<string, unknown>
        for (const [k, v] of Object.entries(a)) {
          if (JSON.stringify(v) !== JSON.stringify(b[k])) {
            thayDoi.push({ truong: `${nhom}.${k}`, truoc: json(v), sau: json(b[k]) })
          }
        }
      }
      if (thayDoi.length === 0) loi('DU_LIEU_KHONG_HOP_LE', 'Không có thay đổi nào để lưu.')
      await khoCaiDat.ghi(sau)
      const luc = dongHo()
      await khoNhatKy.them({
        luc,
        ngay: luc.slice(0, 10),
        nguoi: c.nguoi,
        loai: 'doi-cai-dat',
        phieuId: null,
        thayDoi,
        lyDo: c.lyDo,
        batThuong: [],
      })
      return sau
    },

    async datNguoiHienTai(nguoiId) {
      const truoc = await docCaiDat()
      const moi = truoc.danhSachNguoi.find((n) => n.id === nguoiId)
      if (!moi) loi('KHONG_TIM_THAY', 'Không có người dùng này trong cài đặt.')
      const nguoiCu = nguoiTu(truoc)
      if (nguoiCu.id === moi.id) return truoc
      const sau = { ...truoc, nguoiHienTai: moi.id }
      await khoCaiDat.ghi(sau)
      const luc = dongHo()
      await khoNhatKy.them({
        luc,
        ngay: luc.slice(0, 10),
        nguoi: { id: moi.id, ten: moi.ten, xacThuc: false },
        loai: 'doi-nguoi-dung',
        phieuId: null,
        thayDoi: [{ truong: 'nguoiHienTai', truoc: nguoiCu.id, sau: moi.id }],
        lyDo: 'Chọn người dùng hiện tại (chưa xác thực).',
        batThuong: [],
      })
      return sau
    },

    async nguoiHienTai() {
      return nguoiTu(await docCaiDat())
    },

    async xemLaiTuan(ngayTrongTuan) {
      const { tuNgay, denNgay } = tuanCua(ngayTrongTuan)
      const [nk, daXem] = await Promise.all([khoNhatKy.tatCa(), khoNhatKy.tatCaDaXem()])
      const xem = new Map(daXem.map((x) => [x.nhatKyId, x]))
      const bac = (n: NhatKyPhieu) => (n.batThuong.some((b) => b.mucDo === 'cao') ? 2 : n.batThuong.length > 0 ? 1 : 0)
      const muc = nk
        .filter((n) => n.ngay >= tuNgay && n.ngay <= denNgay)
        .map((n) => ({ nhatKy: n, ...(xem.has(n.id) ? { daXem: xem.get(n.id)! } : {}) }))
        .sort((a, b) => bac(b.nhatKy) - bac(a.nhatKy) || b.nhatKy.luc.localeCompare(a.nhatKy.luc) || b.nhatKy.id.localeCompare(a.nhatKy.id))
      return { tuNgay, denNgay, muc, soChuaXem: muc.filter((m) => !m.daXem).length }
    },

    async danhDauDaXem(nhatKyId) {
      const [nk, daXem] = await Promise.all([khoNhatKy.tatCa(), khoNhatKy.tatCaDaXem()])
      if (!nk.some((n) => n.id === nhatKyId)) loi('KHONG_TIM_THAY', 'Không tìm thấy dòng nhật ký.')
      if (daXem.some((x) => x.nhatKyId === nhatKyId)) return
      await khoNhatKy.themDaXem({ nhatKyId, nguoi: nguoiTu(await docCaiDat()), luc: dongHo() })
    },

    async danhDauDaXemTuan(ngayTrongTuan) {
      const tuan = await this.xemLaiTuan(ngayTrongTuan)
      const chua = tuan.muc.filter((m) => !m.daXem)
      for (const m of chua) await this.danhDauDaXem(m.nhatKy.id)
      return chua.length
    },

    async soChuaXem() {
      const [nk, daXem] = await Promise.all([khoNhatKy.tatCa(), khoNhatKy.tatCaDaXem()])
      const roi = new Set(daXem.map((x) => x.nhatKyId))
      return nk.filter((n) => !roi.has(n.id)).length
    },
  }
}

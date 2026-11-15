import type { DichVu } from './bang-gia.ts'
import type { BanGhiDichVu, KhoDichVu } from './kho-dich-vu.ts'
import { LoiNghiepVu } from './types.ts'

export type MucToiThieu = NonNullable<DichVu['toiThieu']>

export interface DauVaoThemDichVu {
  ten: string
  kieu: DichVu['kieu']
  donGia: number
  toiThieu?: MucToiThieu
  canhBaoTuKg?: number
  nhom?: string
}

export interface DauVaoSuaDichVu {
  ten?: string
  kieu?: DichVu['kieu']
  donGia?: number
  /** null: bỏ mức tối thiểu. */
  toiThieu?: MucToiThieu | null
  dangDung?: boolean
}

/** Chủ tiệm xem và chỉnh bảng giá dịch vụ. Mọi ghi đi qua kho Dịch vụ nên tự đồng bộ lên tab "Dịch vụ". */
export interface DichVuBangGia {
  /** Cả dịch vụ đang dùng lẫn đã ngừng, xếp theo tên. */
  danhSach(): Promise<BanGhiDichVu[]>
  them(dauVao: DauVaoThemDichVu): Promise<BanGhiDichVu>
  capNhat(id: string, dauVao: DauVaoSuaDichVu): Promise<BanGhiDichVu>
  /** Ghi lại toàn bộ để đẩy lại lên tab Dịch vụ (khi tab bị xóa hoặc lệch). Trả số dịch vụ. */
  ghiLaiTatCa(): Promise<number>
}

function loi(thongBao: string): never {
  throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', thongBao)
}

const laSoNguyenDuong = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n > 0

function kiemTra(d: { ten: string; kieu: DichVu['kieu']; donGia: number; toiThieu?: MucToiThieu; canhBaoTuKg?: number }): void {
  if (d.ten.trim() === '') loi('Cần nhập tên dịch vụ.')
  if (d.kieu !== 'kg' && d.kieu !== 'so-luong') loi('Kiểu tính phải là kg hoặc số lượng.')
  if (!laSoNguyenDuong(d.donGia)) loi('Đơn giá phải là số đồng nguyên dương.')
  if (d.toiThieu) {
    if (d.kieu !== 'kg') loi('Mức tối thiểu chỉ dùng cho dịch vụ tính theo kg.')
    if (!(typeof d.toiThieu.duoiKg === 'number' && d.toiThieu.duoiKg > 0) || !laSoNguyenDuong(d.toiThieu.tien)) {
      loi('Mức tối thiểu cần số kg lớn hơn 0 và số tiền nguyên dương.')
    }
  }
  if (d.canhBaoTuKg !== undefined && !(d.canhBaoTuKg > 0)) loi('Mức cảnh báo phải lớn hơn 0 kg.')
}

export function taoDichVuBangGia(phuThuoc: { kho: KhoDichVu; taoMa?: () => string }): DichVuBangGia {
  const { kho } = phuThuoc
  let dem = 0
  const taoMa = phuThuoc.taoMa ?? (() => `DV-${Date.now().toString(36)}-${(dem++).toString(36)}`)

  return {
    async danhSach() {
      return (await kho.tatCa()).sort((a, b) => a.ten.localeCompare(b.ten, 'vi'))
    },

    async them(dauVao) {
      const ten = dauVao.ten.trim()
      kiemTra({ ...dauVao, ten })
      const id = taoMa()
      const moi: BanGhiDichVu = {
        id,
        ma: id,
        ten,
        kieu: dauVao.kieu,
        donGia: dauVao.donGia,
        ...(dauVao.toiThieu ? { toiThieu: { ...dauVao.toiThieu } } : {}),
        ...(dauVao.canhBaoTuKg !== undefined ? { canhBaoTuKg: dauVao.canhBaoTuKg } : {}),
        ...(dauVao.nhom?.trim() ? { nhom: dauVao.nhom.trim() } : {}),
        dangDung: true,
      }
      await kho.ghi(moi)
      return moi
    },

    async capNhat(id, dauVao) {
      const cu = await kho.lay(id)
      if (!cu) throw new LoiNghiepVu('KHONG_TIM_THAY', 'Không tìm thấy dịch vụ.')
      const { toiThieu: toiThieuCu, ...conLai } = cu
      const ten = dauVao.ten?.trim() ?? cu.ten
      const kieu = dauVao.kieu ?? cu.kieu
      let toiThieu = dauVao.toiThieu === undefined ? toiThieuCu : (dauVao.toiThieu ?? undefined)
      if (kieu === 'so-luong' && dauVao.toiThieu === undefined) toiThieu = undefined
      const moi: BanGhiDichVu = {
        ...conLai,
        ten,
        kieu,
        donGia: dauVao.donGia ?? cu.donGia,
        ...(toiThieu ? { toiThieu: { ...toiThieu } } : {}),
        dangDung: dauVao.dangDung ?? cu.dangDung,
      }
      kiemTra(moi)
      await kho.ghi(moi)
      return moi
    },

    async ghiLaiTatCa() {
      const tatCa = await kho.tatCa()
      if (kho.ghiNhieu) await kho.ghiNhieu(tatCa)
      else for (const b of tatCa) await kho.ghi(b)
      return tatCa.length
    },
  }
}

import type { DichVu } from './bang-gia.ts'

/**
 * Dịch vụ trong bảng giá, lưu thành thực thể (ticket 07). Mã là mã hàng KiotViet khi nhập từ KiotViet.
 * Giá vốn để trống: KiotViet điền sai cột này.
 */
export interface BanGhiDichVu extends DichVu {
  id: string
  nhom?: string
  /** Mã hàng KiotViet. */
  maCu?: string
  /** False khi ngừng bán: không hiện trong form chốt tiền, phiếu cũ vẫn giữ. */
  dangDung: boolean
}

/** Cổng lưu trữ dịch vụ. Cùng kiểu với KhoPhieu và KhoKhach để cắm bộ chuyển Sheets. */
export interface KhoDichVu {
  lay(id: string): Promise<BanGhiDichVu | undefined>
  ghi(banGhi: BanGhiDichVu): Promise<void>
  /** Ghi nhiều bản ghi một lượt (nhập lô): bộ chuyển Sheets chỉ đồng bộ một lần. */
  ghiNhieu?(banGhi: BanGhiDichVu[]): Promise<void>
  tatCa(): Promise<BanGhiDichVu[]>
}

export function taoKhoDichVuTrongBoNho(): KhoDichVu {
  const du = new Map<string, BanGhiDichVu>()
  const sao = <T>(x: T): T => structuredClone(x)
  return {
    async lay(id) {
      const b = du.get(id)
      return b ? sao(b) : undefined
    },
    async ghi(b) {
      du.set(b.id, sao(b))
    },
    async tatCa() {
      return [...du.values()].map(sao)
    },
  }
}

/** Bỏ các trường lưu trữ, còn lại đúng kiểu DichVu mà bộ tính tiền dùng (và lưu vào chi tiết tiền của phiếu). */
export function sangDichVu(b: BanGhiDichVu): DichVu {
  return {
    ma: b.ma,
    ten: b.ten,
    kieu: b.kieu,
    donGia: b.donGia,
    ...(b.toiThieu ? { toiThieu: { ...b.toiThieu } } : {}),
    ...(b.canhBaoTuKg !== undefined ? { canhBaoTuKg: b.canhBaoTuKg } : {}),
    ...(b.giaVon !== undefined ? { giaVon: b.giaVon } : {}),
  }
}

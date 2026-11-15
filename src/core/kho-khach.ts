import type { BanGhiKhach, NhatKyGop } from './khach.ts'

/** Cổng lưu trữ khách và nhật ký gộp. Cùng kiểu với KhoPhieu để ticket 02 cắm bộ chuyển Sheets. */
export interface KhoKhach {
  them(banGhi: Omit<BanGhiKhach, 'id'>): Promise<BanGhiKhach>
  lay(id: string): Promise<BanGhiKhach | undefined>
  ghi(banGhi: BanGhiKhach): Promise<void>
  /** Ghi nhiều bản ghi một lượt (nhập lô): bộ chuyển Sheets chỉ đồng bộ một lần. */
  ghiNhieu?(banGhi: BanGhiKhach[]): Promise<void>
  tatCa(): Promise<BanGhiKhach[]>
  themNhatKy(nhatKy: Omit<NhatKyGop, 'id'>): Promise<NhatKyGop>
  layNhatKy(id: string): Promise<NhatKyGop | undefined>
  ghiNhatKy(nhatKy: NhatKyGop): Promise<void>
  tatCaNhatKy(): Promise<NhatKyGop[]>
}

export function taoKhoKhachTrongBoNho(): KhoKhach {
  const khach = new Map<string, BanGhiKhach>()
  const nhatKy = new Map<string, NhatKyGop>()
  let demKhach = 0
  let demNhatKy = 0
  const sao = <T>(x: T): T => structuredClone(x)
  return {
    async them(banGhi) {
      demKhach += 1
      const moi: BanGhiKhach = { ...banGhi, id: `K${String(demKhach).padStart(4, '0')}` }
      khach.set(moi.id, sao(moi))
      return sao(moi)
    },
    async lay(id) {
      const b = khach.get(id)
      return b ? sao(b) : undefined
    },
    async ghi(banGhi) {
      khach.set(banGhi.id, sao(banGhi))
    },
    async tatCa() {
      return [...khach.values()].map(sao)
    },
    async themNhatKy(n) {
      demNhatKy += 1
      const moi: NhatKyGop = { ...n, id: `G${String(demNhatKy).padStart(4, '0')}` }
      nhatKy.set(moi.id, sao(moi))
      return sao(moi)
    },
    async layNhatKy(id) {
      const n = nhatKy.get(id)
      return n ? sao(n) : undefined
    },
    async ghiNhatKy(n) {
      nhatKy.set(n.id, sao(n))
    },
    async tatCaNhatKy() {
      return [...nhatKy.values()].map(sao)
    },
  }
}

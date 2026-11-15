import type { KhoPhieu } from './kho-phieu.ts'
import type { BanGhiPhieu } from './types.ts'

export function taoKhoPhieuTrongBoNho(): KhoPhieu {
  const du = new Map<string, BanGhiPhieu>()
  let dem = 0
  const sao = (b: BanGhiPhieu): BanGhiPhieu => structuredClone(b)
  return {
    async them(banGhi) {
      dem += 1
      const moi: BanGhiPhieu = { ...banGhi, id: `P${String(dem).padStart(4, '0')}` }
      du.set(moi.id, sao(moi))
      return sao(moi)
    },
    async lay(id) {
      const b = du.get(id)
      return b ? sao(b) : undefined
    },
    async ghi(banGhi) {
      du.set(banGhi.id, sao(banGhi))
    },
    async tatCa() {
      return [...du.values()].map(sao)
    },
  }
}

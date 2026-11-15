/** Một bản ghi đang chờ gửi lên Sheet. `phienBan` tăng sau mỗi lần ghi để biết bản nào đã gửi xong. */
export interface MucChoGui<T extends { id: string }> {
  banGhi: T
  phienBan: number
}

/**
 * Bản đệm cục bộ (trong trình duyệt là IndexedDB): giữ bản sao mới nhất của mọi phiếu để mở nhanh,
 * và hàng đợi các phiếu chưa gửi được lên Sheet. Ghi một phiếu là đồng thời đưa nó vào hàng đợi.
 */
export interface BangDem<T extends { id: string }> {
  ghi(banGhi: T): Promise<void>
  lay(id: string): Promise<T | undefined>
  tatCa(): Promise<T[]>
  choGui(): Promise<Array<MucChoGui<T>>>
  /** Bỏ khỏi hàng đợi các mục đã gửi xong, nhưng chỉ khi mục đó chưa bị ghi đè bản mới hơn. */
  danhDauDaGui(muc: Array<{ id: string; phienBan: number }>): Promise<void>
  /**
   * Nhận toàn bộ phiếu từ Sheet: phiếu nào không chờ gửi thì lấy theo Sheet (kể cả bỏ phiếu không còn trên Sheet);
   * phiếu đang chờ gửi thì giữ bản trên máy.
   */
  nhanTuMayChu(banGhi: T[]): Promise<void>
}

const sao = <T>(v: T): T => structuredClone(v)

export function taoBangDemTrongBoNho<T extends { id: string }>(): BangDem<T> {
  const du = new Map<string, T>()
  const cho = new Map<string, number>()
  let phienBan = 0
  return {
    async ghi(b) {
      du.set(b.id, sao(b))
      cho.set(b.id, ++phienBan)
    },
    async lay(id) {
      const b = du.get(id)
      return b ? sao(b) : undefined
    },
    async tatCa() {
      return [...du.values()].map(sao)
    },
    async choGui() {
      return [...cho].map(([id, pb]) => ({ banGhi: sao(du.get(id)!), phienBan: pb }))
    },
    async danhDauDaGui(muc) {
      for (const m of muc) if (cho.get(m.id) === m.phienBan) cho.delete(m.id)
    },
    async nhanTuMayChu(ds) {
      for (const id of [...du.keys()]) if (!cho.has(id)) du.delete(id)
      for (const b of ds) if (!cho.has(b.id)) du.set(b.id, sao(b))
    },
  }
}

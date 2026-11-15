import { useEffect, useState } from 'react'
import type { TrangThaiDongBo } from '../core/kho-sheets.ts'
import type { KetNoiSheets } from './dich-vu.ts'

/** Theo dõi trạng thái của kho; gọi `khiDoi` mỗi khi kho báo có thay đổi (để giao diện đọc lại danh sách). */
export function useTrangThaiDongBo(kn: KetNoiSheets | undefined, khiDoi?: () => void): TrangThaiDongBo | undefined {
  const [tt, setTt] = useState<TrangThaiDongBo>()
  useEffect(() => {
    if (!kn) return
    const cap = () => {
      setTt(kn.kho.trangThai())
      khiDoi?.()
    }
    cap()
    return kn.kho.theoDoi(cap)
  }, [kn, khiDoi])
  return tt
}

import { useEffect, useState } from 'react'
import type { TrangThaiDongBo } from '../core/dong-bo-sheets.ts'
import type { KetNoiSheets } from './dich-vu.ts'

/** Theo dõi trạng thái của dongBo; gọi `khiDoi` mỗi khi dongBo báo có thay đổi (để giao diện đọc lại danh sách). */
export function useTrangThaiDongBo(kn: KetNoiSheets | undefined, khiDoi?: () => void): TrangThaiDongBo | undefined {
  const [tt, setTt] = useState<TrangThaiDongBo>()
  useEffect(() => {
    if (!kn) return
    const cap = () => {
      setTt(kn.dongBo.trangThai())
      khiDoi?.()
    }
    cap()
    return kn.dongBo.theoDoi(cap)
  }, [kn, khiDoi])
  return tt
}

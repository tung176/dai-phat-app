import { useEffect, useState, useSyncExternalStore } from 'react'
import type { DichVu } from '../core/bang-gia.ts'
import { sangDichVu } from '../core/kho-dich-vu.ts'
import type { NoiLuu } from '../core/luu-cau-hinh.ts'
import { taoLuuNguongChenh } from '../core/nguong-chenh.ts'
import type { KetNoiSheets } from './dich-vu.ts'

/** Bảng giá đang bán, đọc từ kho Dịch vụ và đọc lại mỗi khi kho báo có thay đổi (nhập lịch sử, đồng bộ kéo về). */
export function useBangGia(kn: KetNoiSheets): DichVu[] {
  const [bang, setBang] = useState<DichVu[]>([])
  useEffect(() => {
    let huy = false
    const doc = () =>
      void kn.he.dichVu.tatCa().then((ds) => {
        if (huy) return
        setBang(
          ds
            .filter((d) => d.dangDung)
            .sort((a, b) => a.ten.localeCompare(b.ten, 'vi'))
            .map(sangDichVu),
        )
      })
    doc()
    const boTheoDoi = kn.dongBo.theoDoi(doc)
    return () => {
      huy = true
      boTheoDoi()
    }
  }, [kn])
  return bang
}

// Ngưỡng chênh lệch dùng chung cho mọi form chốt tiền; đổi ở một nơi thì mọi nơi cập nhật.
const nguoiNghe = new Set<() => void>()
let luu: ReturnType<typeof taoLuuNguongChenh> | undefined
function kho() {
  if (!luu) {
    let noi: NoiLuu | undefined
    try {
      noi = localStorage
    } catch {
      // trình duyệt chặn: ngưỡng chỉ nhớ trong phiên
    }
    luu = taoLuuNguongChenh(
      noi ?? { getItem: () => null, setItem: () => undefined, removeItem: () => undefined },
    )
  }
  return luu
}

/** Ngưỡng chênh lệch (đồng) và hàm đổi ngưỡng. */
export function useNguongChenh(): [number, (n: number) => boolean] {
  const nguong = useSyncExternalStore(
    (nghe) => {
      nguoiNghe.add(nghe)
      return () => nguoiNghe.delete(nghe)
    },
    () => kho().doc(),
  )
  return [
    nguong,
    (n) => {
      const ok = kho().dat(n)
      if (ok) nguoiNghe.forEach((f) => f())
      return ok
    },
  ]
}

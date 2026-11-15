import type { KhoSheets } from '../core/kho-sheets.ts'

const CHU_KY_MS = 60_000

/**
 * Tự đồng bộ: ngay khi mở app, khi có mạng lại, khi quay lại màn hình app, và mỗi phút.
 * Ghi phiếu xong cũng tự gửi (do chính kho lo). Lỗi đã được kho ghi vào trạng thái nên ở đây bỏ qua.
 */
export function batDongBoTuDong(kho: KhoSheets): () => void {
  const chay = () => void kho.dongBo().catch(() => {})
  const khiHienLai = () => {
    if (document.visibilityState === 'visible') chay()
  }
  window.addEventListener('online', chay)
  document.addEventListener('visibilitychange', khiHienLai)
  const hen = setInterval(chay, CHU_KY_MS)
  chay()
  return () => {
    window.removeEventListener('online', chay)
    document.removeEventListener('visibilitychange', khiHienLai)
    clearInterval(hen)
  }
}

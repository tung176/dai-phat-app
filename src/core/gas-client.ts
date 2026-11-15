import type { CauHinhSheets } from './ma-cai-dat.ts'

/**
 * Loại lỗi khi nói chuyện với Apps Script:
 * - 'mang': chưa tới được máy chủ hoặc phản hồi không rõ; dữ liệu còn nguyên, thử lại sau.
 * - 'tu-choi': Apps Script đã trả lời và từ chối (sai mã bí mật, chưa đặt mã, dòng sai...); cần người xem lại.
 * Thông báo lỗi không bao giờ chứa địa chỉ hay mã bí mật.
 */
export class LoiDongBo extends Error {
  readonly loai: 'mang' | 'tu-choi'
  constructor(loai: 'mang' | 'tu-choi', thongBao: string) {
    super(thongBao)
    this.name = 'LoiDongBo'
    this.loai = loai
  }
}

const HET_GIO_MS = 30_000

type HamFetch = typeof fetch

/**
 * Gửi một yêu cầu tới Web app. Nội dung là chuỗi text/plain nên trình duyệt không hỏi trước (không preflight),
 * và vẫn đọc được phản hồi qua CORS.
 */
export async function goiAppsScript<T extends object>(
  cauHinh: CauHinhSheets,
  hanhDong: string,
  tai: Record<string, unknown> = {},
  hamFetch: HamFetch = (...a) => fetch(...a),
): Promise<T> {
  const dieuKhien = new AbortController()
  const hen = setTimeout(() => dieuKhien.abort(), HET_GIO_MS)
  let res: Response
  try {
    res = await hamFetch(cauHinh.diaChi, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ secret: cauHinh.maBiMat, action: hanhDong, ...tai }),
      redirect: 'follow',
      signal: dieuKhien.signal,
    })
  } catch (e) {
    throw new LoiDongBo(
      'mang',
      (e as Error)?.name === 'AbortError' ? 'Quá lâu không thấy phản hồi.' : 'Không kết nối được.',
    )
  } finally {
    clearTimeout(hen)
  }
  if (!res.ok) throw new LoiDongBo('mang', 'Máy chủ chưa trả lời được.')
  let du: { ok?: boolean; error?: unknown }
  try {
    du = (await res.json()) as typeof du
  } catch {
    throw new LoiDongBo(
      'mang',
      'Phản hồi lạ. Địa chỉ có thể sai, hoặc lúc triển khai chưa chọn quyền truy cập "Bất kỳ ai".',
    )
  }
  if (!du.ok) throw new LoiDongBo('tu-choi', typeof du.error === 'string' ? du.error : 'Apps Script báo lỗi.')
  return du as T
}

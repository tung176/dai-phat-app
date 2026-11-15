/**
 * Mã cài đặt: một chuỗi gom địa chỉ Web app Apps Script và mã bí mật, để chủ tiệm dán một lần vào màn Cài đặt.
 * Định dạng: "giatla1:" + base64(UTF-8 của JSON {"u": địa chỉ, "s": mã bí mật}).
 * Coi nó như mật khẩu: chỉ lưu cục bộ trên máy, không đưa lên kho mã, không in ra, không ghi log.
 */
export interface CauHinhSheets {
  diaChi: string
  maBiMat: string
}

const TIEN_TO = 'giatla1:'
const DIA_CHI_HOP_LE = /^https:\/\/script\.google\.com\/macros\/s\/[^/\s]+\/exec$/
const DO_DAI_TOI_THIEU = 12

export function diaChiHopLe(diaChi: string): boolean {
  return DIA_CHI_HOP_LE.test(diaChi.trim())
}

export function taoMaCaiDat(c: CauHinhSheets): string {
  const bytes = new TextEncoder().encode(JSON.stringify({ u: c.diaChi, s: c.maBiMat }))
  let nhiPhan = ''
  bytes.forEach((b) => (nhiPhan += String.fromCharCode(b)))
  return TIEN_TO + btoa(nhiPhan)
}

/** Đọc mã cài đặt; trả null nếu mã sai hoặc hỏng. */
export function docMaCaiDat(ma: string): CauHinhSheets | null {
  const m = ma.trim()
  if (!m.startsWith(TIEN_TO)) return null
  try {
    const nhiPhan = atob(m.slice(TIEN_TO.length))
    const o = JSON.parse(
      new TextDecoder().decode(Uint8Array.from(nhiPhan, (ch) => ch.charCodeAt(0))),
    ) as { u?: unknown; s?: unknown }
    if (typeof o.u !== 'string' || typeof o.s !== 'string') return null
    if (!diaChiHopLe(o.u) || o.s.length < DO_DAI_TOI_THIEU) return null
    return { diaChi: o.u.trim(), maBiMat: o.s }
  } catch {
    return null
  }
}

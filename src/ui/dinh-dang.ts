import type { NgayIso } from '../core/types.ts'

export function hienTien(tien: number | undefined): string {
  if (tien === undefined) return ''
  return `${String(Math.round(tien)).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}đ`
}

export function hienNgay(ngay: NgayIso | undefined): string {
  if (!ngay) return ''
  const [n, t, d] = [ngay.slice(8, 10), ngay.slice(5, 7), ngay.slice(0, 4)]
  return `${n}/${t}/${d}`
}

/** Đọc "dd/mm/yyyy" thành ISO; sai thì undefined. */
export function docNgay(chuoi: string): NgayIso | undefined {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(chuoi.trim())
  if (!m) return undefined
  const [, n, t, d] = m
  const iso = `${d}-${t!.padStart(2, '0')}-${n!.padStart(2, '0')}`
  const kiemTra = new Date(`${iso}T00:00:00Z`)
  if (Number.isNaN(kiemTra.getTime()) || kiemTra.toISOString().slice(0, 10) !== iso) return undefined
  return iso
}

export function homNayIso(bay = new Date()): NgayIso {
  const p = (x: number) => String(x).padStart(2, '0')
  return `${bay.getFullYear()}-${p(bay.getMonth() + 1)}-${p(bay.getDate())}`
}

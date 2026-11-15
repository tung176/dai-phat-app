export interface KichBanGia {
  post(obj: unknown): Record<string, unknown>
  get(): Record<string, unknown>
  setProperty(k: string, v: string | null): void
  sheets: Map<string, { getLastRow(): number; get(r: number, c: number): unknown }>
}
export function createScript(codePath: string, opts?: { properties?: Record<string, string> }): KichBanGia
export interface TrangThaiMangGia {
  matMang: boolean
  matPhanHoi: boolean
  soLanGoi: number
  hangDoiLoi: number
}
export function createFakeFetch(
  script: KichBanGia,
  url: string,
): { fetch: typeof fetch; trangThai: TrangThaiMangGia }

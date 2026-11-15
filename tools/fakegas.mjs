// Môi trường giả lập Google Apps Script tối thiểu để chạy thử apps-script/Code.gs ngay trên máy, không cần Google.
// Chỉ dùng cho kiểm thử và chạy thử cục bộ. Mã bí mật truyền vào ở đây luôn là giá trị giả.
import vm from 'node:vm'
import { readFileSync } from 'node:fs'

/**
 * @param {string} codePath đường dẫn tới Code.gs
 * @param {{ properties?: Record<string, string> }} [opts] Script Properties giả lập
 */
export function createScript(codePath, { properties = {} } = {}) {
  const sheets = new Map()
  const props = new Map(Object.entries(properties))
  class Range {
    constructor(sh, r, c, nr, nc) { Object.assign(this, { sh, r, c, nr, nc }) }
    setValues(v) { for (let i = 0; i < v.length; i++) for (let j = 0; j < v[i].length; j++) this.sh.set(this.r + i, this.c + j, v[i][j]); return this }
    getValues() { const o = []; for (let i = 0; i < this.nr; i++) { const row = []; for (let j = 0; j < this.nc; j++) row.push(this.sh.get(this.r + i, this.c + j)); o.push(row) } return o }
    setFontWeight() { return this }
    setNumberFormat() { return this }
  }
  class Sheet {
    constructor(name) { this.name = name; this.cells = new Map(); this.max = 0 }
    set(r, c, v) { this.cells.set(r + ',' + c, v); this.max = Math.max(this.max, r) }
    get(r, c) { const v = this.cells.get(r + ',' + c); return v === undefined ? '' : v }
    getLastRow() { return this.max }
    getRange(a, b, c, d) { return typeof a === 'string' ? new Range(this, 1, 1, 1, 1) : new Range(this, a, b, c ?? 1, d ?? 1) }
    setFrozenRows() {} setColumnWidth() {}
  }
  const ss = {
    getSheetByName: (n) => sheets.get(n) ?? null,
    insertSheet: (n) => { const s = new Sheet(n); sheets.set(n, s); return s },
    getSpreadsheetTimeZone: () => 'Asia/Ho_Chi_Minh',
  }
  const ctx = {
    SpreadsheetApp: { getActiveSpreadsheet: () => ss },
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => props.get(k) ?? null }) },
    ContentService: {
      MimeType: { JSON: 'json' },
      createTextOutput: (t) => ({ text: t, setMimeType() { return this } }),
    },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    Utilities: { formatDate: (d, tz, f) => (f === 'HH:mm' ? d.toISOString().slice(11, 16) : d.toISOString().slice(0, 10)) },
    JSON, String, Number, Object, Date, Array,
  }
  vm.createContext(ctx)
  vm.runInContext(readFileSync(codePath, 'utf8'), ctx)
  return {
    post: (obj) => JSON.parse(ctx.doPost({ postData: { contents: typeof obj === 'string' ? obj : JSON.stringify(obj) } }).text),
    get: () => JSON.parse(ctx.doGet().text),
    setProperty: (k, v) => (v === null ? props.delete(k) : props.set(k, v)),
    sheets,
  }
}

/**
 * Hàm fetch giả: nói chuyện với script giả như trình duyệt nói chuyện với Web app thật.
 * - Chỉ nhận POST, nội dung là chuỗi, header chỉ được là Content-Type: text/plain (nếu không, giả lập lỗi CORS preflight).
 * - Trạng thái điều khiển được: matMang (không tới được máy chủ), matPhanHoi (script đã chạy xong nhưng phản hồi không về).
 */
export function createFakeFetch(script, url) {
  const trangThai = { matMang: false, matPhanHoi: false, soLanGoi: 0, hangDoiLoi: 0 }
  async function fakeFetch(input, init = {}) {
    trangThai.soLanGoi += 1
    if (trangThai.matMang) throw new TypeError('Failed to fetch')
    if (String(input) !== url) throw new TypeError('Failed to fetch')
    if ((init.method ?? 'GET') !== 'POST') throw new TypeError('chỉ giả lập POST')
    if (typeof init.body !== 'string') throw new TypeError('body phải là chuỗi')
    for (const [k, v] of Object.entries(init.headers ?? {})) {
      if (k.toLowerCase() !== 'content-type' || !String(v).startsWith('text/plain')) {
        throw new TypeError('Failed to fetch (preflight CORS bị chặn)')
      }
    }
    const text = JSON.stringify(script.post(init.body))
    if (trangThai.matPhanHoi) throw new TypeError('Failed to fetch')
    if (trangThai.hangDoiLoi > 0) {
      trangThai.hangDoiLoi -= 1
      return new Response('<html>lỗi</html>', { status: 500 })
    }
    return new Response(text, { status: 200, headers: { 'Content-Type': 'application/json' } })
  }
  return { fetch: fakeFetch, trangThai }
}

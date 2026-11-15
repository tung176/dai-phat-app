import { beforeEach, describe, expect, it } from 'vitest'
import { createScript, type KichBanGia } from '../../tools/fakegas.mjs'

// Kiểm thử hợp đồng của apps-script/Code.gs: chạy đúng mã đó trong môi trường Apps Script giả lập.
const MA = `gia-${crypto.randomUUID()}`
const hang = (id: string, khach: string, capNhat = '1') =>
  [id, khach, '2026-11-01', 'đồ', '', '', '', '', 'chua-thanh-toan', '', capNhat, '', '', '', '', '', '', '', '']

let kb: KichBanGia
beforeEach(() => {
  kb = createScript('apps-script/Code.gs', { properties: { MA_BI_MAT: MA } })
})

describe('Code.gs', () => {
  it('từ chối khi chủ tiệm chưa đặt mã bí mật trong Script Properties', () => {
    const trong = createScript('apps-script/Code.gs')
    const r = trong.post({ secret: MA, action: 'ping' })
    expect(r.ok).toBe(false)
    expect(String(r.error)).toContain('MA_BI_MAT')
  })

  it('từ chối sai mã và JSON hỏng, không lộ mã', () => {
    const r = kb.post({ secret: 'sai', action: 'ping' })
    expect(r).toEqual({ ok: false, error: 'Sai mã bí mật.' })
    expect(kb.post('không phải json').ok).toBe(false)
    expect(JSON.stringify(r)).not.toContain(MA)
  })

  it('ping tạo sẵn đủ các tab dữ liệu', () => {
    const r = kb.post({ secret: MA, action: 'ping' })
    expect(r.ok).toBe(true)
    expect([...kb.sheets.keys()].sort()).toEqual(
      ['Cài đặt phiếu', 'Dòng phiếu', 'Dịch vụ', 'Khách', 'Nhật ký', 'Nhật ký phiếu', 'Phiếu', 'Đã xem'].sort(),
    )
    expect(kb.sheets.get('Phiếu')?.get(1, 1)).toBe('Mã phiếu')
  })

  it('upsert theo mã: gửi lại không nhân đôi, gửi bản mới thì cập nhật', () => {
    const a = kb.post({ secret: MA, action: 'upsert', tab: 'Phiếu', rows: [hang('P1', 'K-A')] })
    expect(a).toMatchObject({ ok: true, added: 1, updated: 0 })
    const b = kb.post({ secret: MA, action: 'upsert', tab: 'Phiếu', rows: [hang('P1', 'K-A')] })
    expect(b).toMatchObject({ ok: true, added: 0, updated: 1 })
    kb.post({ secret: MA, action: 'upsert', tab: 'Phiếu', rows: [hang('P1', 'K-ĐỔI', '2')] })
    const r = kb.post({ secret: MA, action: 'pull', tab: 'Phiếu' }) as { rows: string[][] }
    expect(r.rows).toHaveLength(1)
    expect(r.rows[0][1]).toBe('K-ĐỔI')
  })

  it('từ chối tab lạ và dòng sai số cột (không ghi lấp lửng)', () => {
    expect(kb.post({ secret: MA, action: 'upsert', tab: 'LạHoắc', rows: [] }).ok).toBe(false)
    const r = kb.post({ secret: MA, action: 'upsert', tab: 'Phiếu', rows: [['quá', 'ngắn']] })
    expect(r.ok).toBe(false)
    const p = kb.post({ secret: MA, action: 'pull', tab: 'Phiếu' }) as { rows: string[][] }
    expect(p.rows).toHaveLength(0)
  })
})

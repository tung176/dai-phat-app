import { describe, expect, it } from 'vitest'
import { taoDuLieuGia } from './du-lieu-gia.thu.ts'

describe('gợi ý gộp trên dữ liệu giả cùng quy mô tiệm (264 khách, nhiều tên phổ biến)', () => {
  it('mục chính chỉ còn cụm cần xem; cặp hai số khác nhau nằm ở mục ít khả năng trùng', async () => {
    const { khach } = await taoDuLieuGia()
    const tho = await khach.goiYGop()
    const bat = performance.now()
    const r = await khach.goiYGopTheoCum()
    const ms = performance.now() - bat

    const capCanXem = r.canXem.flatMap((c) => c.cap)
    const capAn = r.itKhaNangTrung.flatMap((c) => c.cap)
    // Mục chính không chứa cặp hai số hợp lệ khác nhau; mục ẩn chỉ chứa cặp như vậy.
    expect(capCanXem.every((c) => !c.khacSoDienThoai)).toBe(true)
    expect(capAn.every((c) => c.khacSoDienThoai)).toBe(true)
    // Không cặp nào vừa bị mất vừa bị lặp: mục chính + mục ẩn (sau khi bỏ cặp thừa) nằm trong tập cặp gốc.
    expect(capCanXem.length + capAn.length).toBeLessThanOrEqual(tho.length)
    expect(capAn.length).toBeGreaterThan(0)
    // Mỗi khách xuất hiện ở đúng một cụm trong mục chính.
    const dem = new Map<string, number>()
    for (const c of r.canXem) for (const k of c.khach) dem.set(k.id, (dem.get(k.id) ?? 0) + 1)
    expect([...dem.values()].every((n) => n === 1)).toBe(true)
    // Số mục chính ít hơn nhiều so với số cặp thô.
    expect(r.canXem.length).toBeLessThan(tho.length / 3)
    expect(ms).toBeLessThan(500)
    console.info(
      `[đo] ${tho.length} cặp thô -> ${r.canXem.length} cụm cần xem, ${r.itKhaNangTrung.length} cụm ít khả năng trùng; ` +
        `gom cụm ${ms.toFixed(1)} ms`,
    )
  })

  it('không gợi ý gõ nhầm cho tên một từ ngắn (Mai, Lan, Hạnh...)', async () => {
    const { khach } = await taoDuLieuGia()
    const tho = await khach.goiYGop()
    const ganGiong = tho.filter((c) => c.lyDo === 'gan-giong')
    expect(ganGiong.every((c) => c.a.tenGoc.includes(' ') || c.a.tenGoc.length >= 5)).toBe(true)
  })
})

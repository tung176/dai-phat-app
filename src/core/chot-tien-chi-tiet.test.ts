import { describe, expect, it } from 'vitest'
import { taoDichVuPhieu } from './phieu-service.ts'
import { taoKhoPhieuTrongBoNho } from './kho-trong-bo-nho.ts'
import { bangGiaGia } from './bang-gia-gia.ts'

const { quanAoThuong, topper } = bangGiaGia
const khachGia = { tenKhach: 'Khách Mẫu A', ngayNhan: '2026-11-01', moTa: '1 túi quần áo' }

async function phieuMoi() {
  const dv = taoDichVuPhieu({ kho: taoKhoPhieuTrongBoNho() })
  const p = await dv.nhanDo(khachGia)
  return { dv, id: p.id }
}

describe('chốt tiền kèm dòng dịch vụ', () => {
  it('lưu tổng tiền theo sổ và các dòng; kg suy ra được ghi cờ', async () => {
    const { dv, id } = await phieuMoi()
    const p = await dv.chotTien(id, 100000, { dong: [{ dichVu: quanAoThuong, tien: 100000 }] })
    expect(p.tongTien).toBe(100000)
    expect(p.nhan).toBe('Chờ trả khách')
    expect(p.chiTietTien?.dong[0]?.dichVu.ma).toBe('GIAT-SAY-QA')
    expect(p.chiTietTien?.tongTienSo).toBe(100000)
    expect((await dv.danhSach())[0]?.chiTietTien?.dong).toHaveLength(1)
  })

  it('kg và tiền sổ lệch quá ngưỡng: mặc định giữ tiền sổ', async () => {
    const { dv, id } = await phieuMoi()
    const p = await dv.chotTien(id, 100000, { dong: [{ dichVu: quanAoThuong, kg: 5 }] })
    expect(p.tongTien).toBe(100000)
  })

  it('anh chọn số tính được thì lưu số tính', async () => {
    const { dv, id } = await phieuMoi()
    const p = await dv.chotTien(id, 100000, { dong: [{ dichVu: quanAoThuong, kg: 5 }], chon: 'tinh' })
    expect(p.tongTien).toBe(70000)
    expect(p.chiTietTien?.tongTienSo).toBe(100000)
  })

  it('Topper 6kg trở lên chỉ cảnh báo, vẫn chốt được', async () => {
    const { dv, id } = await phieuMoi()
    const p = await dv.chotTien(id, 210000, { dong: [{ dichVu: topper, kg: 6 }] })
    expect(p.tongTien).toBe(210000)
  })

  it('chi tiết sai thì từ chối và phiếu vẫn "Chưa tính tiền"', async () => {
    const { dv, id } = await phieuMoi()
    await expect(
      dv.chotTien(id, 50000, { dong: [{ dichVu: quanAoThuong }] }),
    ).rejects.toMatchObject({ ma: 'DU_LIEU_KHONG_HOP_LE' })
    expect((await dv.danhSach())[0]?.nhan).toBe('Chưa tính tiền')
  })

  it('chốt không kèm chi tiết vẫn chạy như cũ', async () => {
    const { dv, id } = await phieuMoi()
    const p = await dv.chotTien(id, 50000)
    expect(p.chiTietTien).toBeUndefined()
  })
})

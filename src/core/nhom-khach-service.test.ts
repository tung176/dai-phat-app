import { describe, expect, it } from 'vitest'
import { taoDichVuKhach } from './khach-service.ts'
import { taoKhoKhachTrongBoNho } from './kho-khach.ts'
import { taoKhoPhieuTrongBoNho } from './kho-trong-bo-nho.ts'
import { taoKhoCaiDatTrongBoNho, taoKhoNhatKyTrongBoNho } from './nhat-ky-phieu.ts'
import { taoDichVuPhieu } from './phieu-service.ts'
import { taoDichVuSuaSai } from './sua-sai-service.ts'
import { taoDichVuNhomKhach } from './nhom-khach-service.ts'
import { taoLuuNguongNhom } from './nhom-khach-cai-dat.ts'
import { NGUONG_MAC_DINH } from './nhom-khach.ts'
import type { NoiLuu } from './luu-cau-hinh.ts'

function lap() {
  const kho = taoKhoPhieuTrongBoNho()
  const khach = taoDichVuKhach({ khoKhach: taoKhoKhachTrongBoNho(), khoPhieu: kho, homNay: () => '2026-11-15' })
  const phieu = taoDichVuPhieu({ kho, khach })
  const khoNhatKy = taoKhoNhatKyTrongBoNho()
  const suaSai = taoDichVuSuaSai({
    kho,
    phieu,
    khach,
    khoNhatKy,
    khoCaiDat: taoKhoCaiDatTrongBoNho(),
    dongHo: () => '2026-11-15T09:00:00',
  })
  const nhom = taoDichVuNhomKhach({
    khach,
    phieu,
    khoNhatKy,
    nguoiHienTai: () => suaSai.nguoiHienTai(),
    homNay: () => '2026-11-15',
    dongHo: () => '2026-11-15T09:00:00',
  })
  async function muaVaTra(ten: string, ngayTra: string, sdt?: string) {
    const p = await phieu.nhanDo({ tenKhach: ten, ngayNhan: ngayTra, moTa: 'đồ', soDienThoai: sdt })
    await phieu.chotTien(p.id, 100000)
    await phieu.traKhach(p.id, { ngayTra, phuongThuc: 'tien-mat' })
    return p.khachId
  }
  return { khach, phieu, suaSai, nhom, khoNhatKy, muaVaTra }
}

describe('xem nhóm khách từ phiếu thật', () => {
  it('khách mới mua hôm qua vào Tiềm năng; khách chưa trả thì chưa có nhóm', async () => {
    const h = lap()
    await h.muaVaTra('Khách Mẫu A', '2026-11-14', '0900000001')
    await h.phieu.nhanDo({ tenKhach: 'Khách Mẫu B', ngayNhan: '2026-11-14', moTa: 'đồ' })
    const kq = await h.nhom.xem()
    expect(kq.nhom.find((n) => n.nhom === 'tiem-nang')!.soKhach).toBe(1)
    expect(kq.chuaCoNhom).toBe(1)
  })
})

describe('tick đồng ý nhận tin có nhật ký', () => {
  it('từng khách: đổi cờ và ghi một dòng nhật ký có trước và sau', async () => {
    const h = lap()
    const id = await h.muaVaTra('Khách Mẫu A', '2026-11-14', '0900000001')
    const k = await h.nhom.datDongY(id, true)
    expect(k.dongYNhanTin).toBe('dong-y')
    const nk = await h.khoNhatKy.tatCa()
    expect(nk).toHaveLength(1)
    expect(nk[0]).toMatchObject({
      loai: 'doi-dong-y-nhan-tin',
      phieuId: null,
      nguoi: { id: 'chu' },
      thayDoi: [{ truong: `dongYNhanTin:${id}`, truoc: 'chua-hoi', sau: 'dong-y' }],
    })
  })

  it('không ghi nhật ký khi không có gì đổi', async () => {
    const h = lap()
    const id = await h.muaVaTra('Khách Mẫu A', '2026-11-14')
    await h.nhom.datDongY(id, false)
    expect(await h.khoNhatKy.tatCa()).toHaveLength(0)
  })

  it('hàng loạt cho một nhóm: phải xác nhận, chỉ đụng khách trong nhóm, một dòng nhật ký', async () => {
    const h = lap()
    const a = await h.muaVaTra('Khách Mẫu A', '2026-11-14')
    const b = await h.muaVaTra('Khách Mẫu B', '2026-11-10')
    const c = await h.muaVaTra('Khách Mẫu C', '2026-05-01')
    await expect(h.nhom.datDongYHangLoat({ nhom: 'tiem-nang', xacNhan: false as true })).rejects.toMatchObject({
      ma: 'DU_LIEU_KHONG_HOP_LE',
    })
    const kq = await h.nhom.datDongYHangLoat({ nhom: 'tiem-nang', xacNhan: true })
    expect(kq.soDoi).toBe(2)
    expect((await h.khach.lay(a))!.dongYNhanTin).toBe('dong-y')
    expect((await h.khach.lay(b))!.dongYNhanTin).toBe('dong-y')
    expect((await h.khach.lay(c))!.dongYNhanTin).toBe('chua-hoi')
    const nk = await h.khoNhatKy.tatCa()
    expect(nk).toHaveLength(1)
    expect(nk[0]!.thayDoi.map((t) => t.truong).sort()).toEqual([`dongYNhanTin:${a}`, `dongYNhanTin:${b}`])
  })
})

describe('danh sách nhắn tin', () => {
  it('chỉ khách có số hợp lệ và đã đồng ý; báo số bị loại', async () => {
    const h = lap()
    const a = await h.muaVaTra('Khách Mẫu A', '2026-11-14', '0900000001')
    await h.muaVaTra('Khách Mẫu B', '2026-11-14', '0900000002')
    const c = await h.muaVaTra('Khách Mẫu C', '2026-11-14')
    await h.nhom.datDongY(a, true)
    await h.nhom.datDongY(c, true)
    const kq = await h.nhom.danhSachNhanTin('tiem-nang')
    expect(kq.dong.map((d) => d.ten)).toEqual(['Khách Mẫu A'])
    expect(kq.thieuSo).toBe(1)
    expect(kq.chuaDongY).toBe(1)
  })
})

describe('ngưỡng lưu cục bộ', () => {
  function noiGia(): NoiLuu & { du: Map<string, string> } {
    const du = new Map<string, string>()
    return {
      du,
      getItem: (k) => du.get(k) ?? null,
      setItem: (k, v) => void du.set(k, v),
      removeItem: (k) => void du.delete(k),
    }
  }

  it('mặc định khi chưa lưu; lưu rồi đọc lại; từ chối ngưỡng sai', () => {
    const noi = noiGia()
    const luu = taoLuuNguongNhom(noi)
    expect(luu.doc()).toEqual(NGUONG_MAC_DINH)
    expect(luu.dat({ ...NGUONG_MAC_DINH, ngayGanDay: 60 })).toBe(true)
    expect(taoLuuNguongNhom(noi).doc().ngayGanDay).toBe(60)
    expect(luu.dat({ ...NGUONG_MAC_DINH, ngayGanDay: 0 })).toBe(false)
    expect(luu.dat({ ...NGUONG_MAC_DINH, tuLanTrungThanh: 3 })).toBe(false)
    expect(luu.doc().ngayGanDay).toBe(60)
  })

  it('dữ liệu hỏng hoặc trình duyệt chặn thì dùng mặc định', () => {
    const noi = noiGia()
    noi.du.set('giatla-nguong-nhom-khach', '{hỏng')
    expect(taoLuuNguongNhom(noi).doc()).toEqual(NGUONG_MAC_DINH)
    const chan: NoiLuu = {
      getItem: () => {
        throw new Error('chặn')
      },
      setItem: () => {
        throw new Error('chặn')
      },
      removeItem: () => undefined,
    }
    const luu = taoLuuNguongNhom(chan)
    expect(luu.doc()).toEqual(NGUONG_MAC_DINH)
    expect(luu.dat({ ...NGUONG_MAC_DINH, ngayGanDay: 45 })).toBe(true)
    expect(luu.doc().ngayGanDay).toBe(45)
  })

  it('dịch vụ dùng ngưỡng truyền vào', async () => {
    const h = lap()
    await h.muaVaTra('Khách Mẫu A', '2026-10-01')
    expect((await h.nhom.xem()).nhom.find((n) => n.nhom === 'tiem-nang')!.soKhach).toBe(1)
    const kq = await h.nhom.xem({ ...NGUONG_MAC_DINH, ngayGanDay: 30 })
    expect(kq.nhom.find((n) => n.nhom === 'sap-roi-bo')!.soKhach).toBe(1)
  })
})

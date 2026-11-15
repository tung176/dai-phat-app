import { describe, expect, it } from 'vitest'
import { taoDichVuPhieu } from './phieu-service.ts'
import { taoKhoPhieuTrongBoNho } from './kho-trong-bo-nho.ts'
import { taoKhoKhachTrongBoNho } from './kho-khach.ts'
import { taoDichVuKhach } from './khach-service.ts'

function taoHeThong() {
  const kho = taoKhoPhieuTrongBoNho()
  const khoKhach = taoKhoKhachTrongBoNho()
  const khach = taoDichVuKhach({ khoKhach, khoPhieu: kho, homNay: () => '2026-11-10' })
  const phieu = taoDichVuPhieu({ kho, khach })
  return { khach, phieu }
}

describe('thêm khách', () => {
  it('chỉ cần tên; có mã, tên hiển thị, số chưa có, chưa hỏi nhận tin, ngày tạo', async () => {
    const { khach } = taoHeThong()
    const k = await khach.them({ ten: '  Khách Mẫu A ' })
    expect(k.id).toMatch(/^K\d{4}$/)
    expect(k.tenGoc).toBe('Khách Mẫu A')
    expect(k.tenHienThi).toBe('Khách Mẫu A')
    expect(k.soDienThoai).toBeUndefined()
    expect(k.dungDuocSo).toBe(false)
    expect(k.dongYNhanTin).toBe('chua-hoi')
    expect(k.nguon).toBe('nhap-tay')
    expect(k.ngayTao).toBe('2026-11-10')
  })

  it('tên hiển thị là tên cộng ghi chú vị trí', async () => {
    const { khach } = taoHeThong()
    const k = await khach.them({ ten: 'Khách Mẫu A', viTri: 'tầng 2' })
    expect(k.tenHienThi).toBe('Khách Mẫu A (tầng 2)')
    expect(k.tenGoc).toBe('Khách Mẫu A')
    expect(k.viTri).toBe('tầng 2')
  })

  it('từ chối tên trống', async () => {
    const { khach } = taoHeThong()
    await expect(khach.them({ ten: '   ' })).rejects.toMatchObject({ ma: 'DU_LIEU_KHONG_HOP_LE' })
    expect(await khach.danhSach()).toHaveLength(0)
  })
})

describe('số điện thoại và danh sách cần bổ sung', () => {
  it.each([
    ['0900 000 001', '0900000001'],
    ['0900.000.002', '0900000002'],
    ['0900-000-003', '0900000003'],
  ])('chấp nhận và chuẩn hóa "%s"', async (nhap, chuan) => {
    const { khach } = taoHeThong()
    const k = await khach.them({ ten: 'Khách Mẫu', soDienThoai: nhap })
    expect(k.soDienThoai).toBe(chuan)
    expect(k.dungDuocSo).toBe(true)
  })

  it.each(['090000000', '09000000011', '1900000001', '+84900000001', 'abc'])(
    'số sai "%s": vẫn lưu khách, cờ không dùng được, vào danh sách cần bổ sung',
    async (sai) => {
      const { khach } = taoHeThong()
      const k = await khach.them({ ten: 'Khách Mẫu', soDienThoai: sai })
      expect(k.dungDuocSo).toBe(false)
      expect((await khach.canBoSung()).map((x) => x.id)).toEqual([k.id])
    },
  )

  it('khách thiếu số và khách số sai hiện trong cần bổ sung, khách số tốt thì không', async () => {
    const { khach } = taoHeThong()
    const thieu = await khach.them({ ten: 'Mẫu Một' })
    const sai = await khach.them({ ten: 'Mẫu Hai', soDienThoai: '123' })
    await khach.them({ ten: 'Mẫu Ba', soDienThoai: '0900000003' })
    expect((await khach.canBoSung()).map((x) => x.id)).toEqual([thieu.id, sai.id])
  })

  it('sửa số cho đúng thì rời danh sách cần bổ sung', async () => {
    const { khach } = taoHeThong()
    const k = await khach.them({ ten: 'Mẫu Một', soDienThoai: '123' })
    const sau = await khach.capNhat(k.id, { soDienThoai: '0900 000 009' })
    expect(sau.soDienThoai).toBe('0900000009')
    expect(await khach.canBoSung()).toHaveLength(0)
  })
})

describe('tìm khách', () => {
  it('theo tên (không phân biệt dấu, hoa thường), ghi chú vị trí và số điện thoại', async () => {
    const { khach } = taoHeThong()
    const a = await khach.them({ ten: 'Nguyễn Thị Lan', viTri: 'chung cư B5', soDienThoai: '0900000001' })
    const b = await khach.them({ ten: 'Trần Văn Hùng', soDienThoai: '0900000002' })
    expect((await khach.tim('nguyen thi LAN')).map((x) => x.id)).toEqual([a.id])
    expect((await khach.tim('b5')).map((x) => x.id)).toEqual([a.id])
    expect((await khach.tim('0900.000.002')).map((x) => x.id)).toEqual([b.id])
    expect((await khach.tim('0900000')).map((x) => x.id)).toEqual([a.id, b.id])
    expect(await khach.tim('không có')).toEqual([])
  })
})

describe('đồng ý nhận tin', () => {
  it('mặc định chưa hỏi; tick thì đồng ý; bỏ tick về chưa hỏi', async () => {
    const { khach } = taoHeThong()
    const k = await khach.them({ ten: 'Mẫu Một' })
    expect((await khach.datDongYNhanTin(k.id, true)).dongYNhanTin).toBe('dong-y')
    expect((await khach.datDongYNhanTin(k.id, false)).dongYNhanTin).toBe('chua-hoi')
  })
})

describe('phiếu tham chiếu khách bằng mã', () => {
  it('nhận đồ với tên mới tạo khách mới (nguồn từ phiếu), không có số điện thoại', async () => {
    const { khach, phieu } = taoHeThong()
    const p = await phieu.nhanDo({ tenKhach: 'Khách Mới', ngayNhan: '2026-11-01', moTa: '1 túi' })
    expect(p.khachId).toMatch(/^K\d{4}$/)
    expect(p.khach.ten).toBe('Khách Mới')
    const ds = await khach.danhSach()
    expect(ds).toHaveLength(1)
    expect(ds[0]).toMatchObject({ id: p.khachId, nguon: 'tu-phieu', dungDuocSo: false })
  })

  it('nhận đồ cho khách có sẵn bằng mã, không tạo khách thêm', async () => {
    const { khach, phieu } = taoHeThong()
    const k = await khach.them({ ten: 'Khách Mẫu A', viTri: 'tầng 2', soDienThoai: '0900000001' })
    const p = await phieu.nhanDo({ khachId: k.id, ngayNhan: '2026-11-01', moTa: '1 túi' })
    expect(p.khachId).toBe(k.id)
    expect(p.khach).toMatchObject({
      ten: 'Khách Mẫu A',
      tenHienThi: 'Khách Mẫu A (tầng 2)',
      soDienThoai: '0900000001',
    })
    expect(await khach.danhSach()).toHaveLength(1)
  })

  it('báo lỗi khi mã khách không tồn tại, không tạo phiếu', async () => {
    const { phieu } = taoHeThong()
    await expect(
      phieu.nhanDo({ khachId: 'K9999', ngayNhan: '2026-11-01', moTa: '1 túi' }),
    ).rejects.toMatchObject({ ma: 'KHONG_TIM_THAY' })
    expect(await phieu.danhSach()).toHaveLength(0)
  })

  it('phiếu bị từ chối thì không để lại khách mồ côi', async () => {
    const { khach, phieu } = taoHeThong()
    await expect(phieu.nhanDo({ tenKhach: 'A Mẫu', ngayNhan: 'sai', moTa: 'x' })).rejects.toBeTruthy()
    expect(await khach.danhSach()).toHaveLength(0)
  })
})

describe('gợi ý cặp tên gần giống', () => {
  it('bắt trùng tên sau khi bỏ dấu, hoa thường, khoảng trắng thừa', async () => {
    const { khach } = taoHeThong()
    const a = await khach.them({ ten: 'Nguyễn Thị Lan', viTri: 'tầng 2' })
    const b = await khach.them({ ten: '  nguyen  thi lan ' })
    const goiY = await khach.goiYGop()
    expect(goiY).toHaveLength(1)
    expect(goiY[0]).toMatchObject({ lyDo: 'trung-ten' })
    expect([goiY[0]!.a.id, goiY[0]!.b.id].sort()).toEqual([a.id, b.id])
  })

  it('bắt đổi thứ tự từ', async () => {
    const { khach } = taoHeThong()
    await khach.them({ ten: 'Lan Nguyễn Thị' })
    await khach.them({ ten: 'Nguyễn Thị Lan' })
    expect((await khach.goiYGop()).map((c) => c.lyDo)).toEqual(['doi-thu-tu-tu'])
  })

  it('bắt gõ nhầm một ký tự trong từ dài', async () => {
    const { khach } = taoHeThong()
    await khach.them({ ten: 'Trần Văn Hùng' })
    await khach.them({ ten: 'Tran Van Hung' })
    await khach.them({ ten: 'Tran Van Hunh' })
    const lyDo = (await khach.goiYGop()).map((c) => c.lyDo).sort()
    expect(lyDo).toEqual(['gan-giong', 'gan-giong', 'trung-ten'])
  })

  it('không gợi ý các tên chỉ khác chữ cái đơn (Mẫu A, Mẫu B) hay tên khác hẳn', async () => {
    const { khach } = taoHeThong()
    await khach.them({ ten: 'Khách Mẫu A' })
    await khach.them({ ten: 'Khách Mẫu B' })
    await khach.them({ ten: 'Lê Hoa' })
    expect(await khach.goiYGop()).toEqual([])
  })

  it('cảnh báo khi hai khách có hai số dùng được khác nhau', async () => {
    const { khach } = taoHeThong()
    await khach.them({ ten: 'Lan', soDienThoai: '0900000001' })
    await khach.them({ ten: 'Lan', soDienThoai: '0900000002' })
    await khach.them({ ten: 'Hoa', soDienThoai: '0900000003' })
    await khach.them({ ten: 'Hoa' })
    const goiY = await khach.goiYGop()
    expect(goiY.map((c) => c.khacSoDienThoai).sort()).toEqual([false, true])
  })

  it('gợi ý khớp cho tên mới gõ vào, không tự gán', async () => {
    const { khach } = taoHeThong()
    const a = await khach.them({ ten: 'Nguyễn Thị Lan', viTri: 'tầng 2' })
    await khach.them({ ten: 'Trần Văn Hùng' })
    expect((await khach.goiYKhop('nguyen thi lan')).map((k) => k.id)).toEqual([a.id])
    expect(await khach.goiYKhop('Phạm Thu')).toEqual([])
    expect(await khach.danhSach()).toHaveLength(2)
  })
})

describe('gộp khách', () => {
  async function tinhHuong() {
    const he = taoHeThong()
    const giu = await he.khach.them({ ten: 'Nguyễn Thị Lan', viTri: 'tầng 2', soDienThoai: '0900000001' })
    const bo = await he.khach.them({ ten: 'nguyen thi lan' })
    const bo2 = await he.khach.them({ ten: 'Lan Nguyễn Thị' })
    const p1 = await he.phieu.nhanDo({ khachId: giu.id, ngayNhan: '2026-11-01', moTa: 'một' })
    const p2 = await he.phieu.nhanDo({ khachId: bo.id, ngayNhan: '2026-11-02', moTa: 'hai' })
    const p3 = await he.phieu.nhanDo({ khachId: bo2.id, ngayNhan: '2026-11-03', moTa: 'ba' })
    return { ...he, giu, bo, bo2, p1, p2, p3 }
  }

  it('không gộp nếu chưa xác nhận; dữ liệu giữ nguyên', async () => {
    const { khach, phieu, giu, bo, bo2 } = await tinhHuong()
    await expect(
      khach.gop({ giuLai: giu.id, gopVao: [bo.id], xacNhan: false as unknown as true }),
    ).rejects.toMatchObject({ ma: 'DU_LIEU_KHONG_HOP_LE' })
    expect(await khach.danhSach()).toHaveLength(3)
    expect((await phieu.danhSach()).map((p) => p.khachId).sort()).toEqual([giu.id, bo.id, bo2.id].sort())
  })

  it('gọi gợi ý không tự gộp: danh sách vẫn đủ khách', async () => {
    const { khach } = await tinhHuong()
    expect((await khach.goiYGop()).length).toBeGreaterThan(0)
    expect(await khach.danhSach()).toHaveLength(3)
  })

  it('chuyển toàn bộ phiếu sang khách giữ lại và ẩn khách đã gộp', async () => {
    const { khach, phieu, giu, bo, bo2, p1, p2, p3 } = await tinhHuong()
    const kq = await khach.gop({ giuLai: giu.id, gopVao: [bo.id, bo2.id], xacNhan: true })
    expect(kq.soPhieuChuyen).toBe(2)
    expect((await khach.danhSach()).map((k) => k.id)).toEqual([giu.id])
    const ds = await phieu.danhSach()
    expect(ds.map((p) => p.id).sort()).toEqual([p1.id, p2.id, p3.id].sort())
    expect(ds.every((p) => p.khachId === giu.id)).toBe(true)
    expect(ds.every((p) => p.khach.tenHienThi === 'Nguyễn Thị Lan (tầng 2)')).toBe(true)
    expect(await khach.goiYGop()).toEqual([])
  })

  it('ghi nhật ký gộp', async () => {
    const { khach, giu, bo } = await tinhHuong()
    const kq = await khach.gop({ giuLai: giu.id, gopVao: [bo.id], xacNhan: true })
    const nk = await khach.nhatKyGop()
    expect(nk).toHaveLength(1)
    expect(nk[0]).toMatchObject({
      id: kq.nhatKyId,
      ngay: '2026-11-10',
      giuLai: giu.id,
      gopVao: [bo.id],
      daHoanTac: false,
    })
    expect(nk[0]!.phieuDaChuyen).toHaveLength(1)
  })

  it.each([
    ['giữ lại không tồn tại', (g: string) => ({ giuLai: 'K9999', gopVao: [g] })],
    ['gộp vào chính nó', (g: string) => ({ giuLai: g, gopVao: [g] })],
    ['danh sách gộp trống', (g: string) => ({ giuLai: g, gopVao: [] as string[] })],
  ])('từ chối khi %s', async (_ten, tao) => {
    const { khach, giu } = await tinhHuong()
    await expect(khach.gop({ ...tao(giu.id), xacNhan: true })).rejects.toBeTruthy()
    expect(await khach.danhSach()).toHaveLength(3)
    expect(await khach.nhatKyGop()).toHaveLength(0)
  })

  it('hoàn tác bằng nhật ký trả khách và phiếu về như cũ', async () => {
    const { khach, phieu, giu, bo, bo2, p1, p2, p3 } = await tinhHuong()
    const { nhatKyId } = await khach.gop({ giuLai: giu.id, gopVao: [bo.id, bo2.id], xacNhan: true })
    await khach.hoanTacGop(nhatKyId)
    expect((await khach.danhSach()).map((k) => k.id)).toEqual([giu.id, bo.id, bo2.id])
    const theoId = Object.fromEntries((await phieu.danhSach()).map((p) => [p.id, p.khachId]))
    expect(theoId).toEqual({ [p1.id]: giu.id, [p2.id]: bo.id, [p3.id]: bo2.id })
    expect((await khach.nhatKyGop())[0]!.daHoanTac).toBe(true)
  })

  it('không hoàn tác hai lần', async () => {
    const { khach, giu, bo } = await tinhHuong()
    const { nhatKyId } = await khach.gop({ giuLai: giu.id, gopVao: [bo.id], xacNhan: true })
    await khach.hoanTacGop(nhatKyId)
    await expect(khach.hoanTacGop(nhatKyId)).rejects.toMatchObject({ ma: 'SAI_TRANG_THAI' })
  })

  it('không hoàn tác khi khách giữ lại đã bị gộp tiếp vào khách khác', async () => {
    const { khach, giu, bo, bo2 } = await tinhHuong()
    const { nhatKyId } = await khach.gop({ giuLai: giu.id, gopVao: [bo.id], xacNhan: true })
    await khach.gop({ giuLai: bo2.id, gopVao: [giu.id], xacNhan: true })
    await expect(khach.hoanTacGop(nhatKyId)).rejects.toMatchObject({ ma: 'SAI_TRANG_THAI' })
  })

  it('phiếu nhận sau khi gộp ở khách giữ lại không bị kéo ngược khi hoàn tác', async () => {
    const { khach, phieu, giu, bo } = await tinhHuong()
    const { nhatKyId } = await khach.gop({ giuLai: giu.id, gopVao: [bo.id], xacNhan: true })
    const moi = await phieu.nhanDo({ khachId: giu.id, ngayNhan: '2026-11-05', moTa: 'sau gộp' })
    await khach.hoanTacGop(nhatKyId)
    expect((await phieu.danhSach()).find((p) => p.id === moi.id)?.khachId).toBe(giu.id)
  })

  it('nhận đồ cho khách đã bị gộp thì bị từ chối', async () => {
    const { khach, phieu, giu, bo } = await tinhHuong()
    await khach.gop({ giuLai: giu.id, gopVao: [bo.id], xacNhan: true })
    await expect(
      phieu.nhanDo({ khachId: bo.id, ngayNhan: '2026-11-05', moTa: 'x' }),
    ).rejects.toMatchObject({ ma: 'KHONG_TIM_THAY' })
  })
})

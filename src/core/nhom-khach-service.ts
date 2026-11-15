/** Ticket 10: dịch vụ nhóm khách: xem nhóm, tick đồng ý nhận tin (có nhật ký), danh sách nhắn tin. */
import type { Khach } from './khach.ts'
import type { DichVuKhach } from './khach-service.ts'
import { danhSachNhanTin, type DanhSachNhanTin } from './nhan-tin.ts'
import type { DongThayDoi, KhoNhatKyPhieu, NguoiThucHien, ThoiDiem } from './nhat-ky-phieu.ts'
import { tinhNhomKhach, type KetQuaNhomKhach, type MaNhom, type NguongNhom } from './nhom-khach.ts'
import type { DichVuPhieu } from './phieu-service.ts'
import { LoiNghiepVu, type NgayIso } from './types.ts'

export interface DichVuNhomKhach {
  xem(nguong?: NguongNhom): Promise<KetQuaNhomKhach>
  danhSachNhanTin(nhom: MaNhom, nguong?: NguongNhom): Promise<DanhSachNhanTin>
  datDongY(khachId: string, dongY: boolean): Promise<Khach>
  /** Tick đồng ý cho mọi khách trong nhóm. Phải có xacNhan: true (người dùng đã xác nhận). */
  datDongYHangLoat(dauVao: { nhom: MaNhom; nguong?: NguongNhom; xacNhan: true }): Promise<{ soDoi: number }>
}

function homNayMacDinh(): ThoiDiem {
  const d = new Date()
  const p = (x: number) => String(x).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

export function taoDichVuNhomKhach(phuThuoc: {
  khach: DichVuKhach
  phieu: DichVuPhieu
  khoNhatKy: KhoNhatKyPhieu
  nguoiHienTai: () => Promise<NguoiThucHien>
  /** Đồng hồ tiêm vào để thử. */
  homNay?: () => NgayIso
  dongHo?: () => ThoiDiem
}): DichVuNhomKhach {
  const { khach, phieu, khoNhatKy } = phuThuoc
  const dongHo = phuThuoc.dongHo ?? homNayMacDinh
  const homNay = phuThuoc.homNay ?? (() => dongHo().slice(0, 10))

  async function xem(nguong?: NguongNhom) {
    const [ds, phieus] = await Promise.all([khach.danhSach(), phieu.danhSach()])
    return tinhNhomKhach({ khach: ds, phieus, homNay: homNay(), nguong })
  }

  async function ghiNhatKy(thayDoi: DongThayDoi[], lyDo: string) {
    const luc = dongHo()
    await khoNhatKy.them({
      luc,
      ngay: luc.slice(0, 10),
      nguoi: await phuThuoc.nguoiHienTai(),
      loai: 'doi-dong-y-nhan-tin',
      phieuId: null,
      thayDoi,
      lyDo,
      batThuong: [],
    })
  }

  const chuoiDongY = (b: boolean) => (b ? 'dong-y' : 'chua-hoi')

  return {
    xem,
    async danhSachNhanTin(nhom, nguong) {
      return danhSachNhanTin((await xem(nguong)).khach, nhom)
    },
    async datDongY(khachId, dongY) {
      const truoc = await khach.lay(khachId)
      if (!truoc) throw new LoiNghiepVu('KHONG_TIM_THAY', 'Không tìm thấy khách.')
      if (truoc.dongYNhanTin === chuoiDongY(dongY)) return truoc
      const sau = await khach.datDongYNhanTin(khachId, dongY)
      await ghiNhatKy(
        [{ truong: `dongYNhanTin:${khachId}`, truoc: truoc.dongYNhanTin, sau: sau.dongYNhanTin }],
        dongY ? 'Tick đồng ý nhận tin' : 'Bỏ tick đồng ý nhận tin',
      )
      return sau
    },
    async datDongYHangLoat(dauVao) {
      if (dauVao.xacNhan !== true) {
        throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', 'Cần xác nhận trước khi tick hàng loạt.')
      }
      const kq = await xem(dauVao.nguong)
      const canDoi = kq.khach.filter((k) => k.nhom === dauVao.nhom && !k.dongYNhanTin)
      const thayDoi: DongThayDoi[] = []
      for (const k of canDoi) {
        await khach.datDongYNhanTin(k.khachId, true)
        thayDoi.push({ truong: `dongYNhanTin:${k.khachId}`, truoc: 'chua-hoi', sau: 'dong-y' })
      }
      if (thayDoi.length > 0) await ghiNhatKy(thayDoi, `Tick hàng loạt đồng ý nhận tin cho nhóm ${dauVao.nhom}`)
      return { soDoi: thayDoi.length }
    },
  }
}

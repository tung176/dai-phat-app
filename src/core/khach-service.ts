import {
  chuanHoaSoDienThoai,
  chuanHoaTen,
  doGiong,
  tenHienThi,
  type BanGhiKhach,
  type CapGoiYGop,
  type Khach,
  type NguonKhach,
  type NhatKyGop,
} from './khach.ts'
import type { KhoKhach } from './kho-khach.ts'
import type { KhoPhieu } from './kho-phieu.ts'
import { LoiNghiepVu, type NgayIso } from './types.ts'

export interface DauVaoThemKhach {
  ten: string
  viTri?: string
  soDienThoai?: string
  nguon?: NguonKhach
}

export interface DauVaoCapNhatKhach {
  ten?: string
  /** Chuỗi trống nghĩa là xóa. */
  viTri?: string
  soDienThoai?: string
}

export interface DauVaoGop {
  giuLai: string
  gopVao: string[]
  /** Phải là true: người dùng đã xác nhận. Không bao giờ tự gộp. */
  xacNhan: true
}

export interface DichVuKhach {
  them(dauVao: DauVaoThemKhach): Promise<Khach>
  capNhat(id: string, dauVao: DauVaoCapNhatKhach): Promise<Khach>
  datDongYNhanTin(id: string, dongY: boolean): Promise<Khach>
  /** Khách còn hiệu lực (chưa bị gộp). */
  danhSach(): Promise<Khach[]>
  /** Tra theo mã, kể cả khách đã bị gộp. */
  lay(id: string): Promise<Khach | undefined>
  canBoSung(): Promise<Khach[]>
  tim(truyVan: string): Promise<Khach[]>
  goiYGop(): Promise<CapGoiYGop[]>
  /** Khách có tên gần giống tên mới gõ, để người dùng chọn dùng lại. Không tự gán. */
  goiYKhop(tenMoi: string): Promise<Khach[]>
  gop(dauVao: DauVaoGop): Promise<{ nhatKyId: string; soPhieuChuyen: number }>
  hoanTacGop(nhatKyId: string): Promise<void>
  nhatKyGop(): Promise<NhatKyGop[]>
}

export function xemKhach(b: BanGhiKhach): Khach {
  return {
    ...b,
    tenHienThi: tenHienThi(b.tenGoc, b.viTri),
    dungDuocSo: b.soDienThoai !== undefined && chuanHoaSoDienThoai(b.soDienThoai).dungDuoc,
  }
}

function loiDuLieu(thongBao: string): never {
  throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', thongBao)
}

function homNayMacDinh(): NgayIso {
  const d = new Date()
  const p = (x: number) => String(x).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export function taoDichVuKhach(phuThuoc: {
  khoKhach: KhoKhach
  khoPhieu: KhoPhieu
  /** Đồng hồ tiêm vào để thử; mặc định lấy ngày hôm nay. */
  homNay?: () => NgayIso
}): DichVuKhach {
  const { khoKhach, khoPhieu } = phuThuoc
  const homNay = phuThuoc.homNay ?? homNayMacDinh

  async function layHoacBao(id: string): Promise<BanGhiKhach> {
    const b = await khoKhach.lay(id)
    if (!b) throw new LoiNghiepVu('KHONG_TIM_THAY', 'Không tìm thấy khách.')
    return b
  }

  async function conHieuLuc(): Promise<Khach[]> {
    return (await khoKhach.tatCa()).filter((b) => b.daGopVao === undefined).map(xemKhach)
  }

  return {
    async them(dauVao) {
      const ten = dauVao.ten.trim()
      if (ten === '') loiDuLieu('Cần nhập tên khách.')
      const viTri = dauVao.viTri?.trim()
      const sdt =
        dauVao.soDienThoai === undefined ? undefined : chuanHoaSoDienThoai(dauVao.soDienThoai).soDienThoai
      const moi = await khoKhach.them({
        tenGoc: ten,
        ...(viTri ? { viTri } : {}),
        ...(sdt ? { soDienThoai: sdt } : {}),
        dongYNhanTin: 'chua-hoi',
        nguon: dauVao.nguon ?? 'nhap-tay',
        ngayTao: homNay(),
      })
      return xemKhach(moi)
    },

    async capNhat(id, dauVao) {
      const { viTri: _viTri, soDienThoai: _sdt, ...goc } = await layHoacBao(id)
      let viTri = _viTri
      let soDienThoai = _sdt
      let tenGoc = goc.tenGoc
      if (dauVao.ten !== undefined) {
        tenGoc = dauVao.ten.trim()
        if (tenGoc === '') loiDuLieu('Cần nhập tên khách.')
      }
      if (dauVao.viTri !== undefined) viTri = dauVao.viTri.trim() || undefined
      if (dauVao.soDienThoai !== undefined) {
        soDienThoai = chuanHoaSoDienThoai(dauVao.soDienThoai).soDienThoai
      }
      const b: BanGhiKhach = {
        ...goc,
        tenGoc,
        ...(viTri ? { viTri } : {}),
        ...(soDienThoai ? { soDienThoai } : {}),
      }
      await khoKhach.ghi(b)
      return xemKhach(b)
    },

    async datDongYNhanTin(id, dongY) {
      const b: BanGhiKhach = {
        ...(await layHoacBao(id)),
        dongYNhanTin: dongY ? 'dong-y' : 'chua-hoi',
      }
      await khoKhach.ghi(b)
      return xemKhach(b)
    },

    danhSach: conHieuLuc,

    async lay(id) {
      const b = await khoKhach.lay(id)
      return b ? xemKhach(b) : undefined
    },

    async canBoSung() {
      return (await conHieuLuc()).filter((k) => !k.dungDuocSo)
    },

    async tim(truyVan) {
      const q = chuanHoaTen(truyVan)
      const so = truyVan.replace(/[\s.-]/g, '')
      const timSo = /^\d+$/.test(so)
      const ds = await conHieuLuc()
      if (q === '' && !timSo) return ds
      return ds.filter(
        (k) =>
          (q !== '' && (chuanHoaTen(k.tenGoc).includes(q) || chuanHoaTen(k.viTri ?? '').includes(q))) ||
          (timSo && (k.soDienThoai ?? '').includes(so)),
      )
    },

    async goiYGop() {
      const ds = await conHieuLuc()
      const cap: CapGoiYGop[] = []
      for (let i = 0; i < ds.length; i += 1) {
        for (let j = i + 1; j < ds.length; j += 1) {
          const a = ds[i]!
          const b = ds[j]!
          const lyDo = doGiong(a.tenGoc, b.tenGoc)
          if (!lyDo) continue
          cap.push({
            a,
            b,
            lyDo,
            khacSoDienThoai: a.dungDuocSo && b.dungDuocSo && a.soDienThoai !== b.soDienThoai,
          })
        }
      }
      return cap
    },

    async goiYKhop(tenMoi) {
      return (await conHieuLuc()).filter((k) => doGiong(k.tenGoc, tenMoi) !== undefined)
    },

    async gop(dauVao) {
      if (dauVao.xacNhan !== true) loiDuLieu('Cần xác nhận trước khi gộp khách.')
      const gopVao = [...new Set(dauVao.gopVao)]
      if (gopVao.length === 0) loiDuLieu('Cần chọn ít nhất một khách để gộp vào.')
      if (gopVao.includes(dauVao.giuLai)) loiDuLieu('Không gộp khách vào chính nó.')
      const giu = await layHoacBao(dauVao.giuLai)
      if (giu.daGopVao !== undefined) loiDuLieu('Khách giữ lại đã bị gộp vào khách khác.')
      const bi = await Promise.all(gopVao.map(layHoacBao))
      if (bi.some((b) => b.daGopVao !== undefined)) loiDuLieu('Có khách đã được gộp trước đó.')

      const phieuDaChuyen: NhatKyGop['phieuDaChuyen'] = []
      const phieuCanDoi = (await khoPhieu.tatCa()).filter((p) => gopVao.includes(p.khachId))
      for (const p of phieuCanDoi) {
        phieuDaChuyen.push({ phieuId: p.id, khachIdCu: p.khachId })
        await khoPhieu.ghi({ ...p, khachId: giu.id })
      }
      for (const b of bi) await khoKhach.ghi({ ...b, daGopVao: giu.id })
      const nk = await khoKhach.themNhatKy({
        ngay: homNay(),
        giuLai: giu.id,
        gopVao,
        phieuDaChuyen,
        daHoanTac: false,
      })
      return { nhatKyId: nk.id, soPhieuChuyen: phieuDaChuyen.length }
    },

    async hoanTacGop(nhatKyId) {
      const nk = await khoKhach.layNhatKy(nhatKyId)
      if (!nk) throw new LoiNghiepVu('KHONG_TIM_THAY', 'Không tìm thấy nhật ký gộp.')
      if (nk.daHoanTac) throw new LoiNghiepVu('SAI_TRANG_THAI', 'Lần gộp này đã được hoàn tác.')
      const giu = await layHoacBao(nk.giuLai)
      if (giu.daGopVao !== undefined) {
        throw new LoiNghiepVu('SAI_TRANG_THAI', 'Khách giữ lại đã bị gộp tiếp; hoàn tác lần gộp sau trước.')
      }
      for (const { phieuId, khachIdCu } of nk.phieuDaChuyen) {
        const p = await khoPhieu.lay(phieuId)
        if (p && p.khachId === nk.giuLai) await khoPhieu.ghi({ ...p, khachId: khachIdCu })
      }
      for (const id of nk.gopVao) {
        const { daGopVao: _bo, ...conLai } = await layHoacBao(id)
        await khoKhach.ghi(conLai)
      }
      await khoKhach.ghiNhatKy({ ...nk, daHoanTac: true })
    },

    async nhatKyGop() {
      return khoKhach.tatCaNhatKy()
    },
  }
}

import type { BangDem } from './bang-dem.ts'
import { SO_COT_PHIEU, TAB_PHIEU, sangDong, tuDong } from './dong-phieu.ts'
import { LoiDongBo, goiAppsScript } from './gas-client.ts'
import type { KhoPhieu } from './kho-phieu.ts'
import type { CauHinhSheets } from './ma-cai-dat.ts'
import type { BanGhiPhieu } from './types.ts'

export type KieuDongBo =
  /** Chưa dán mã cài đặt: vẫn dùng được, dữ liệu nằm trong máy và chờ gửi. */
  | 'chua-cai-dat'
  /** Đã cài đặt nhưng chưa đồng bộ lần nào trong lần mở này. */
  | 'chua-dong-bo'
  | 'dang-gui'
  | 'da-dong-bo'
  /** Không tới được máy chủ: dữ liệu giữ trong máy, tự gửi khi có mạng. */
  | 'cho-mang'
  /** Apps Script từ chối (sai mã bí mật, chưa đặt mã...): cần xem lại cài đặt. */
  | 'loi'

export interface TrangThaiDongBo {
  kieu: KieuDongBo
  /** Số phiếu đang chờ gửi lên Sheet. */
  choGui: number
  /** Lần đồng bộ thành công gần nhất (mili giây), nếu có. */
  lanCuoi?: number
  /** Thông báo cho người dùng khi lỗi. Không bao giờ chứa địa chỉ hay mã bí mật. */
  thongBao?: string
}

export interface KhoSheets extends KhoPhieu {
  /** Đẩy phiếu chờ gửi lên Sheet rồi kéo bản mới về. Gọi chồng nhau sẽ xếp hàng, không chạy song song. */
  dongBo(): Promise<void>
  trangThai(): TrangThaiDongBo
  /** Đăng ký nhận báo khi dữ liệu hoặc trạng thái đổi. Trả về hàm hủy đăng ký. */
  theoDoi(nghe: () => void): () => void
}

export interface TuyChonKhoSheets {
  bangDem: BangDem
  /** Đọc cấu hình mỗi lần cần, để dán mã cài đặt xong là dùng được ngay. null = chưa cài đặt. */
  cauHinh: () => CauHinhSheets | null
  fetch?: typeof fetch
  /** Mặc định true: ghi xong tự đồng bộ ngầm. */
  tuDong?: boolean
  taoId?: () => string
  bayGio?: () => number
}

const CO_MOT_LAN_GUI = 200

function taoIdMacDinh(nam: number): string {
  const b = crypto.getRandomValues(new Uint8Array(6))
  const ma = [...b].map((x) => x.toString(36).padStart(2, '0').slice(-2)).join('').toUpperCase()
  return `P${nam}-${ma}`
}

export function taoKhoSheets(tuy: TuyChonKhoSheets): KhoSheets {
  const { bangDem } = tuy
  const bayGio = tuy.bayGio ?? (() => Date.now())
  const taoId = tuy.taoId ?? (() => taoIdMacDinh(new Date(bayGio()).getFullYear()))
  const tuDongDay = tuy.tuDong ?? true

  let trangThai: TrangThaiDongBo = { kieu: tuy.cauHinh() ? 'chua-dong-bo' : 'chua-cai-dat', choGui: 0 }
  const nguoiNghe = new Set<() => void>()
  const bao = () => nguoiNghe.forEach((f) => f())
  const datTrangThai = (t: Partial<TrangThaiDongBo>) => {
    trangThai = { ...trangThai, ...t }
    if (t.thongBao === undefined) delete trangThai.thongBao
    bao()
  }

  async function capNhatSoCho() {
    trangThai = { ...trangThai, choGui: (await bangDem.choGui()).length }
  }
  // Mở app lại: biết ngay có bao nhiêu phiếu còn chờ gửi từ lần trước.
  void capNhatSoCho().then(bao, () => {})
  void bangDem.docLanDongBoCuoi().then(
    (l) => {
      if (l !== undefined) trangThai = { ...trangThai, lanCuoi: l }
    },
    () => {},
  )

  async function chayDongBo(): Promise<void> {
    const cauHinh = tuy.cauHinh()
    await capNhatSoCho()
    if (!cauHinh) {
      datTrangThai({ kieu: 'chua-cai-dat', thongBao: undefined })
      return
    }
    datTrangThai({ kieu: 'dang-gui', thongBao: undefined })
    try {
      const cho = await bangDem.choGui()
      for (let i = 0; i < cho.length; i += CO_MOT_LAN_GUI) {
        const lo = cho.slice(i, i + CO_MOT_LAN_GUI)
        await goiAppsScript(
          cauHinh,
          'upsert',
          { tab: TAB_PHIEU, rows: lo.map((m) => sangDong(m.banGhi, bayGio())) },
          tuy.fetch,
        )
        await bangDem.danhDauDaGui(lo.map((m) => ({ id: m.banGhi.id, phienBan: m.phienBan })))
      }
      const keo = await goiAppsScript<{ rows: unknown[][] }>(cauHinh, 'pull', { tab: TAB_PHIEU }, tuy.fetch)
      const tuMayChu = keo.rows
        .map((d) => (Array.isArray(d) && d.length >= SO_COT_PHIEU ? tuDong(d) : undefined))
        .filter((b): b is BanGhiPhieu => b !== undefined)
      await bangDem.nhanTuMayChu(tuMayChu)
      const luc = bayGio()
      await bangDem.datLanDongBoCuoi(luc)
      await capNhatSoCho()
      datTrangThai({ kieu: 'da-dong-bo', lanCuoi: luc, thongBao: undefined })
    } catch (e) {
      await capNhatSoCho()
      if (e instanceof LoiDongBo && e.loai === 'tu-choi') {
        datTrangThai({ kieu: 'loi', thongBao: e.message })
      } else {
        datTrangThai({
          kieu: 'cho-mang',
          thongBao: e instanceof LoiDongBo ? e.message : 'Chưa đồng bộ được, sẽ thử lại.',
        })
      }
    }
  }

  // Xếp hàng: mỗi lượt đồng bộ chạy sau lượt trước, không bao giờ hai lượt cùng lúc.
  let hang: Promise<void> = Promise.resolve()
  function dongBo(): Promise<void> {
    const lan = hang.then(chayDongBo)
    hang = lan.catch(() => {})
    return lan
  }

  async function sauKhiGhi() {
    await capNhatSoCho()
    bao()
    if (tuDongDay) void dongBo()
  }

  return {
    async them(banGhi) {
      const moi: BanGhiPhieu = { ...banGhi, id: taoId() }
      await bangDem.ghi(moi)
      await sauKhiGhi()
      return structuredClone(moi)
    },
    lay: (id) => bangDem.lay(id),
    async ghi(banGhi) {
      await bangDem.ghi(banGhi)
      await sauKhiGhi()
    },
    tatCa: () => bangDem.tatCa(),
    dongBo,
    trangThai: () => ({ ...trangThai }),
    theoDoi(nghe) {
      nguoiNghe.add(nghe)
      return () => {
        nguoiNghe.delete(nghe)
      }
    },
  }
}

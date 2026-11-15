import type { BangDem } from './bang-dem.ts'
import { LoiDongBo, goiAppsScript } from './gas-client.ts'
import type { CauHinhSheets } from './ma-cai-dat.ts'

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
  /** Số bản ghi (phiếu, khách...) đang chờ gửi lên Sheet. */
  choGui: number
  /** Lần đồng bộ thành công gần nhất trong lần mở này (mili giây), nếu có. */
  lanCuoi?: number
  /** Thông báo cho người dùng khi lỗi. Không bao giờ chứa địa chỉ hay mã bí mật. */
  thongBao?: string
}

/** Một bảng dữ liệu ứng với một tab trong Sheet. */
export interface MoTaBang<T extends { id: string }> {
  /** Tên tab trong Sheet; phải có trong TABS của apps-script/Code.gs. */
  tab: string
  bangDem: BangDem<T>
  sangDong(b: T, capNhatLuc: number): string[]
  /** Trả undefined nếu dòng hỏng để bỏ qua. */
  tuDong(d: readonly unknown[]): T | undefined
}

/** Bảng đã đăng ký vào bộ đồng bộ: ghi vào đây là bản đệm cập nhật, hàng đợi có thêm, và bộ đồng bộ được báo. */
export interface BangDaDangKy<T extends { id: string }> {
  ghi(b: T): Promise<void>
  lay(id: string): Promise<T | undefined>
  tatCa(): Promise<T[]>
}

export interface DongBoSheets {
  /** Đăng ký bảng. Thứ tự đăng ký là thứ tự gửi lên (đăng ký bảng được tham chiếu trước, ví dụ Khách trước Phiếu). */
  themBang<T extends { id: string }>(mo: MoTaBang<T>): BangDaDangKy<T>
  /** Đẩy hàng đợi lên Sheet rồi kéo bản mới về. Gọi chồng nhau sẽ xếp hàng, không chạy song song. */
  dongBo(): Promise<void>
  trangThai(): TrangThaiDongBo
  /** Đăng ký nhận báo khi dữ liệu hoặc trạng thái đổi. Trả về hàm hủy đăng ký. */
  theoDoi(nghe: () => void): () => void
}

export interface TuyChonDongBo {
  /** Đọc cấu hình mỗi lần cần, để dán mã cài đặt xong là dùng được ngay. null = chưa cài đặt. */
  cauHinh: () => CauHinhSheets | null
  fetch?: typeof fetch
  /** Mặc định true: ghi xong tự đồng bộ ngầm. */
  tuDong?: boolean
  bayGio?: () => number
}

const CO_MOT_LAN_GUI = 200

interface BangAn {
  tab: string
  soCho(): Promise<number>
  gui(cauHinh: CauHinhSheets, luc: number): Promise<void>
  keo(cauHinh: CauHinhSheets): Promise<() => Promise<void>>
}

export function taoDongBoSheets(tuy: TuyChonDongBo): DongBoSheets {
  const bayGio = tuy.bayGio ?? (() => Date.now())
  const tuDongDay = tuy.tuDong ?? true
  const cacBang: BangAn[] = []

  let trangThai: TrangThaiDongBo = { kieu: tuy.cauHinh() ? 'chua-dong-bo' : 'chua-cai-dat', choGui: 0 }
  const nguoiNghe = new Set<() => void>()
  const bao = () => nguoiNghe.forEach((f) => f())
  const datTrangThai = (t: Partial<TrangThaiDongBo>) => {
    trangThai = { ...trangThai, ...t }
    if (t.thongBao === undefined) delete trangThai.thongBao
    bao()
  }

  async function capNhatSoCho() {
    let n = 0
    for (const b of cacBang) n += await b.soCho()
    trangThai = { ...trangThai, choGui: n }
  }

  async function chayDongBo(): Promise<void> {
    const cauHinh = tuy.cauHinh()
    await capNhatSoCho()
    if (!cauHinh) {
      datTrangThai({ kieu: 'chua-cai-dat', thongBao: undefined })
      return
    }
    datTrangThai({ kieu: 'dang-gui', thongBao: undefined })
    try {
      for (const b of cacBang) await b.gui(cauHinh, bayGio())
      // Kéo hết về trước rồi mới áp vào bản đệm, để lỗi giữa chừng không để dữ liệu nửa cũ nửa mới.
      const ap: Array<() => Promise<void>> = []
      for (const b of cacBang) ap.push(await b.keo(cauHinh))
      for (const f of ap) await f()
      await capNhatSoCho()
      datTrangThai({ kieu: 'da-dong-bo', lanCuoi: bayGio(), thongBao: undefined })
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

  return {
    themBang<T extends { id: string }>(mo: MoTaBang<T>): BangDaDangKy<T> {
      const { bangDem } = mo
      cacBang.push({
        tab: mo.tab,
        async soCho() {
          return (await bangDem.choGui()).length
        },
        async gui(cauHinh, luc) {
          const cho = await bangDem.choGui()
          for (let i = 0; i < cho.length; i += CO_MOT_LAN_GUI) {
            const lo = cho.slice(i, i + CO_MOT_LAN_GUI)
            await goiAppsScript(
              cauHinh,
              'upsert',
              { tab: mo.tab, rows: lo.map((m) => mo.sangDong(m.banGhi, luc)) },
              tuy.fetch,
            )
            await bangDem.danhDauDaGui(lo.map((m) => ({ id: m.banGhi.id, phienBan: m.phienBan })))
          }
        },
        async keo(cauHinh) {
          const r = await goiAppsScript<{ rows: unknown[][] }>(cauHinh, 'pull', { tab: mo.tab }, tuy.fetch)
          const ds = r.rows
            .map((d) => (Array.isArray(d) ? mo.tuDong(d) : undefined))
            .filter((b): b is T => b !== undefined)
          return () => bangDem.nhanTuMayChu(ds)
        },
      })
      // Mở app lại: biết ngay có bao nhiêu bản ghi còn chờ gửi từ lần trước.
      void capNhatSoCho().then(bao, () => {})
      return {
        async ghi(b) {
          await bangDem.ghi(b)
          await capNhatSoCho()
          bao()
          if (tuDongDay) void dongBo()
        },
        lay: (id) => bangDem.lay(id),
        tatCa: () => bangDem.tatCa(),
      }
    },
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

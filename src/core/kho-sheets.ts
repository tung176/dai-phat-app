import type { BangDem } from './bang-dem.ts'
import { taoBangDemTrongBoNho } from './bang-dem.ts'
import { taoDongBoSheets, type DongBoSheets, type TuyChonDongBo } from './dong-bo-sheets.ts'
import { TAB_KHACH, TAB_NHAT_KY, khachSangDong, khachTuDong, nhatKySangDong, nhatKyTuDong } from './dong-khach.ts'
import { TAB_PHIEU, sangDong, tuDong } from './dong-phieu.ts'
import {
  MA_CAI_DAT_PHIEU,
  TAB_CAI_DAT_PHIEU,
  TAB_DA_XEM,
  TAB_NHAT_KY_PHIEU,
  caiDatSangDong,
  caiDatTuDong,
  daXemSangDong,
  daXemTuDong,
  nhatKyPhieuSangDong,
  nhatKyPhieuTuDong,
  type DongCaiDatPhieu,
  type DongDaXem,
  type DongNhatKyPhieu,
} from './dong-nhat-ky-phieu.ts'
import type { BanGhiKhach, NhatKyGop } from './khach.ts'
import type { KhoCaiDatPhieu, KhoNhatKyPhieu } from './nhat-ky-phieu.ts'
import type { KhoKhach } from './kho-khach.ts'
import type { KhoPhieu } from './kho-phieu.ts'
import type { BanGhiPhieu } from './types.ts'

export interface HeKhoSheets {
  phieu: KhoPhieu
  khach: KhoKhach
  /** Ticket 05: nhật ký thay đổi phiếu (chỉ thêm) và đánh dấu đã xem. */
  nhatKyPhieu: KhoNhatKyPhieu
  /** Ticket 05: cài đặt sửa sai (người dùng hiện tại, công tắc, ngưỡng, khóa tháng). */
  caiDatPhieu: KhoCaiDatPhieu
  /** Một bộ đồng bộ chung cho cả phiếu, khách, nhật ký gộp: một chỉ báo trạng thái, một hàng đợi. */
  dongBo: DongBoSheets
}

export interface TuyChonHeKhoSheets extends TuyChonDongBo {
  /** Mặc định là bản đệm trong bộ nhớ (dùng khi thử); app thật truyền IndexedDB. */
  bangDem?: {
    phieu: BangDem<BanGhiPhieu>
    khach: BangDem<BanGhiKhach>
    nhatKy: BangDem<NhatKyGop>
    /** Ba bảng của ticket 05; thiếu thì dùng bản đệm trong bộ nhớ. */
    nhatKyPhieu?: BangDem<DongNhatKyPhieu>
    daXem?: BangDem<DongDaXem>
    caiDatPhieu?: BangDem<DongCaiDatPhieu>
  }
  /** Sinh mã bản ghi mới; tiền tố là 'P' (phiếu), 'K' (khách), 'G' (gộp khách), 'N' (nhật ký phiếu). */
  taoId?: (tienTo: string) => string
}

/**
 * Mã mới sinh ngay tại máy (không chờ máy chủ cấp) nên ghi lúc mất mạng được, và gửi lại không nhân đôi.
 * Dạng "P2026-<thời điểm base36><ngẫu nhiên>": cùng năm thì sắp theo mã là sắp theo thời điểm tạo.
 */
function taoIdMacDinh(tienTo: string, bayGio: () => number): string {
  const luc = bayGio()
  const nam = new Date(luc).getFullYear()
  const ngauNhien = [...crypto.getRandomValues(new Uint8Array(3))]
    .map((x) => x.toString(36).padStart(2, '0').slice(-2))
    .join('')
  return `${tienTo}${nam}-${luc.toString(36).padStart(9, '0')}${ngauNhien}`.toUpperCase()
}

/** Cài các cổng KhoPhieu và KhoKhach bằng bản đệm cục bộ và đồng bộ lên Google Sheet qua Apps Script. */
export function taoHeKhoSheets(tuy: TuyChonHeKhoSheets): HeKhoSheets {
  const bayGio = tuy.bayGio ?? (() => Date.now())
  const taoId = tuy.taoId ?? ((t: string) => taoIdMacDinh(t, bayGio))
  const dongBo = taoDongBoSheets(tuy)
  const dem = tuy.bangDem ?? {
    phieu: taoBangDemTrongBoNho<BanGhiPhieu>(),
    khach: taoBangDemTrongBoNho<BanGhiKhach>(),
    nhatKy: taoBangDemTrongBoNho<NhatKyGop>(),
  }
  // Thứ tự đăng ký = thứ tự gửi: khách trước phiếu, để trên Sheet không có phiếu trỏ tới khách chưa có.
  const khach = dongBo.themBang({
    tab: TAB_KHACH,
    bangDem: dem.khach,
    sangDong: khachSangDong,
    tuDong: khachTuDong,
  })
  const nhatKy = dongBo.themBang({
    tab: TAB_NHAT_KY,
    bangDem: dem.nhatKy,
    sangDong: nhatKySangDong,
    tuDong: nhatKyTuDong,
  })
  const phieu = dongBo.themBang({ tab: TAB_PHIEU, bangDem: dem.phieu, sangDong, tuDong })
  const nhatKyPhieu = dongBo.themBang({
    tab: TAB_NHAT_KY_PHIEU,
    bangDem: dem.nhatKyPhieu ?? taoBangDemTrongBoNho<DongNhatKyPhieu>(),
    sangDong: nhatKyPhieuSangDong,
    tuDong: nhatKyPhieuTuDong,
  })
  const daXem = dongBo.themBang({
    tab: TAB_DA_XEM,
    bangDem: dem.daXem ?? taoBangDemTrongBoNho<DongDaXem>(),
    sangDong: daXemSangDong,
    tuDong: daXemTuDong,
  })
  const caiDatPhieu = dongBo.themBang({
    tab: TAB_CAI_DAT_PHIEU,
    bangDem: dem.caiDatPhieu ?? taoBangDemTrongBoNho<DongCaiDatPhieu>(),
    sangDong: caiDatSangDong,
    tuDong: caiDatTuDong,
  })

  return {
    dongBo,
    nhatKyPhieu: {
      async them(n) {
        const moi = { ...structuredClone(n), id: taoId('N') }
        await nhatKyPhieu.ghi(moi)
        return structuredClone(moi)
      },
      async tatCa() {
        return (await nhatKyPhieu.tatCa()).sort((a, b) => a.id.localeCompare(b.id))
      },
      async themDaXem(x) {
        // Mã dòng = mã nhật ký: đã xem rồi thì không ghi đè (giữ người xem đầu tiên).
        if (await daXem.lay(x.nhatKyId)) return
        await daXem.ghi({ ...structuredClone(x), id: x.nhatKyId })
      },
      async tatCaDaXem() {
        return (await daXem.tatCa()).map(({ id: _id, ...x }) => x)
      },
    },
    caiDatPhieu: {
      async doc() {
        const c = await caiDatPhieu.lay(MA_CAI_DAT_PHIEU)
        if (!c) return undefined
        const { id: _id, ...noiDung } = c
        return noiDung
      },
      ghi: (c) => caiDatPhieu.ghi({ ...structuredClone(c), id: MA_CAI_DAT_PHIEU }),
    },
    phieu: {
      async them(b) {
        const moi: BanGhiPhieu = { ...b, id: taoId('P') }
        await phieu.ghi(moi)
        return structuredClone(moi)
      },
      lay: (id) => phieu.lay(id),
      ghi: (b) => phieu.ghi(b),
      tatCa: () => phieu.tatCa(),
    },
    khach: {
      async them(b) {
        const moi: BanGhiKhach = { ...b, id: taoId('K') }
        await khach.ghi(moi)
        return structuredClone(moi)
      },
      lay: (id) => khach.lay(id),
      ghi: (b) => khach.ghi(b),
      tatCa: () => khach.tatCa(),
      async themNhatKy(n) {
        const moi: NhatKyGop = { ...n, id: taoId('G') }
        await nhatKy.ghi(moi)
        return structuredClone(moi)
      },
      layNhatKy: (id) => nhatKy.lay(id),
      ghiNhatKy: (n) => nhatKy.ghi(n),
      tatCaNhatKy: () => nhatKy.tatCa(),
    },
  }
}

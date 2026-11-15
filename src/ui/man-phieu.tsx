import { useMemo, useState } from 'react'
import { timPhieu } from '../core/danh-sach-phieu.ts'
import type { DichVuKhach } from '../core/khach-service.ts'
import type { DauVaoNhanDo } from '../core/phieu-service.ts'
import type { NhanPhieu, Phieu } from '../core/types.ts'
import { docNgay } from './dinh-dang.ts'
import { DongPhieu, type HanhDongPhieu } from './dong-phieu-ui.tsx'
import { FormNhanDo } from './form-nhan-do.tsx'
import './man-danh-sach.css'

const LOC: Array<NhanPhieu | 'Tất cả'> = ['Tất cả', 'Chưa tính tiền', 'Chờ trả khách', 'Đã trả', 'Đã hủy']

/** Màn Phiếu: nhận đồ, và MỘT danh sách duy nhất vừa xem vừa thao tác (chốt tiền, trả khách, sửa sai, đóng phiếu). */
export function ManPhieu(props: {
  phieus: Phieu[]
  khach: DichVuKhach
  hanhDong: HanhDongPhieu
  onNhan: (taoDauVao: () => Promise<DauVaoNhanDo>) => Promise<boolean>
}) {
  const [loc, setLoc] = useState<NhanPhieu | 'Tất cả'>('Tất cả')
  const [tuKhoa, setTuKhoa] = useState('')
  const [tuNgay, setTuNgay] = useState('')
  const [denNgay, setDenNgay] = useState('')

  const tu = tuNgay.trim() ? docNgay(tuNgay) : undefined
  const den = denNgay.trim() ? docNgay(denNgay) : undefined
  const loiNgay = (tuNgay.trim() && !tu) || (denNgay.trim() && !den)

  const tim = useMemo(
    () => timPhieu(props.phieus, { tuKhoa, tuNgay: tu, denNgay: den }),
    [props.phieus, tuKhoa, tu, den],
  )
  const hienThi = useMemo(
    () =>
      tim
        .filter((p) => loc === 'Tất cả' || p.nhan === loc)
        .sort((a, b) => b.ngayNhan.localeCompare(a.ngayNhan) || b.id.localeCompare(a.id)),
    [tim, loc],
  )
  const dem = (l: NhanPhieu | 'Tất cả') => (l === 'Tất cả' ? tim.length : tim.filter((p) => p.nhan === l).length)

  return (
    <div className="man-phieu">
      <FormNhanDo khach={props.khach} onNhan={props.onNhan} />
      <section className="mds" aria-label="Danh sách phiếu">
        <h2>Danh sách phiếu</h2>
        <div className="mds-tim">
          <label>
            Tìm theo tên khách hoặc ghi chú vị trí
            <input type="search" value={tuKhoa} onChange={(e) => setTuKhoa(e.target.value)} />
          </label>
          <label>
            Nhận từ ngày (dd/mm/yyyy)
            <input value={tuNgay} onChange={(e) => setTuNgay(e.target.value)} inputMode="numeric" />
          </label>
          <label>
            Đến ngày (dd/mm/yyyy)
            <input value={denNgay} onChange={(e) => setDenNgay(e.target.value)} inputMode="numeric" />
          </label>
        </div>
        {loiNgay && (
          <p role="alert" className="loi">
            Ngày cần theo dạng dd/mm/yyyy; ô sai bị bỏ qua.
          </p>
        )}
        <nav className="loc" aria-label="Lọc phiếu">
          {LOC.map((l) => (
            <button key={l} type="button" aria-pressed={loc === l} onClick={() => setLoc(l)}>
              {l} ({dem(l)})
            </button>
          ))}
        </nav>
        {hienThi.length === 0 ? (
          <p>{props.phieus.length === 0 ? 'Chưa có phiếu nào.' : 'Không có phiếu nào khớp.'}</p>
        ) : (
          <ul className="ds">
            {hienThi.map((p) => (
              <DongPhieu key={p.id} phieu={p} hanhDong={props.hanhDong} />
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

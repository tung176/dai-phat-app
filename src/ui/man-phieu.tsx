import { useMemo, useState } from 'react'
import { CAC_LOC_PHIEU, SO_DONG_MOI_TRANG, xemDanhSachPhieu, type LocPhieu } from '../core/danh-sach-phieu.ts'
import type { DichVuKhach } from '../core/khach-service.ts'
import type { DauVaoNhanDo } from '../core/phieu-service.ts'
import type { Phieu } from '../core/types.ts'
import { docNgay } from './dinh-dang.ts'
import { DongPhieu, type HanhDongPhieu } from './dong-phieu-ui.tsx'
import { FormNhanDo } from './form-nhan-do.tsx'
import './man-danh-sach.css'

/** Màn Phiếu: nhận đồ, và MỘT danh sách duy nhất vừa xem vừa thao tác (chốt tiền, trả khách, sửa sai, đóng phiếu). */
export function ManPhieu(props: {
  phieus: Phieu[]
  khach: DichVuKhach
  hanhDong: HanhDongPhieu
  onNhan: (taoDauVao: () => Promise<DauVaoNhanDo>) => Promise<boolean>
}) {
  const [loc, setLoc] = useState<LocPhieu>('Còn việc')
  const [soDong, setSoDong] = useState(SO_DONG_MOI_TRANG)
  const [tuKhoa, setTuKhoa] = useState('')
  const [tuNgay, setTuNgay] = useState('')
  const [denNgay, setDenNgay] = useState('')

  const tu = tuNgay.trim() ? docNgay(tuNgay) : undefined
  const den = denNgay.trim() ? docNgay(denNgay) : undefined
  const loiNgay = (tuNgay.trim() && !tu) || (denNgay.trim() && !den)

  // Lọc, đếm và cắt trang trong một lượt; chỉ vẽ `soDong` dòng nên gõ tìm kiếm không phải dựng cả nghìn dòng.
  const kq = useMemo(
    () => xemDanhSachPhieu(props.phieus, { tuKhoa, tuNgay: tu, denNgay: den, loc, soDong }),
    [props.phieus, tuKhoa, tu, den, loc, soDong],
  )

  /** Đổi điều kiện tìm thì quay về trang đầu. */
  function doiTim(dat: (v: string) => void, v: string) {
    dat(v)
    setSoDong(SO_DONG_MOI_TRANG)
  }

  function doiLoc(l: LocPhieu) {
    setLoc(l)
    setSoDong(SO_DONG_MOI_TRANG)
  }

  return (
    <div className="man-phieu">
      <FormNhanDo khach={props.khach} onNhan={props.onNhan} />
      <section className="mds" aria-label="Danh sách phiếu">
        <h2>Danh sách phiếu</h2>
        <div className="mds-tim">
          <label>
            Tìm theo tên khách hoặc ghi chú vị trí
            <input type="search" value={tuKhoa} onChange={(e) => doiTim(setTuKhoa, e.target.value)} />
          </label>
          <label>
            Nhận từ ngày (dd/mm/yyyy)
            <input value={tuNgay} onChange={(e) => doiTim(setTuNgay, e.target.value)} inputMode="numeric" />
          </label>
          <label>
            Đến ngày (dd/mm/yyyy)
            <input value={denNgay} onChange={(e) => doiTim(setDenNgay, e.target.value)} inputMode="numeric" />
          </label>
        </div>
        {loiNgay && (
          <p role="alert" className="loi">
            Ngày cần theo dạng dd/mm/yyyy; ô sai bị bỏ qua.
          </p>
        )}
        <nav className="loc" aria-label="Lọc phiếu">
          {CAC_LOC_PHIEU.map((l) => (
            <button key={l} type="button" aria-pressed={loc === l} onClick={() => doiLoc(l)}>
              {l} ({kq.dem[l]})
            </button>
          ))}
        </nav>
        {kq.tong === 0 ? (
          <p>{props.phieus.length === 0 ? 'Chưa có phiếu nào.' : 'Không có phiếu nào khớp.'}</p>
        ) : (
          <ul className="ds">
            {kq.hien.map((p) => (
              <DongPhieu key={p.id} phieu={p} hanhDong={props.hanhDong} />
            ))}
          </ul>
        )}
        {kq.conLai > 0 && (
          <button type="button" className="xem-them" onClick={() => setSoDong(soDong + SO_DONG_MOI_TRANG)}>
            Xem thêm {Math.min(SO_DONG_MOI_TRANG, kq.conLai)} phiếu (còn {kq.conLai})
          </button>
        )}
      </section>
    </div>
  )
}

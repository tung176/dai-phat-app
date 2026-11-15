import { useMemo, useState } from 'react'
import {
  baDanhSach,
  doChuaLay,
  docNguong,
  timPhieu,
  type NguongCanhBao,
} from '../core/danh-sach-phieu.ts'
import type { Phieu } from '../core/types.ts'
import { docNgay, hienNgay, hienTien } from './dinh-dang.ts'
import './man-danh-sach.css'

const KHOA_NGUONG = 'giat-la.nguong-canh-bao'
type Tab = 'choTinhTien' | 'choTraKhach' | 'daTra' | 'doChuaLay'
const TEN_TAB: Array<[Tab, string]> = [
  ['choTinhTien', 'Chờ tính tiền'],
  ['choTraKhach', 'Chờ trả khách'],
  ['daTra', 'Đã trả'],
  ['doChuaLay', 'Đồ chưa lấy'],
]

function docNguongDaLuu(): NguongCanhBao {
  try {
    return docNguong(localStorage.getItem(KHOA_NGUONG))
  } catch {
    return docNguong(null)
  }
}

function luuNguong(n: NguongCanhBao): void {
  try {
    localStorage.setItem(KHOA_NGUONG, JSON.stringify(n))
  } catch {
    // không lưu được thì thôi, vẫn dùng trong phiên này
  }
}

/** Ba danh sách, màn "Đồ chưa lấy" và ô tìm phiếu. `homNay` dạng ISO, truyền vào để dễ kiểm thử. */
export default function ManDanhSach(props: { phieus: Phieu[]; homNay: string }) {
  const [tab, setTab] = useState<Tab>('doChuaLay')
  const [tuKhoa, setTuKhoa] = useState('')
  const [tuNgay, setTuNgay] = useState('')
  const [denNgay, setDenNgay] = useState('')
  const [nguong, setNguong] = useState<NguongCanhBao>(docNguongDaLuu)

  const tu = tuNgay.trim() ? docNgay(tuNgay) : undefined
  const den = denNgay.trim() ? docNgay(denNgay) : undefined
  const loiNgay = (tuNgay.trim() && !tu) || (denNgay.trim() && !den)

  const tim = useMemo(
    () => timPhieu(props.phieus, { tuKhoa, tuNgay: tu, denNgay: den }),
    [props.phieus, tuKhoa, tu, den],
  )
  const ba = useMemo(() => baDanhSach(tim), [tim])
  const chuaLay = useMemo(() => doChuaLay(tim, props.homNay, nguong), [tim, props.homNay, nguong])

  function doiNguong(khoa: keyof NguongCanhBao, v: string) {
    const so = Number(v)
    if (v.trim() === '' || !Number.isInteger(so) || so < 0) return
    const moi = { ...nguong, [khoa]: so }
    setNguong(moi)
    luuNguong(moi)
  }

  const dem = (t: Tab) => (t === 'doChuaLay' ? chuaLay.length : ba[t].length)

  return (
    <section className="mds" aria-label="Danh sách và đồ chưa lấy">
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
      <nav className="mds-tab" aria-label="Chọn danh sách">
        {TEN_TAB.map(([t, ten]) => (
          <button key={t} type="button" aria-pressed={tab === t} onClick={() => setTab(t)}>
            {ten} ({dem(t)})
          </button>
        ))}
      </nav>
      {tab === 'doChuaLay' ? (
        <>
          <div className="mds-nguong">
            <label>
              Cảnh báo chưa tính tiền quá (ngày)
              <input
                type="number"
                min={0}
                step={1}
                value={nguong.chuaTinhTien}
                onChange={(e) => doiNguong('chuaTinhTien', e.target.value)}
              />
            </label>
            <label>
              Cảnh báo chưa trả khách quá (ngày)
              <input
                type="number"
                min={0}
                step={1}
                value={nguong.chuaTraKhach}
                onChange={(e) => doiNguong('chuaTraKhach', e.target.value)}
              />
            </label>
          </div>
          {chuaLay.length === 0 ? (
            <p>Không có đồ nào còn ở tiệm.</p>
          ) : (
            <ul className="mds-ds">
              {chuaLay.map(({ phieu: p, soNgay, quaNguong }) => (
                <li key={p.id} className={quaNguong ? 'qua-nguong' : undefined}>
                  <div className="dau">
                    <strong>{p.khach.ten}</strong>
                    <span className="nhan">{p.nhan}</span>
                  </div>
                  <div className="mds-ngay">
                    {soNgay} ngày{quaNguong ? ' - quá hạn' : ''}
                  </div>
                  <div className="phu">
                    Nhận {hienNgay(p.ngayNhan)} · {p.moTa}
                    {p.ghiChu ? ` (${p.ghiChu})` : ''}
                    {p.tongTien !== undefined && ` · ${hienTien(p.tongTien)}`}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : ba[tab].length === 0 ? (
        <p>Không có phiếu nào.</p>
      ) : (
        <ul className="mds-ds">
          {[...ba[tab]]
            .sort((a, b) => b.ngayNhan.localeCompare(a.ngayNhan) || b.id.localeCompare(a.id))
            .map((p) => (
              <li key={p.id}>
                <div className="dau">
                  <strong>{p.khach.ten}</strong>
                  <span className="nhan">{p.nhan}</span>
                </div>
                <div className="phu">
                  Nhận {hienNgay(p.ngayNhan)} · {p.moTa}
                  {p.ghiChu ? ` (${p.ghiChu})` : ''}
                  {p.tongTien !== undefined && ` · ${hienTien(p.tongTien)}`}
                  {p.ngayTra && ` · Trả ${hienNgay(p.ngayTra)}`}
                </div>
              </li>
            ))}
        </ul>
      )}
    </section>
  )
}

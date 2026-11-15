import { useEffect, useState, type FormEvent } from 'react'
import type { Khach } from '../core/khach.ts'
import type { DichVuKhach } from '../core/khach-service.ts'
import type { DauVaoNhanDo } from '../core/phieu-service.ts'
import { docNgay, hienNgay, homNayIso } from './dinh-dang.ts'

const TOI_DA_HIEN = 8

function motaKhach(k: Khach): string {
  return k.soDienThoai ? `${k.tenHienThi} · ${k.soDienThoai}` : k.tenHienThi
}

/**
 * Nhận đồ: chọn khách có sẵn (tìm theo tên, ghi chú vị trí, số điện thoại) hoặc thêm khách mới ngay tại chỗ.
 * Tên gần giống khách đã có chỉ hiện làm gợi ý, không bao giờ tự gán.
 * `onNhan` nhận hàm tạo đầu vào: khách mới chỉ được tạo khi bấm Nhận đồ và dữ liệu hợp lệ.
 */
export function FormNhanDo(props: {
  khach: DichVuKhach
  onNhan: (taoDauVao: () => Promise<DauVaoNhanDo>) => Promise<boolean>
}) {
  const { khach } = props
  const [chon, setChon] = useState<Khach>()
  const [tuKhoa, setTuKhoa] = useState('')
  const [ketQua, setKetQua] = useState<Khach[]>([])
  const [khachMoi, setKhachMoi] = useState(false)
  const [tenMoi, setTenMoi] = useState('')
  const [viTriMoi, setViTriMoi] = useState('')
  const [sdtMoi, setSdtMoi] = useState('')
  const [goiY, setGoiY] = useState<Khach[]>([])
  const [ngay, setNgay] = useState(hienNgay(homNayIso()))
  const [moTa, setMoTa] = useState('')
  const [ghiChu, setGhiChu] = useState('')
  const [loiForm, setLoiForm] = useState('')
  const [lan, setLan] = useState(0)
  const dangTim = tuKhoa.trim() !== '' && !chon && !khachMoi
  const ketQuaHien = dangTim ? ketQua : []
  const goiYHien = khachMoi && tenMoi.trim() !== '' ? goiY : []

  useEffect(() => {
    let huy = false
    if (tuKhoa.trim() === '' || chon || khachMoi) return
    void khach.tim(tuKhoa).then((ds) => {
      if (!huy) setKetQua(ds)
    })
    return () => {
      huy = true
    }
  }, [khach, tuKhoa, chon, khachMoi, lan])

  useEffect(() => {
    let huy = false
    if (!khachMoi || tenMoi.trim() === '') return
    void khach.goiYKhop(tenMoi).then((ds) => {
      if (!huy) setGoiY(ds)
    })
    return () => {
      huy = true
    }
  }, [khach, khachMoi, tenMoi, lan])

  function moFormKhachMoi() {
    setKhachMoi(true)
    // Gõ chữ vào ô tìm mà không thấy ai thì dùng luôn làm tên khách mới; gõ số thì là số điện thoại.
    const q = tuKhoa.trim()
    if (/^[\d\s.-]+$/.test(q)) setSdtMoi(q)
    else setTenMoi(q)
  }

  function dungKhach(k: Khach) {
    setChon(k)
    setKhachMoi(false)
    setLoiForm('')
  }

  function boChon() {
    setChon(undefined)
    setTuKhoa('')
  }

  async function gui(e: FormEvent) {
    e.preventDefault()
    const iso = docNgay(ngay)
    if (!iso) {
      setLoiForm('Ngày nhận cần theo dạng dd/mm/yyyy.')
      return
    }
    if (!chon && !(khachMoi && tenMoi.trim() !== '')) {
      setLoiForm('Chọn khách có sẵn hoặc thêm khách mới.')
      return
    }
    setLoiForm('')
    const ok = await props.onNhan(async () => {
      const chung = { ngayNhan: iso, moTa, ...(ghiChu.trim() ? { ghiChu } : {}) }
      if (chon) return { ...chung, khachId: chon.id }
      const moi = await khach.them({
        ten: tenMoi,
        viTri: viTriMoi,
        soDienThoai: sdtMoi.trim() || undefined,
        nguon: 'tu-phieu',
      })
      return { ...chung, khachId: moi.id }
    })
    if (ok) {
      setChon(undefined)
      setTuKhoa('')
      setKhachMoi(false)
      setTenMoi('')
      setViTriMoi('')
      setSdtMoi('')
      setMoTa('')
      setGhiChu('')
      setLan((n) => n + 1)
    }
  }

  return (
    <form onSubmit={(e) => void gui(e)} className="form form-nhan-do" aria-label="Nhận đồ">
      <h2>Nhận đồ</h2>

      <fieldset className="chon-khach">
        <legend>Khách</legend>
        {chon ? (
          <div className="khach-da-chon">
            <span>
              <strong>{chon.tenHienThi}</strong>
              {chon.soDienThoai ? ` · ${chon.soDienThoai}` : ''}
            </span>
            <button type="button" className="phu-nut" onClick={boChon}>
              Đổi khách
            </button>
          </div>
        ) : khachMoi ? (
          <div className="khach-moi">
            <label>
              Tên khách mới
              <input value={tenMoi} onChange={(e) => setTenMoi(e.target.value)} required />
            </label>
            <label>
              Ghi chú vị trí (tầng 2, B5...)
              <input value={viTriMoi} onChange={(e) => setViTriMoi(e.target.value)} />
            </label>
            <label>
              Số điện thoại (không bắt buộc)
              <input value={sdtMoi} onChange={(e) => setSdtMoi(e.target.value)} inputMode="tel" />
            </label>
            {goiYHien.length > 0 && (
              <div className="goi-y" role="group" aria-label="Khách có tên gần giống">
                <p className="phu">Đã có khách tên gần giống. Nếu cùng một người thì bấm chọn, đừng tạo thêm:</p>
                {goiYHien.map((k) => (
                  <button key={k.id} type="button" className="phu-nut" onClick={() => dungKhach(k)}>
                    Dùng {motaKhach(k)}
                  </button>
                ))}
              </div>
            )}
            <button type="button" className="phu-nut" onClick={() => setKhachMoi(false)}>
              Quay lại tìm khách có sẵn
            </button>
          </div>
        ) : (
          <div className="khach-tim">
            <label>
              Tìm khách có sẵn (tên, ghi chú vị trí hoặc số điện thoại)
              <input
                type="search"
                value={tuKhoa}
                onChange={(e) => setTuKhoa(e.target.value)}
                autoComplete="off"
              />
            </label>
            {ketQuaHien.length > 0 && (
              <ul className="khach-ket-qua" aria-label="Khách tìm thấy">
                {ketQuaHien.slice(0, TOI_DA_HIEN).map((k) => (
                  <li key={k.id}>
                    <button type="button" className="phu-nut" onClick={() => dungKhach(k)}>
                      {motaKhach(k)}
                    </button>
                  </li>
                ))}
                {ketQuaHien.length > TOI_DA_HIEN && (
                  <li className="phu">Còn {ketQuaHien.length - TOI_DA_HIEN} khách nữa, gõ thêm để lọc.</li>
                )}
              </ul>
            )}
            {dangTim && ketQuaHien.length === 0 && <p className="phu">Không thấy khách nào khớp.</p>}
            <button type="button" className="phu-nut" onClick={moFormKhachMoi}>
              + Thêm khách mới
            </button>
          </div>
        )}
      </fieldset>

      <label>
        Ngày nhận (dd/mm/yyyy)
        <input value={ngay} onChange={(e) => setNgay(e.target.value)} inputMode="numeric" required />
      </label>
      <label>
        Mô tả đồ
        <input value={moTa} onChange={(e) => setMoTa(e.target.value)} placeholder="1 túi quần áo" required />
      </label>
      <label>
        Ghi chú phiếu
        <input value={ghiChu} onChange={(e) => setGhiChu(e.target.value)} placeholder="giặt riêng, gấp sẵn..." />
      </label>
      {loiForm && (
        <p role="alert" className="loi">
          {loiForm}
        </p>
      )}
      <button type="submit">Nhận đồ</button>
    </form>
  )
}

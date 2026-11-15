import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import type { DauVaoNhanDo, DichVuPhieu } from '../core/phieu-service.ts'
import { LoiNghiepVu, type NhanPhieu, type Phieu, type PhuongThuc } from '../core/types.ts'
import { taoDichVuMau, type HeThongDichVu } from './dich-vu.ts'
import { ManHinhKhach } from './khach-ui.tsx'
import { docNgay, hienNgay, hienTien, homNayIso } from './dinh-dang.ts'

const LOC: Array<NhanPhieu | 'Tất cả'> = ['Tất cả', 'Chưa tính tiền', 'Chờ trả khách', 'Đã trả']
const TEN_PHUONG_THUC: Record<PhuongThuc, string> = {
  'tien-mat': 'Tiền mặt',
  'chuyen-khoan': 'Chuyển khoản',
}

function thongBaoLoi(e: unknown): string {
  return e instanceof LoiNghiepVu ? e.message : 'Có lỗi xảy ra, thử lại.'
}

export default function App() {
  const [he, setHe] = useState<HeThongDichVu>()
  const dv: DichVuPhieu | undefined = he?.phieu
  const [man, setMan] = useState<'phieu' | 'khach'>('phieu')
  const [ds, setDs] = useState<Phieu[]>([])
  const [loc, setLoc] = useState<NhanPhieu | 'Tất cả'>('Tất cả')
  const [loi, setLoi] = useState('')

  useEffect(() => {
    void taoDichVuMau().then(async (h) => {
      setHe(h)
      setDs(await h.phieu.danhSach())
    })
  }, [])

  const chayThaoTac = useCallback(
    async (viec: () => Promise<unknown>): Promise<boolean> => {
      try {
        await viec()
        setLoi('')
        if (dv) setDs(await dv.danhSach())
        return true
      } catch (e) {
        setLoi(thongBaoLoi(e))
        return false
      }
    },
    [dv],
  )

  const hienThi = useMemo(
    () =>
      ds
        .filter((p) => loc === 'Tất cả' || p.nhan === loc)
        .sort((a, b) => b.ngayNhan.localeCompare(a.ngayNhan) || b.id.localeCompare(a.id)),
    [ds, loc],
  )

  if (!he || !dv) return <p className="trang">Đang tải...</p>

  return (
    <main className="trang">
      <h1>Đại Phát - Phiếu giặt là</h1>
      <nav className="loc" aria-label="Màn hình">
        <button type="button" aria-pressed={man === 'phieu'} onClick={() => setMan('phieu')}>
          Phiếu
        </button>
        <button type="button" aria-pressed={man === 'khach'} onClick={() => setMan('khach')}>
          Khách
        </button>
      </nav>
      {man === 'khach' && (
        <ManHinhKhach khach={he.khach} onDoi={() => void dv.danhSach().then(setDs)} />
      )}
      {man === 'phieu' && loi && (
        <p role="alert" className="loi">
          {loi}
        </p>
      )}
      {man === 'phieu' && <FormNhanDo onNhan={(d) => chayThaoTac(() => dv.nhanDo(d))} />}
      {man === 'phieu' && (
      <nav className="loc" aria-label="Lọc phiếu">
        {LOC.map((l) => (
          <button key={l} type="button" aria-pressed={loc === l} onClick={() => setLoc(l)}>
            {l}
          </button>
        ))}
      </nav>
      )}
      {man !== 'phieu' ? null : hienThi.length === 0 ? (
        <p>Chưa có phiếu nào.</p>
      ) : (
        <ul className="ds">
          {hienThi.map((p) => (
            <DongPhieu
              key={p.id}
              phieu={p}
              onChot={(tien) => chayThaoTac(() => dv.chotTien(p.id, tien))}
              onTra={(ngay, pt) =>
                chayThaoTac(() => dv.traKhach(p.id, { ngayTra: ngay, phuongThuc: pt }))
              }
            />
          ))}
        </ul>
      )}
    </main>
  )
}

function FormNhanDo(props: { onNhan: (d: DauVaoNhanDo) => Promise<boolean> }) {
  const [ten, setTen] = useState('')
  const [ngay, setNgay] = useState(hienNgay(homNayIso()))
  const [moTa, setMoTa] = useState('')
  const [ghiChu, setGhiChu] = useState('')
  const [sdt, setSdt] = useState('')
  const [loiNgay, setLoiNgay] = useState('')

  async function gui(e: FormEvent) {
    e.preventDefault()
    const iso = docNgay(ngay)
    if (!iso) {
      setLoiNgay('Ngày nhận cần theo dạng dd/mm/yyyy.')
      return
    }
    setLoiNgay('')
    const ok = await props.onNhan({
      tenKhach: ten,
      ngayNhan: iso,
      moTa,
      ghiChu: ghiChu || undefined,
      soDienThoai: sdt || undefined,
    })
    if (ok) {
      setTen('')
      setMoTa('')
      setGhiChu('')
      setSdt('')
    }
  }

  return (
    <form onSubmit={(e) => void gui(e)} className="form" aria-label="Nhận đồ">
      <h2>Nhận đồ</h2>
      <label>
        Tên khách
        <input value={ten} onChange={(e) => setTen(e.target.value)} required />
      </label>
      <label>
        Ngày nhận (dd/mm/yyyy)
        <input value={ngay} onChange={(e) => setNgay(e.target.value)} inputMode="numeric" required />
      </label>
      {loiNgay && (
        <p role="alert" className="loi">
          {loiNgay}
        </p>
      )}
      <label>
        Mô tả đồ
        <input value={moTa} onChange={(e) => setMoTa(e.target.value)} placeholder="1 túi quần áo" required />
      </label>
      <label>
        Ghi chú
        <input value={ghiChu} onChange={(e) => setGhiChu(e.target.value)} placeholder="tầng 2, B5..." />
      </label>
      <label>
        Số điện thoại (không bắt buộc)
        <input value={sdt} onChange={(e) => setSdt(e.target.value)} inputMode="tel" />
      </label>
      <button type="submit">Nhận đồ</button>
    </form>
  )
}

function DongPhieu(props: {
  phieu: Phieu
  onChot: (tien: number) => Promise<boolean>
  onTra: (ngay: string, pt: PhuongThuc) => Promise<boolean>
}) {
  const { phieu: p } = props
  const [tien, setTien] = useState('')
  const [ngayTra, setNgayTra] = useState(hienNgay(homNayIso()))
  const [pt, setPt] = useState<PhuongThuc>('tien-mat')
  const [loiNgay, setLoiNgay] = useState('')

  return (
    <li className={`phieu nhan-${p.trangThai}`}>
      <div className="dau">
        <strong>{p.khach.tenHienThi}</strong>
        <span className="nhan">{p.nhan}</span>
      </div>
      <div>
        {p.moTa}
        {p.ghiChu ? ` (${p.ghiChu})` : ''}
      </div>
      <div className="phu">
        Nhận {hienNgay(p.ngayNhan)}
        {p.tongTien !== undefined && ` · ${hienTien(p.tongTien)}`}
        {p.ngayTra && p.phuongThuc && ` · Trả ${hienNgay(p.ngayTra)} (${TEN_PHUONG_THUC[p.phuongThuc]})`}
      </div>
      {p.nhan === 'Chưa tính tiền' && (
        <form
          className="hang"
          onSubmit={(e) => {
            e.preventDefault()
            void props.onChot(Number(tien.replace(/[.\s]/g, ''))).then((ok) => {
              if (ok) setTien('')
            })
          }}
        >
          <input
            aria-label={`Tổng tiền ${p.khach.ten}`}
            value={tien}
            onChange={(e) => setTien(e.target.value)}
            inputMode="numeric"
            placeholder="Tổng tiền (đ)"
          />
          <button type="submit">Chốt tiền</button>
        </form>
      )}
      {p.nhan === 'Chờ trả khách' && (
        <form
          className="hang"
          onSubmit={(e) => {
            e.preventDefault()
            const iso = docNgay(ngayTra)
            if (!iso) {
              setLoiNgay('Ngày trả cần theo dạng dd/mm/yyyy.')
              return
            }
            setLoiNgay('')
            void props.onTra(iso, pt)
          }}
        >
          <input
            aria-label={`Ngày trả ${p.khach.ten}`}
            value={ngayTra}
            onChange={(e) => setNgayTra(e.target.value)}
            inputMode="numeric"
          />
          <select
            aria-label={`Phương thức ${p.khach.ten}`}
            value={pt}
            onChange={(e) => setPt(e.target.value as PhuongThuc)}
          >
            <option value="tien-mat">Tiền mặt</option>
            <option value="chuyen-khoan">Chuyển khoản</option>
          </select>
          <button type="submit">Trả khách</button>
          {loiNgay && (
            <span role="alert" className="loi">
              {loiNgay}
            </span>
          )}
        </form>
      )}
    </li>
  )
}

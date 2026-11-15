import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import type { DauVaoNhanDo, DichVuPhieu } from '../core/phieu-service.ts'
import { LoiNghiepVu, type NhanPhieu, type Phieu, type PhuongThuc } from '../core/types.ts'
import { taoDichVuThat, type HeThongDichVu, type KetNoiSheets } from './dich-vu.ts'
import { ChiBaoDongBo, ManCaiDat } from './cai-dat.tsx'
import { useTrangThaiDongBo } from './dung-trang-thai-dong-bo.ts'
import type { DichVu } from '../core/bang-gia.ts'
import type { ChiTietTien } from '../core/tinh-tien.ts'
import FormChotTien from './FormChotTien.tsx'
import { ManHinhKhach } from './khach-ui.tsx'
import { BangSuaSai, ManCaiDatSuaSai, ManXemLai } from './sua-sai-ui.tsx'
import { CAI_DAT_MAC_DINH, type CongTacChucNang } from '../core/nhat-ky-phieu.ts'
import type { DichVuSuaSai } from '../core/sua-sai-service.ts'
import { docNgay, hienNgay, hienTien, homNayIso } from './dinh-dang.ts'
import ManDanhSach from './ManDanhSach.tsx'
import { useBangGia } from './bang-gia-dung.ts'
import { ManNhapLichSu } from './nhap-lich-su-ui.tsx'

const LOC: Array<NhanPhieu | 'Tất cả'> = ['Tất cả', 'Chưa tính tiền', 'Chờ trả khách', 'Đã trả', 'Đã hủy']
const TEN_PHUONG_THUC: Record<PhuongThuc, string> = {
  'tien-mat': 'Tiền mặt',
  'chuyen-khoan': 'Chuyển khoản',
}

function thongBaoLoi(e: unknown): string {
  return e instanceof LoiNghiepVu ? e.message : 'Có lỗi xảy ra, thử lại.'
}

export default function App() {
  const [kn] = useState<KetNoiSheets>(taoDichVuThat)
  const he = kn.he
  const bangGia = useBangGia(kn)
  const dv: DichVuPhieu = he.phieu
  const [moCaiDat, setMoCaiDat] = useState(false)
  const [man, setMan] = useState<'phieu' | 'khach' | 'xem-lai' | 'cai-dat' | 'nhap-lich-su'>('phieu')
  const [ds, setDs] = useState<Phieu[]>([])
  const [loc, setLoc] = useState<NhanPhieu | 'Tất cả'>('Tất cả')
  const [loi, setLoi] = useState('')
  const [chuaXem, setChuaXem] = useState(0)
  const [congTac, setCongTac] = useState<CongTacChucNang>(CAI_DAT_MAC_DINH.congTac)

  const lamMoiGiamSat = useCallback(
    (h: HeThongDichVu) =>
      Promise.all([
        h.suaSai.soChuaXem().then(setChuaXem),
        h.suaSai.caiDat().then((c) => setCongTac(c.congTac)),
      ]).then(() => undefined),
    [],
  )

  useEffect(() => {
    void dv.danhSach().then(setDs)
    void lamMoiGiamSat(he)
  }, [dv, he, lamMoiGiamSat])

  // Kho báo có thay đổi (đồng bộ kéo bản mới về...): đọc lại danh sách từ bản đệm.
  const docLai = useCallback(() => {
    void dv.danhSach().then(setDs)
    void lamMoiGiamSat(he)
  }, [dv, he, lamMoiGiamSat])
  const trangThaiDongBo = useTrangThaiDongBo(kn, docLai)

  const chayThaoTac = useCallback(
    async (viec: () => Promise<unknown>): Promise<boolean> => {
      try {
        await viec()
        setLoi('')
        setDs(await he.phieu.danhSach())
        await lamMoiGiamSat(he)
        return true
      } catch (e) {
        setLoi(thongBaoLoi(e))
        return false
      }
    },
    [he, lamMoiGiamSat],
  )

  const hienThi = useMemo(
    () =>
      ds
        .filter((p) => loc === 'Tất cả' || p.nhan === loc)
        .sort((a, b) => b.ngayNhan.localeCompare(a.ngayNhan) || b.id.localeCompare(a.id)),
    [ds, loc],
  )

  return (
    <main className="trang">
      <h1>Đại Phát - Phiếu giặt là</h1>
      <ChiBaoDongBo trangThai={trangThaiDongBo} onMoCaiDat={() => setMoCaiDat((m) => !m)} />
      {moCaiDat && <ManCaiDat ketNoi={kn} onDong={() => setMoCaiDat(false)} />}
      <nav className="loc" aria-label="Màn hình">
        <button type="button" aria-pressed={man === 'phieu'} onClick={() => setMan('phieu')}>
          Phiếu
        </button>
        <button type="button" aria-pressed={man === 'khach'} onClick={() => setMan('khach')}>
          Khách
        </button>
        <button type="button" aria-pressed={man === 'xem-lai'} onClick={() => setMan('xem-lai')}>
          Xem lại thay đổi
          {chuaXem > 0 && (
            <span className="so-chua-xem" aria-label={`${chuaXem} mục chưa xem`}>
              {chuaXem}
            </span>
          )}
        </button>
        <button type="button" aria-pressed={man === 'cai-dat'} onClick={() => setMan('cai-dat')}>
          Cài đặt
        </button>
        <button type="button" aria-pressed={man === 'nhap-lich-su'} onClick={() => setMan('nhap-lich-su')}>
          Nhập lịch sử
        </button>
      </nav>
      {man === 'khach' && (
        <ManHinhKhach khach={he.khach} onDoi={() => void dv.danhSach().then(setDs)} />
      )}
      {man === 'xem-lai' && <ManXemLai suaSai={he.suaSai} onDoi={() => void lamMoiGiamSat(he)} />}
      {man === 'cai-dat' && <ManCaiDatSuaSai suaSai={he.suaSai} onDoi={() => void lamMoiGiamSat(he)} />}
      {man === 'nhap-lich-su' && (
        <ManNhapLichSu nhapLichSu={he.nhapLichSu} bangGia={bangGia} onDoi={() => void dv.danhSach().then(setDs)} />
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
              suaSai={he.suaSai}
              congTac={congTac}
              bangGia={bangGia}
              chay={chayThaoTac}
              onChot={(tien, chiTiet) => chayThaoTac(() => dv.chotTien(p.id, tien, chiTiet))}
              onTra={(ngay, pt) =>
                chayThaoTac(() => dv.traKhach(p.id, { ngayTra: ngay, phuongThuc: pt }))
              }
            />
          ))}
        </ul>
      )}
      {man === 'phieu' && (
        <ManDanhSach
          phieus={ds}
          homNay={homNayIso()}
          onDongPhieu={(id, lyDo) => chayThaoTac(() => he.suaSai.huy(id, lyDo))}
        />
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
  suaSai: DichVuSuaSai
  congTac: CongTacChucNang
  bangGia: DichVu[]
  chay: (viec: () => Promise<unknown>) => Promise<boolean>
  onChot: (tien: number, chiTiet?: ChiTietTien) => Promise<boolean>
  onTra: (ngay: string, pt: PhuongThuc) => Promise<boolean>
}) {
  const { phieu: p } = props
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
      {(p.thayTheCho || p.thayTheBoi) && (
        <div className="phu">
          {p.thayTheCho && `Thay thế phiếu ${p.thayTheCho}. `}
          {p.thayTheBoi && `Đã được thay bằng phiếu ${p.thayTheBoi}.`}
        </div>
      )}
      <BangSuaSai phieu={p} suaSai={props.suaSai} congTac={props.congTac} chay={props.chay} />
      {p.nhan === 'Chưa tính tiền' && (
        <FormChotTien tenKhach={p.khach.ten} bangGia={props.bangGia} onChot={props.onChot} />
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

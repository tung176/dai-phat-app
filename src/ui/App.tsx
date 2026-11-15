import { useCallback, useEffect, useMemo, useState } from 'react'
import { LoiNghiepVu, type Phieu } from '../core/types.ts'
import { taoDichVuThat, type HeThongDichVu, type KetNoiSheets } from './dich-vu.ts'
import { ChiBaoDongBo, ManCaiDat } from './cai-dat.tsx'
import { useTrangThaiDongBo } from './dung-trang-thai-dong-bo.ts'
import { ManHinhKhach } from './khach-ui.tsx'
import { ManCaiDatSuaSai, ManXemLai } from './sua-sai-ui.tsx'
import { CAI_DAT_MAC_DINH, type CongTacChucNang } from '../core/nhat-ky-phieu.ts'
import { homNayIso } from './dinh-dang.ts'
import { ManNhomKhach } from './nhom-khach-ui.tsx'
import { taoLuuNguongNhom } from '../core/nhom-khach-cai-dat.ts'
import { ManNhapLo } from './nhap-lo-ui.tsx'
import ManBaoCao from './ManBaoCao.tsx'
import { useBangGia } from './bang-gia-dung.ts'
import { ManNhapLichSu } from './nhap-lich-su-ui.tsx'
import { ManPhieu } from './man-phieu.tsx'
import { ManDoChuaLay } from './man-do-chua-lay.tsx'
import { ManBangGia } from './man-bang-gia.tsx'
import type { HanhDongPhieu } from './dong-phieu-ui.tsx'
import './khung.css'

type Man =
  | 'phieu'
  | 'do-chua-lay'
  | 'khach'
  | 'bao-cao'
  | 'nhap-lo'
  | 'nhap-lich-su'
  | 'nhom-khach'
  | 'xem-lai'
  | 'bang-gia'
  | 'cai-dat'

/** Việc hằng ngày của chủ tiệm. */
const MAN_HANG_NGAY: Array<[Man, string]> = [
  ['phieu', 'Phiếu'],
  ['do-chua-lay', 'Đồ chưa lấy'],
  ['khach', 'Khách'],
  ['bao-cao', 'Báo cáo'],
]
/** Việc ít dùng hơn. */
const MAN_IT_DUNG: Array<[Man, string]> = [
  ['nhap-lo', 'Nhập lô từ sổ'],
  ['nhap-lich-su', 'Nhập lịch sử'],
  ['nhom-khach', 'Nhóm khách'],
  ['xem-lai', 'Xem lại thay đổi'],
  ['bang-gia', 'Bảng giá'],
  ['cai-dat', 'Cài đặt'],
]

function thongBaoLoi(e: unknown): string {
  return e instanceof LoiNghiepVu ? e.message : 'Có lỗi xảy ra, thử lại.'
}

export default function App() {
  const [kn] = useState<KetNoiSheets>(taoDichVuThat)
  const he = kn.he
  const bangGia = useBangGia(kn)
  const dv = he.phieu
  const [luuNguongNhom] = useState(() => taoLuuNguongNhom(localStorage))
  const [man, setMan] = useState<Man>('phieu')
  const [moItDung, setMoItDung] = useState(false)
  const [ds, setDs] = useState<Phieu[]>([])
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

  const hanhDong: HanhDongPhieu = {
    suaSai: he.suaSai,
    congTac,
    bangGia,
    chay: chayThaoTac,
    onChot: (id, tien, chiTiet) => chayThaoTac(() => dv.chotTien(id, tien, chiTiet)),
    onTra: (id, ngay, pt) => chayThaoTac(() => dv.traKhach(id, { ngayTra: ngay, phuongThuc: pt })),
    onDong: (id, lyDo) => chayThaoTac(() => he.suaSai.huy(id, lyDo)),
  }

  const soDoChuaLay = useMemo(
    () => ds.filter((p) => p.nhan === 'Chưa tính tiền' || p.nhan === 'Chờ trả khách').length,
    [ds],
  )
  const doiDs = () => void dv.danhSach().then(setDs)
  const doiGiamSat = () => void lamMoiGiamSat(he)

  function nutMan([m, ten]: [Man, string]) {
    const dem = m === 'do-chua-lay' ? soDoChuaLay : m === 'xem-lai' ? chuaXem : 0
    return (
      <button
        key={m}
        type="button"
        aria-pressed={man === m}
        aria-current={man === m ? 'page' : undefined}
        onClick={() => {
          setMan(m)
          setLoi('')
        }}
      >
        {ten}
        {dem > 0 && (
          <span className={m === 'xem-lai' ? 'so-chua-xem' : 'so-dem'} aria-label={`${dem} mục`}>
            {dem}
          </span>
        )}
      </button>
    )
  }

  const itDungDangMo = moItDung || MAN_IT_DUNG.some(([m]) => m === man)

  return (
    <div className="khung">
      <header className="khung-dau">
        <h1>Đại Phát - Giặt là</h1>
        <ChiBaoDongBo trangThai={trangThaiDongBo} onMoCaiDat={() => setMan('cai-dat')} />
      </header>
      <nav className="khung-nav" aria-label="Màn hình">
        <div className="khung-nhom" role="group" aria-label="Việc hằng ngày">
          <h2 className="khung-nhom-tieu">Hằng ngày</h2>
          <div className="khung-nut">{MAN_HANG_NGAY.map(nutMan)}</div>
        </div>
        <div className="khung-nhom" role="group" aria-label="Việc ít dùng" data-mo={itDungDangMo}>
          <button
            type="button"
            className="khung-nhom-tieu khung-gap"
            aria-expanded={itDungDangMo}
            onClick={() => setMoItDung(!itDungDangMo)}
          >
            Việc ít dùng {itDungDangMo ? '▴' : '▾'}
            {!itDungDangMo && chuaXem > 0 && <span className="so-chua-xem">{chuaXem}</span>}
          </button>
          <div className="khung-nut khung-it-dung">{MAN_IT_DUNG.map(nutMan)}</div>
        </div>
      </nav>
      <main className="khung-noi-dung">
        {(man === 'phieu' || man === 'do-chua-lay') && loi && (
          <p role="alert" className="loi">
            {loi}
          </p>
        )}
        {man === 'phieu' && (
          <ManPhieu
            phieus={ds}
            khach={he.khach}
            hanhDong={hanhDong}
            onNhan={(tao) => chayThaoTac(async () => dv.nhanDo(await tao()))}
          />
        )}
        {man === 'do-chua-lay' && <ManDoChuaLay phieus={ds} homNay={homNayIso()} hanhDong={hanhDong} />}
        {man === 'khach' && <ManHinhKhach khach={he.khach} onDoi={doiDs} />}
        {man === 'bao-cao' && <ManBaoCao phieus={ds} homNay={homNayIso()} />}
        {man === 'nhap-lo' && <ManNhapLo nhapLo={he.nhapLo} onDoi={docLai} />}
        {man === 'nhap-lich-su' && <ManNhapLichSu nhapLichSu={he.nhapLichSu} bangGia={bangGia} onDoi={doiDs} />}
        {man === 'nhom-khach' && (
          <ManNhomKhach nhomKhach={he.nhomKhach} luuNguong={luuNguongNhom} homNay={homNayIso()} />
        )}
        {man === 'xem-lai' && <ManXemLai suaSai={he.suaSai} onDoi={doiGiamSat} />}
        {man === 'bang-gia' && (
          <ManBangGia
            bangGia={he.bangGia}
            dongBoNgay={() => kn.dongBo.dongBo()}
            daCaiDongBo={kn.luu.doc() !== null}
          />
        )}
        {man === 'cai-dat' && (
          <>
            <ManCaiDat ketNoi={kn} />
            <ManCaiDatSuaSai suaSai={he.suaSai} onDoi={doiGiamSat} />
          </>
        )}
      </main>
    </div>
  )
}

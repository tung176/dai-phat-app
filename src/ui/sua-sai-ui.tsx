import { useEffect, useState, type FormEvent } from 'react'
import type { CaiDatPhieu, CongTacChucNang, NhatKyPhieu } from '../core/nhat-ky-phieu.ts'
import type { DichVuSuaSai, XemLaiTuan } from '../core/sua-sai-service.ts'
import { LoiNghiepVu, type Phieu, type PhuongThuc } from '../core/types.ts'
import { docNgay, hienNgay, homNayIso } from './dinh-dang.ts'
import './sua-sai.css'

function thongBaoLoi(e: unknown): string {
  return e instanceof LoiNghiepVu ? e.message : 'Có lỗi xảy ra, thử lại.'
}

const TEN_PHUONG_THUC: Record<PhuongThuc, string> = { 'tien-mat': 'Tiền mặt', 'chuyen-khoan': 'Chuyển khoản' }

/** Ô nhập lý do + nút xác nhận: dùng cho mọi thao tác sửa sai (lý do bắt buộc). */
export function FormLyDo(props: {
  nhan: string
  goi: string
  onXacNhan: (lyDo: string) => Promise<boolean>
  onDong?: () => void
}) {
  const [lyDo, setLyDo] = useState('')
  const [loi, setLoi] = useState('')
  async function gui(e: FormEvent) {
    e.preventDefault()
    if (lyDo.trim() === '') {
      setLoi('Cần ghi lý do.')
      return
    }
    setLoi('')
    if (await props.onXacNhan(lyDo)) props.onDong?.()
  }
  return (
    <form className="ly-do" onSubmit={(e) => void gui(e)}>
      <label>
        {props.nhan}
        <input value={lyDo} onChange={(e) => setLyDo(e.target.value)} required />
      </label>
      {loi && (
        <span role="alert" className="loi">
          {loi}
        </span>
      )}
      <div className="hang">
        <button type="submit">{props.goi}</button>
        {props.onDong && (
          <button type="button" className="phu-nut" onClick={props.onDong}>
            Bỏ qua
          </button>
        )}
      </div>
    </form>
  )
}

type ViecSua = 'sua' | 'lui-ngay' | 'huy' | 'xoa-mem' | 'thay-the'
const TEN_VIEC: Array<[ViecSua, string, keyof CongTacChucNang]> = [
  ['sua', 'Sửa tại chỗ', 'suaTaiCho'],
  ['lui-ngay', 'Lùi ngày', 'luiNgay'],
  ['huy', 'Hủy phiếu', 'huy'],
  ['xoa-mem', 'Xóa (ẩn)', 'xoaMem'],
  ['thay-the', 'Phiếu thay thế', 'thayThe'],
]

/** Bảng thao tác sửa sai của một phiếu. Mọi thao tác đều hỏi lý do. */
export function BangSuaSai(props: {
  phieu: Phieu
  suaSai: DichVuSuaSai
  congTac: CongTacChucNang
  chay: (viec: () => Promise<unknown>) => Promise<boolean>
}) {
  const { phieu: p, suaSai: dv } = props
  const [mo, setMo] = useState(false)
  const [viec, setViec] = useState<ViecSua>('sua')
  const [moTa, setMoTa] = useState(p.moTa)
  const [ghiChu, setGhiChu] = useState(p.ghiChu ?? '')
  const [tien, setTien] = useState(p.tongTien === undefined ? '' : String(p.tongTien))
  const [pt, setPt] = useState<PhuongThuc>(p.phuongThuc ?? 'tien-mat')
  const [ngayNhan, setNgayNhan] = useState(hienNgay(p.ngayNhan))
  const [ngayTra, setNgayTra] = useState(hienNgay(p.ngayTra))
  const [loiForm, setLoiForm] = useState('')

  const daHuy = p.trangThai === 'da-huy'
  const choPhep = TEN_VIEC.filter(([v, , ct]) => props.congTac[ct] && !(daHuy && v !== 'xoa-mem' && v !== 'thay-the'))
  if (choPhep.length === 0) return null
  const viecDangChon = choPhep.some(([v]) => v === viec) ? viec : choPhep[0]![0]

  function lamMoi() {
    setMoTa(p.moTa)
    setGhiChu(p.ghiChu ?? '')
    setTien(p.tongTien === undefined ? '' : String(p.tongTien))
    setNgayNhan(hienNgay(p.ngayNhan))
    setNgayTra(hienNgay(p.ngayTra))
    setLoiForm('')
  }

  function ngayHoacLoi(chuoi: string, ten: string): string | undefined {
    const iso = docNgay(chuoi)
    if (!iso) setLoiForm(`${ten} cần theo dạng dd/mm/yyyy.`)
    return iso
  }

  async function xacNhan(lyDo: string): Promise<boolean> {
    setLoiForm('')
    const soTien = tien.trim() === '' ? undefined : Number(tien)
    if (viecDangChon === 'huy') return props.chay(() => dv.huy(p.id, lyDo))
    if (viecDangChon === 'xoa-mem') return props.chay(() => dv.xoaMem(p.id, lyDo))
    if (viecDangChon === 'sua') {
      const nhan = ngayHoacLoi(ngayNhan, 'Ngày nhận')
      if (!nhan) return false
      let tra: string | undefined
      if (p.trangThai === 'da-tra') {
        tra = ngayHoacLoi(ngayTra, 'Ngày trả')
        if (!tra) return false
      }
      return props.chay(() =>
        dv.sua(
          p.id,
          {
            ...(moTa !== p.moTa ? { moTa } : {}),
            ...(ghiChu !== (p.ghiChu ?? '') ? { ghiChu } : {}),
            ...(soTien !== undefined && soTien !== p.tongTien ? { tongTien: soTien } : {}),
            ...(p.trangThai === 'da-tra' && pt !== p.phuongThuc ? { phuongThuc: pt } : {}),
            ...(nhan !== p.ngayNhan ? { ngayNhan: nhan } : {}),
            ...(tra !== undefined && tra !== p.ngayTra ? { ngayTra: tra } : {}),
          },
          lyDo,
        ),
      )
    }
    if (viecDangChon === 'lui-ngay') {
      const nhan = ngayHoacLoi(ngayNhan, 'Ngày nhận')
      if (!nhan) return false
      let tra: string | undefined
      if (p.trangThai === 'da-tra') {
        tra = ngayHoacLoi(ngayTra, 'Ngày trả')
        if (!tra) return false
      }
      return props.chay(() =>
        dv.luiNgay(
          p.id,
          {
            ...(nhan !== p.ngayNhan ? { ngayNhan: nhan } : {}),
            ...(tra !== undefined && tra !== p.ngayTra ? { ngayTra: tra } : {}),
          },
          lyDo,
        ),
      )
    }
    const nhan = ngayHoacLoi(ngayNhan, 'Ngày nhận')
    if (!nhan) return false
    return props.chay(() =>
      dv.thayThe(
        p.id,
        {
          moTa,
          ghiChu,
          ngayNhan: nhan,
          ...(soTien !== undefined ? { tongTien: soTien } : {}),
        },
        lyDo,
      ),
    )
  }

  const hienTruongSuaHoacThay = viecDangChon === 'sua' || viecDangChon === 'thay-the'
  const hienNgayTra = p.trangThai === 'da-tra' && (viecDangChon === 'sua' || viecDangChon === 'lui-ngay')

  return (
    <div className="sua-sai">
      <button
        type="button"
        className="phu-nut"
        aria-expanded={mo}
        onClick={() => {
          setMo(!mo)
          lamMoi()
        }}
      >
        Sửa / hủy / thay thế {p.khach.ten}
      </button>
      {mo && (
        <div className="sua-sai-hop">
          <nav className="loc" aria-label={`Chọn thao tác cho ${p.khach.ten}`}>
            {choPhep.map(([v, ten]) => (
              <button key={v} type="button" aria-pressed={viecDangChon === v} onClick={() => setViec(v)}>
                {ten}
              </button>
            ))}
          </nav>
          {hienTruongSuaHoacThay && (
            <>
              <label>
                Mô tả đồ
                <input value={moTa} onChange={(e) => setMoTa(e.target.value)} />
              </label>
              <label>
                Ghi chú
                <input value={ghiChu} onChange={(e) => setGhiChu(e.target.value)} />
              </label>
              {(p.tongTien !== undefined || viecDangChon === 'sua') && (
                <label>
                  Tổng tiền (đồng)
                  <input value={tien} onChange={(e) => setTien(e.target.value)} inputMode="numeric" />
                </label>
              )}
              {viecDangChon === 'sua' && p.trangThai === 'da-tra' && (
                <label>
                  Phương thức
                  <select value={pt} onChange={(e) => setPt(e.target.value as PhuongThuc)}>
                    {Object.entries(TEN_PHUONG_THUC).map(([k, ten]) => (
                      <option key={k} value={k}>
                        {ten}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </>
          )}
          {(viecDangChon === 'sua' || viecDangChon === 'lui-ngay' || viecDangChon === 'thay-the') && (
            <label>
              Ngày nhận (dd/mm/yyyy){viecDangChon === 'lui-ngay' ? ' - phải về trước ngày hiện tại' : ''}
              <input value={ngayNhan} onChange={(e) => setNgayNhan(e.target.value)} inputMode="numeric" />
            </label>
          )}
          {hienNgayTra && (
            <label>
              Ngày trả (dd/mm/yyyy)
              <input value={ngayTra} onChange={(e) => setNgayTra(e.target.value)} inputMode="numeric" />
            </label>
          )}
          {viecDangChon === 'thay-the' && (
            <p className="phu">Phiếu cũ sẽ chuyển thành "Đã hủy" và trỏ sang phiếu mới.</p>
          )}
          {loiForm && (
            <p role="alert" className="loi">
              {loiForm}
            </p>
          )}
          <FormLyDo
            nhan="Lý do (bắt buộc)"
            goi={TEN_VIEC.find(([v]) => v === viecDangChon)?.[1] ?? 'Lưu'}
            onXacNhan={xacNhan}
            onDong={() => setMo(false)}
          />
        </div>
      )}
    </div>
  )
}

function tomTat(n: NhatKyPhieu): string {
  return n.thayDoi
    .map((d) => `${d.truong}: ${JSON.stringify(d.truoc) ?? 'null'} → ${JSON.stringify(d.sau) ?? 'null'}`)
    .join('; ')
}

const TEN_LOAI: Record<NhatKyPhieu['loai'], string> = {
  sua: 'Sửa',
  huy: 'Hủy',
  'xoa-mem': 'Xóa mềm',
  'lui-ngay': 'Lùi ngày',
  'thay-the': 'Thay thế',
  'doi-cai-dat': 'Đổi cài đặt',
  'doi-nguoi-dung': 'Đổi người dùng',
  'doi-dong-y-nhan-tin': 'Đổi đồng ý nhận tin',
}

/** Màn "Xem lại thay đổi" theo tuần. Nhật ký chỉ đọc; "đã xem" lưu riêng. */
export function ManXemLai(props: { suaSai: DichVuSuaSai; onDoi: () => void }) {
  const { suaSai } = props
  const [ngay, setNgay] = useState(homNayIso())
  const [tuan, setTuan] = useState<XemLaiTuan>()
  const [loi, setLoi] = useState('')

  const [dem, setDem] = useState(0)

  useEffect(() => {
    let huy = false
    suaSai
      .xemLaiTuan(ngay)
      .then((t) => {
        if (huy) return
        setTuan(t)
        setLoi('')
      })
      .catch((e: unknown) => {
        if (!huy) setLoi(thongBaoLoi(e))
      })
    return () => {
      huy = true
    }
  }, [suaSai, ngay, dem])

  function doiTuan(soNgay: number) {
    const d = new Date(`${ngay}T00:00:00Z`)
    d.setUTCDate(d.getUTCDate() + soNgay)
    setNgay(d.toISOString().slice(0, 10))
  }

  async function danhDau(viec: () => Promise<unknown>) {
    try {
      await viec()
      setDem((x) => x + 1)
      props.onDoi()
    } catch (e) {
      setLoi(thongBaoLoi(e))
    }
  }

  return (
    <section className="xem-lai" aria-label="Xem lại thay đổi">
      <h2>Xem lại thay đổi</h2>
      <div className="hang">
        <button type="button" className="phu-nut" onClick={() => doiTuan(-7)}>
          Tuần trước
        </button>
        <strong>{tuan ? `${hienNgay(tuan.tuNgay)} - ${hienNgay(tuan.denNgay)}` : '...'}</strong>
        <button type="button" className="phu-nut" onClick={() => doiTuan(7)}>
          Tuần sau
        </button>
        <button
          type="button"
          disabled={!tuan || tuan.soChuaXem === 0}
          onClick={() => void danhDau(() => suaSai.danhDauDaXemTuan(ngay))}
        >
          Đã xem cả tuần ({tuan?.soChuaXem ?? 0})
        </button>
      </div>
      {loi && (
        <p role="alert" className="loi">
          {loi}
        </p>
      )}
      {tuan && tuan.muc.length === 0 && <p>Tuần này không có thay đổi nào.</p>}
      <ul className="mds-ds">
        {tuan?.muc.map(({ nhatKy: n, daXem }) => (
          <li
            key={n.id}
            className={n.batThuong.some((b) => b.mucDo === 'cao') ? 'bt-cao' : n.batThuong.length > 0 ? 'bt-tb' : undefined}
          >
            <div className="dau">
              <strong>
                {TEN_LOAI[n.loai]}
                {n.phieuId ? ` · ${n.phieuId}` : ''}
                {n.phieuLienKetId ? ` → ${n.phieuLienKetId}` : ''}
              </strong>
              <span className="nhan">{daXem ? 'Đã xem' : 'Chưa xem'}</span>
            </div>
            <div className="phu">
              {n.luc.replace('T', ' ')} · {n.nguoi.ten} (chưa xác thực)
            </div>
            <div>Lý do: {n.lyDo}</div>
            {n.thayDoi.length > 0 && <div className="phu">{tomTat(n)}</div>}
            {n.batThuong.map((b) => (
              <div key={b.quyTac} className="bat-thuong">
                Bất thường ({b.mucDo === 'cao' ? 'cao' : 'trung bình'}): {b.moTa}
              </div>
            ))}
            {!daXem && (
              <button type="button" className="phu-nut" onClick={() => void danhDau(() => suaSai.danhDauDaXem(n.id))}>
                Đã xem
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}

const TEN_CONG_TAC: Array<[keyof CongTacChucNang, string]> = [
  ['suaTaiCho', 'Sửa tại chỗ'],
  ['huy', 'Hủy phiếu'],
  ['xoaMem', 'Xóa mềm'],
  ['luiNgay', 'Lùi ngày'],
  ['thayThe', 'Phiếu thay thế'],
]

/** Cài đặt: người dùng hiện tại (chưa xác thực), công tắc chức năng, ngưỡng bất thường, khóa tháng. */
export function ManCaiDatSuaSai(props: { suaSai: DichVuSuaSai; onDoi: () => void }) {
  const { suaSai } = props
  const [cd, setCd] = useState<CaiDatPhieu>()
  const [loi, setLoi] = useState('')
  const [cho, setCho] = useState<{ ten: string; chay: (lyDo: string) => Promise<unknown> }>()
  const [thang, setThang] = useState('')

  useEffect(() => {
    void suaSai.caiDat().then(setCd)
  }, [suaSai])

  async function chay(viec: () => Promise<unknown>): Promise<boolean> {
    try {
      await viec()
      setCd(await suaSai.caiDat())
      setLoi('')
      props.onDoi()
      return true
    } catch (e) {
      setLoi(thongBaoLoi(e))
      return false
    }
  }

  if (!cd) return <p>Đang tải...</p>
  const doi = (ten: string, chayLyDo: (lyDo: string) => Promise<unknown>) => setCho({ ten, chay: chayLyDo })

  return (
    <section className="cai-dat" aria-label="Cài đặt sửa sai">
      <h2>Cài đặt sửa sai và nhật ký</h2>
      <p className="phu">Giai đoạn này chưa đăng nhập: người dùng hiện tại chỉ là lựa chọn, nhật ký ghi rõ "chưa xác thực".</p>
      {loi && (
        <p role="alert" className="loi">
          {loi}
        </p>
      )}
      <label>
        Người dùng hiện tại
        <select value={cd.nguoiHienTai} onChange={(e) => void chay(() => suaSai.datNguoiHienTai(e.target.value))}>
          {cd.danhSachNguoi.map((n) => (
            <option key={n.id} value={n.id}>
              {n.ten}
            </option>
          ))}
        </select>
      </label>
      <fieldset>
        <legend>Chức năng đang bật</legend>
        {TEN_CONG_TAC.map(([k, ten]) => (
          <label key={k} className="dong-chon">
            <input
              type="checkbox"
              checked={cd.congTac[k]}
              onChange={(e) => doi(`${e.target.checked ? 'Bật' : 'Tắt'} "${ten}"`, (l) => suaSai.capNhatCaiDat({ congTac: { [k]: e.target.checked } }, l))}
            />
            {ten}
          </label>
        ))}
      </fieldset>
      <fieldset>
        <legend>Khóa tháng (tùy chọn)</legend>
        <label className="dong-chon">
          <input
            type="checkbox"
            checked={cd.khoaThang.bat}
            onChange={(e) => doi(`${e.target.checked ? 'Bật' : 'Tắt'} khóa tháng`, (l) => suaSai.capNhatCaiDat({ khoaThang: { bat: e.target.checked } }, l))}
          />
          Bật khóa tháng (thay đổi vào tháng đã khóa bị đánh dấu bất thường cao)
        </label>
        <p className="phu">Tháng đã khóa: {cd.khoaThang.cacThang.join(', ') || 'chưa có'}</p>
        <div className="hang">
          <input aria-label="Tháng cần khóa (yyyy-mm)" placeholder="2026-10" value={thang} onChange={(e) => setThang(e.target.value)} />
          <button type="button" className="phu-nut" onClick={() => doi(`Khóa tháng ${thang}`, (l) => suaSai.capNhatCaiDat({ khoaThang: { cacThang: [...cd.khoaThang.cacThang, thang.trim()] } }, l))}>
            Thêm tháng khóa
          </button>
          {cd.khoaThang.cacThang.length > 0 && (
            <button type="button" className="phu-nut" onClick={() => doi('Mở khóa mọi tháng', (l) => suaSai.capNhatCaiDat({ khoaThang: { cacThang: [] } }, l))}>
              Mở khóa mọi tháng
            </button>
          )}
        </div>
      </fieldset>
      <fieldset>
        <legend>Ngưỡng đánh dấu bất thường</legend>
        {(
          [
            ['luiNgayQuaNgay', 'Lùi ngày quá (ngày)'],
            ['thayDoiMoiNgay', 'Hơn (số thay đổi mỗi người mỗi ngày)'],
            ['giamTienPhanTram', 'Giảm tổng tiền quá (%)'],
          ] as const
        ).map(([k, ten]) => (
          <OTruongNguong key={`${k}-${cd.nguong[k]}`} ten={ten} giaTri={cd.nguong[k]} onLuu={(v) => doi(`Đổi ngưỡng "${ten}" thành ${v}`, (l) => suaSai.capNhatCaiDat({ nguong: { [k]: v } }, l))} />
        ))}
      </fieldset>
      {cho && (
        <FormLyDo
          nhan={`Lý do: ${cho.ten}`}
          goi="Xác nhận"
          onXacNhan={(l) => chay(() => cho.chay(l))}
          onDong={() => setCho(undefined)}
        />
      )}
    </section>
  )
}

function OTruongNguong(props: { ten: string; giaTri: number; onLuu: (v: number) => void }) {
  const [v, setV] = useState(String(props.giaTri))
  return (
    <div className="hang">
      <label>
        {props.ten}
        <input type="number" min={0} step={1} value={v} onChange={(e) => setV(e.target.value)} />
      </label>
      <button
        type="button"
        className="phu-nut"
        disabled={v.trim() === '' || Number(v) === props.giaTri}
        onClick={() => props.onLuu(Number(v))}
      >
        Lưu ngưỡng
      </button>
    </div>
  )
}


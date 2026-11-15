import { useCallback, useEffect, useState, type FormEvent } from 'react'
import type { DichVuBangGia, MucToiThieu } from '../core/bang-gia-service.ts'
import type { BanGhiDichVu } from '../core/kho-dich-vu.ts'
import { LoiNghiepVu } from '../core/types.ts'
import { OChinhNguong } from './nhap-lich-su-ui.tsx'
import { hienTien } from './dinh-dang.ts'
import './bang-gia.css'

const TEN_KIEU = { kg: 'Tính theo kg', 'so-luong': 'Tính theo số lượng' } as const

const docTien = (s: string): number => (s.trim() === '' ? Number.NaN : Number(s.trim().replace(/[.\s]/g, '')))
const docKg = (s: string): number => (s.trim() === '' ? Number.NaN : Number(s.trim().replace(',', '.')))

function thongBaoLoi(e: unknown): string {
  return e instanceof LoiNghiepVu ? e.message : 'Có lỗi xảy ra, thử lại.'
}

/** Hai ô mức tối thiểu cùng trống thì không có mức; chỉ điền một ô là lỗi. Trả undefined khi không có, chuỗi khi lỗi. */
function docToiThieu(kg: string, tien: string): MucToiThieu | undefined | string {
  if (kg.trim() === '' && tien.trim() === '') return undefined
  const duoiKg = docKg(kg)
  const t = docTien(tien)
  if (!(duoiKg > 0) || !(t > 0)) return 'Mức tối thiểu cần điền cả hai ô: dưới bao nhiêu kg và tính bao nhiêu đồng.'
  return { duoiKg, tien: t }
}

interface GiaTriForm {
  ten: string
  kieu: 'kg' | 'so-luong'
  donGia: number
  toiThieu?: MucToiThieu
}

function FormDichVu(props: {
  goi: string
  dau?: BanGhiDichVu
  onLuu: (v: GiaTriForm) => Promise<boolean>
  onBo?: () => void
}) {
  const d = props.dau
  const [ten, setTen] = useState(d?.ten ?? '')
  const [kieu, setKieu] = useState<'kg' | 'so-luong'>(d?.kieu ?? 'kg')
  const [gia, setGia] = useState(d ? String(d.donGia) : '')
  const [kg, setKg] = useState(d?.toiThieu ? String(d.toiThieu.duoiKg) : '')
  const [tien, setTien] = useState(d?.toiThieu ? String(d.toiThieu.tien) : '')
  const [loi, setLoi] = useState('')

  async function gui(e: FormEvent) {
    e.preventDefault()
    let toiThieu: MucToiThieu | undefined
    if (kieu === 'kg') {
      const t = docToiThieu(kg, tien)
      if (typeof t === 'string') {
        setLoi(t)
        return
      }
      toiThieu = t
    }
    setLoi('')
    const ok = await props.onLuu({ ten, kieu, donGia: docTien(gia), ...(toiThieu ? { toiThieu } : {}) })
    if (ok && !d) {
      setTen('')
      setGia('')
      setKg('')
      setTien('')
    }
  }

  return (
    <form className="bg-form" onSubmit={(e) => void gui(e)} aria-label={props.goi}>
      <label className="bg-rong">
        Tên dịch vụ
        <input value={ten} onChange={(e) => setTen(e.target.value)} required />
      </label>
      <label>
        Kiểu tính
        <select value={kieu} onChange={(e) => setKieu(e.target.value as 'kg' | 'so-luong')}>
          <option value="kg">{TEN_KIEU.kg}</option>
          <option value="so-luong">{TEN_KIEU['so-luong']}</option>
        </select>
      </label>
      <label>
        {kieu === 'kg' ? 'Đơn giá mỗi kg (đ)' : 'Đơn giá mỗi cái (đ)'}
        <input value={gia} onChange={(e) => setGia(e.target.value)} inputMode="numeric" required />
      </label>
      {kieu === 'kg' && (
        <>
          <label>
            Tối thiểu: dưới (kg)
            <input value={kg} onChange={(e) => setKg(e.target.value)} inputMode="decimal" placeholder="để trống nếu không có" />
          </label>
          <label>
            thì tính (đ)
            <input value={tien} onChange={(e) => setTien(e.target.value)} inputMode="numeric" />
          </label>
        </>
      )}
      {loi && (
        <p role="alert" className="loi bg-rong">
          {loi}
        </p>
      )}
      <div className="hang bg-rong">
        <button type="submit">{props.goi}</button>
        {props.onBo && (
          <button type="button" className="phu-nut" onClick={props.onBo}>
            Bỏ qua
          </button>
        )}
      </div>
    </form>
  )
}

/** Bảng giá chỉnh được. Mọi thay đổi ghi vào kho Dịch vụ nên tự đồng bộ lên tab "Dịch vụ" khi đã cài đặt. */
export function ManBangGia(props: {
  bangGia: DichVuBangGia
  /** Đẩy hàng đợi lên Sheet ngay (nút "Đồng bộ lên tab Dịch vụ"). */
  dongBoNgay: () => Promise<void>
  daCaiDongBo: boolean
}) {
  const { bangGia } = props
  const [ds, setDs] = useState<BanGhiDichVu[]>([])
  const [dangSua, setDangSua] = useState<string>()
  const [loi, setLoi] = useState('')
  const [thongBao, setThongBao] = useState('')
  const [dangDay, setDangDay] = useState(false)

  const tai = useCallback(() => void bangGia.danhSach().then(setDs), [bangGia])
  useEffect(tai, [tai])

  async function chay(viec: () => Promise<unknown>, tin: string): Promise<boolean> {
    try {
      await viec()
      setLoi('')
      setThongBao(tin)
      tai()
      return true
    } catch (e) {
      setThongBao('')
      setLoi(thongBaoLoi(e))
      return false
    }
  }

  async function dayLen() {
    setDangDay(true)
    try {
      const n = await bangGia.ghiLaiTatCa()
      await props.dongBoNgay()
      setLoi('')
      setThongBao(
        props.daCaiDongBo
          ? `Đã đẩy ${n} dịch vụ lên tab Dịch vụ. Xem ô trạng thái đồng bộ ở đầu trang để biết đã xong chưa.`
          : `Đã ghi ${n} dịch vụ vào hàng chờ. Máy này chưa có mã cài đặt nên chưa gửi lên Sheet; vào Cài đặt để dán mã.`,
      )
    } catch (e) {
      setThongBao('')
      setLoi(thongBaoLoi(e))
    } finally {
      setDangDay(false)
    }
  }

  return (
    <section className="bg" aria-label="Bảng giá">
      <h2>Bảng giá dịch vụ</h2>
      <p className="phu">
        Form chốt tiền chỉ hiện dịch vụ đang dùng. Dịch vụ ngừng dùng vẫn giữ trong phiếu cũ.
      </p>

      <div className="bg-khung">
        <h3>Thêm dịch vụ mới</h3>
        <FormDichVu
          goi="Thêm dịch vụ"
          onLuu={(v) => chay(() => bangGia.them(v), `Đã thêm "${v.ten.trim()}".`)}
        />
      </div>

      {loi && (
        <p role="alert" className="loi">
          {loi}
        </p>
      )}
      {thongBao && <p role="status">{thongBao}</p>}

      {ds.length === 0 ? (
        <p>Chưa có dịch vụ nào. Thêm ở trên, hoặc nhập bảng giá từ KiotViet ở màn Nhập lịch sử.</p>
      ) : (
        <ul className="bg-ds">
          {ds.map((d) => (
            <li key={d.id} className={d.dangDung ? undefined : 'bg-ngung'}>
              {dangSua === d.id ? (
                <FormDichVu
                  goi="Lưu"
                  dau={d}
                  onBo={() => setDangSua(undefined)}
                  onLuu={async (v) => {
                    const ok = await chay(
                      () => bangGia.capNhat(d.id, { ...v, toiThieu: v.toiThieu ?? null }),
                      `Đã lưu "${v.ten.trim()}".`,
                    )
                    if (ok) setDangSua(undefined)
                    return ok
                  }}
                />
              ) : (
                <>
                  <div className="dau">
                    <strong>{d.ten}</strong>
                    <span className="nhan">{d.dangDung ? 'Đang dùng' : 'Ngừng dùng'}</span>
                  </div>
                  <div className="phu">
                    {TEN_KIEU[d.kieu]} · {hienTien(d.donGia)}
                    {d.kieu === 'kg' ? '/kg' : '/cái'}
                    {d.toiThieu && ` · dưới ${d.toiThieu.duoiKg}kg tính ${hienTien(d.toiThieu.tien)}`}
                    {d.canhBaoTuKg !== undefined && ` · cảnh báo từ ${d.canhBaoTuKg}kg`}
                    {d.nhom && ` · ${d.nhom}`}
                  </div>
                  <div className="hang">
                    <button type="button" className="phu-nut" onClick={() => setDangSua(d.id)}>
                      Sửa {d.ten}
                    </button>
                    <button
                      type="button"
                      className="phu-nut"
                      onClick={() =>
                        void chay(
                          () => bangGia.capNhat(d.id, { dangDung: !d.dangDung }),
                          d.dangDung ? `Đã ngừng dùng "${d.ten}".` : `Đã dùng lại "${d.ten}".`,
                        )
                      }
                    >
                      {d.dangDung ? `Ngừng dùng ${d.ten}` : `Dùng lại ${d.ten}`}
                    </button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="bg-khung">
        <h3>Đồng bộ lên tab Dịch vụ</h3>
        <p className="phu">
          Mỗi lần thêm hoặc sửa, app tự gửi lên Sheet. Bấm nút này khi tab Dịch vụ trên Sheet bị xóa hoặc nghi lệch:
          app ghi lại toàn bộ bảng giá rồi đồng bộ ngay.
        </p>
        <button type="button" onClick={() => void dayLen()} disabled={dangDay || ds.length === 0}>
          Đồng bộ lên tab Dịch vụ
        </button>
      </div>

      <OChinhNguong />
    </section>
  )
}

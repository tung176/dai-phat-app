import { useMemo, useState } from 'react'
import type { DichVu } from '../core/bang-gia.ts'
import {
  hienKg,
  tinhChiTiet,
  type ChiTietTien,
  type DongDichVu,
  type GiamGia,
  type KetQuaChiTiet,
} from '../core/tinh-tien.ts'
import { LoiNghiepVu } from '../core/types.ts'
import { useNguongChenh } from './bang-gia-dung.ts'
import { hienTien } from './dinh-dang.ts'

interface DongNhap {
  ma: string
  cach: 'kg' | 'tien'
  giaTri: string
}
interface PhuThuNhap {
  soTien: string
  ghiChu: string
}

/** Số tiền hoặc số lượng: dấu chấm ngăn hàng nghìn. Trống thì undefined. */
function docSo(chuoi: string): number | undefined {
  const s = chuoi.trim().replace(/\s/g, '')
  return s === '' ? undefined : Number(s.replace(/\./g, ''))
}

/** Số kg: dấu phẩy hoặc chấm là thập phân. */
function docKg(chuoi: string): number | undefined {
  const s = chuoi.trim().replace(/\s/g, '')
  return s === '' ? undefined : Number(s.replace(',', '.'))
}

interface KetQuaXem {
  chiTietTien?: ChiTietTien
  ketQua?: KetQuaChiTiet
  loi?: string
}

export interface FormChotTienProps {
  tenKhach: string
  bangGia: DichVu[]
  onChot: (tongTien: number, chiTiet?: ChiTietTien) => Promise<boolean>
}

export default function FormChotTien({ tenKhach, bangGia, onChot }: FormChotTienProps) {
  const [tien, setTien] = useState('')
  const [chiTiet, setChiTiet] = useState(false)
  const [dong, setDong] = useState<DongNhap[]>([])
  const [phuThu, setPhuThu] = useState<PhuThuNhap[]>([])
  const [loaiGiam, setLoaiGiam] = useState<'' | 'tien' | 'phan-tram'>('')
  const [giaTriGiam, setGiaTriGiam] = useState('')
  const [lyDoGiam, setLyDoGiam] = useState('')
  const [chon, setChon] = useState<'so' | 'tinh'>('so')

  const [nguongChenh] = useNguongChenh()
  const tienSo = docSo(tien)

  const { chiTietTien, ketQua, loi }: KetQuaXem = useMemo(() => {
    if (!chiTiet) return {}
    try {
      const dsDong: DongDichVu[] = dong.map((d) => {
        const dv = bangGia.find((x) => x.ma === d.ma)
        if (!dv) throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', 'Cần chọn dịch vụ cho mỗi dòng.')
        if (dv.kieu === 'so-luong') return { dichVu: dv, soLuong: docSo(d.giaTri) ?? Number.NaN }
        return d.cach === 'kg'
          ? { dichVu: dv, kg: docKg(d.giaTri) ?? Number.NaN }
          : { dichVu: dv, tien: docSo(d.giaTri) ?? Number.NaN }
      })
      let giamGia: GiamGia | undefined
      if (loaiGiam) {
        const lyDo = lyDoGiam.trim() || undefined
        giamGia =
          loaiGiam === 'tien'
            ? { loai: 'tien', soTien: docSo(giaTriGiam) ?? Number.NaN, ...(lyDo ? { lyDo } : {}) }
            : { loai: 'phan-tram', phanTram: docKg(giaTriGiam) ?? Number.NaN, ...(lyDo ? { lyDo } : {}) }
      }
      const ct: ChiTietTien = {
        dong: dsDong,
        phuThu: phuThu.map((p) => ({ soTien: docSo(p.soTien) ?? Number.NaN, ghiChu: p.ghiChu.trim() })),
        ...(giamGia ? { giamGia } : {}),
        chon,
      }
      const kq = tinhChiTiet({ ...ct, ...(tienSo !== undefined ? { tongTienSo: tienSo } : {}) }, { nguongChenh })
      return { chiTietTien: ct, ketQua: kq }
    } catch (e) {
      return { loi: e instanceof LoiNghiepVu ? e.message : 'Dữ liệu chưa hợp lệ.' }
    }
  }, [chiTiet, dong, phuThu, loaiGiam, giaTriGiam, lyDoGiam, chon, tienSo, bangGia, nguongChenh])

  function capNhatDong(i: number, phan: Partial<DongNhap>) {
    setDong(dong.map((x, j) => (j === i ? { ...x, ...phan } : x)))
  }
  function capNhatPhuThu(i: number, phan: Partial<PhuThuNhap>) {
    setPhuThu(phuThu.map((x, j) => (j === i ? { ...x, ...phan } : x)))
  }

  return (
    <form
      className="form-chot"
      onSubmit={(e) => {
        e.preventDefault()
        if (chiTiet) {
          if (!chiTietTien || !ketQua) return
          void onChot(tienSo ?? ketQua.tongTinh, chiTietTien).then((ok) => {
            if (ok) setTien('')
          })
        } else {
          void onChot(tienSo ?? Number.NaN).then((ok) => {
            if (ok) setTien('')
          })
        }
      }}
    >
      <div className="hang">
        <input
          aria-label={`Tổng tiền ${tenKhach}`}
          value={tien}
          onChange={(e) => setTien(e.target.value)}
          inputMode="numeric"
          placeholder="Tổng tiền theo sổ (đ)"
        />
        <button type="submit">Chốt tiền</button>
      </div>
      <label className="hang">
        <input type="checkbox" checked={chiTiet} onChange={(e) => setChiTiet(e.target.checked)} />
        Nhập chi tiết dịch vụ
      </label>
      {chiTiet && (
        <fieldset className="chi-tiet">
          <legend>Chi tiết tiền {tenKhach}</legend>
          {bangGia.length === 0 && (<p className="phu">Chưa có bảng giá dịch vụ. Vào Bảng giá (mục Việc ít dùng) để thêm dịch vụ.</p>)}
          {dong.map((d, i) => {
            const dv = bangGia.find((x) => x.ma === d.ma)
            return (
              <div className="hang" key={i}>
                <select
                  aria-label={`Dịch vụ dòng ${i + 1}`}
                  value={d.ma}
                  onChange={(e) => capNhatDong(i, { ma: e.target.value })}
                >
                  <option value="">Chọn dịch vụ</option>
                  {bangGia.map((x) => (
                    <option key={x.ma} value={x.ma}>
                      {x.ten} ({hienTien(x.donGia)}
                      {x.kieu === 'kg' ? '/kg' : ''})
                    </option>
                  ))}
                </select>
                {dv?.kieu === 'kg' && (
                  <select
                    aria-label={`Cách nhập dòng ${i + 1}`}
                    value={d.cach}
                    onChange={(e) => capNhatDong(i, { cach: e.target.value as 'kg' | 'tien' })}
                  >
                    <option value="kg">Kg ghi thật</option>
                    <option value="tien">Tiền (suy ra kg)</option>
                  </select>
                )}
                <input
                  aria-label={`Giá trị dòng ${i + 1}`}
                  value={d.giaTri}
                  inputMode="decimal"
                  placeholder={dv?.kieu === 'so-luong' ? 'Số lượng' : d.cach === 'kg' ? 'Số kg' : 'Số tiền (đ)'}
                  onChange={(e) => capNhatDong(i, { giaTri: e.target.value })}
                />
                <button type="button" onClick={() => setDong(dong.filter((_, j) => j !== i))}>
                  Xóa dòng
                </button>
              </div>
            )
          })}
          <button type="button" onClick={() => setDong([...dong, { ma: '', cach: 'kg', giaTri: '' }])}>
            Thêm dòng dịch vụ
          </button>

          {phuThu.map((p, i) => (
            <div className="hang" key={i}>
              <input
                aria-label={`Số tiền phụ thu ${i + 1}`}
                value={p.soTien}
                inputMode="numeric"
                placeholder="Phụ thu (đ)"
                onChange={(e) => capNhatPhuThu(i, { soTien: e.target.value })}
              />
              <input
                aria-label={`Ghi chú phụ thu ${i + 1}`}
                value={p.ghiChu}
                placeholder="Ghi chú (tẩy trắng, +5K...)"
                onChange={(e) => capNhatPhuThu(i, { ghiChu: e.target.value })}
              />
              <button type="button" onClick={() => setPhuThu(phuThu.filter((_, j) => j !== i))}>
                Xóa phụ thu
              </button>
            </div>
          ))}
          <button type="button" onClick={() => setPhuThu([...phuThu, { soTien: '', ghiChu: '' }])}>
            Thêm phụ thu
          </button>

          <div className="hang">
            <select
              aria-label="Loại giảm giá"
              value={loaiGiam}
              onChange={(e) => setLoaiGiam(e.target.value as '' | 'tien' | 'phan-tram')}
            >
              <option value="">Không giảm giá</option>
              <option value="tien">Giảm theo số tiền</option>
              <option value="phan-tram">Giảm theo phần trăm</option>
            </select>
            {loaiGiam && (
              <>
                <input
                  aria-label="Giá trị giảm giá"
                  value={giaTriGiam}
                  inputMode="decimal"
                  placeholder={loaiGiam === 'tien' ? 'Số tiền (đ)' : 'Phần trăm (%)'}
                  onChange={(e) => setGiaTriGiam(e.target.value)}
                />
                <input
                  aria-label="Lý do giảm giá"
                  value={lyDoGiam}
                  placeholder="Lý do (không bắt buộc)"
                  onChange={(e) => setLyDoGiam(e.target.value)}
                />
              </>
            )}
          </div>

          {loi && dong.length > 0 && (
            <p role="alert" className="loi">
              {loi}
            </p>
          )}
          {ketQua && (
            <div className="tinh-tien" aria-live="polite">
              <ul>
                {ketQua.dong.map((d, i) => (
                  <li key={i}>
                    {d.dichVu.ten}:{' '}
                    {d.kg !== undefined
                      ? `${hienKg(d.kg)}kg (${d.nguonKg === 'ghi-that' ? 'kg ghi thật' : 'kg suy ra từ tiền'})`
                      : `${d.soLuong ?? 0} cái`}{' '}
                    = {hienTien(d.tien)}
                    {d.apDungToiThieu ? ' (mức tối thiểu)' : ''}
                  </li>
                ))}
              </ul>
              {ketQua.canhBao.map((c) => (
                <p key={c} role="alert" className="loi">
                  {c}
                </p>
              ))}
              <p>
                Tính được: {hienTien(ketQua.tongTinh)}
                {ketQua.tongPhuThu > 0 && ` (gồm phụ thu ${hienTien(ketQua.tongPhuThu)})`}
                {ketQua.giamGia > 0 && ` (đã giảm ${hienTien(ketQua.giamGia)})`}
              </p>
              {ketQua.vuotNguong && ketQua.tongTienSo !== undefined && ketQua.chenhLech !== undefined && (
                <div role="group" aria-label="Chọn số đúng">
                  <p className="loi">
                    Lệch {hienTien(Math.abs(ketQua.chenhLech))}: sổ {hienTien(ketQua.tongTienSo)}, tính được{' '}
                    {hienTien(ketQua.tongTinh)}.
                  </p>
                  <label>
                    <input type="radio" name={`chon-${tenKhach}`} checked={chon === 'so'} onChange={() => setChon('so')} />
                    Giữ tiền theo sổ ({hienTien(ketQua.tongTienSo)})
                  </label>
                  <label>
                    <input
                      type="radio"
                      name={`chon-${tenKhach}`}
                      checked={chon === 'tinh'}
                      onChange={() => setChon('tinh')}
                    />
                    Dùng số tính được ({hienTien(ketQua.tongTinh)})
                  </label>
                </div>
              )}
              <p>
                <strong>Sẽ chốt: {hienTien(ketQua.tongChot)}</strong>
              </p>
            </div>
          )}
        </fieldset>
      )}
    </form>
  )
}

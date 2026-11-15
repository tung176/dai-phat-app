import { useEffect, useState, type FormEvent } from 'react'
import type { DichVu } from '../core/bang-gia.ts'
import { docGoi, type GoiNhapLichSu } from '../core/kiotviet-goi.ts'
import type { BanKiemTra, DichVuNhapLichSu, KetQuaNhap } from '../core/nhap-lich-su.ts'
import { LoiNghiepVu } from '../core/types.ts'
import { useNguongChenh } from './bang-gia-dung.ts'
import { hienTien } from './dinh-dang.ts'
import './nhap-lich-su.css'

const TEN_DOI_CHIEU: Record<string, string> = {
  soPhieuDaTra: 'Phiếu đã trả',
  soPhieuChuaThanhToan: 'Phiếu chưa thanh toán',
  soKhach: 'Khách',
  soDichVu: 'Dịch vụ',
  tienMat: 'Tiền mặt',
  chuyenKhoan: 'Chuyển khoản',
}

const laTien = (ten: string) => ten === 'tienMat' || ten === 'chuyenKhoan'
const hienGiaTri = (ten: string, v: number) => (laTien(ten) ? hienTien(v) : String(v).replace(/\B(?=(\d{3})+(?!\d))/g, '.'))

function thongBaoLoi(e: unknown): string {
  return e instanceof LoiNghiepVu ? e.message : 'Có lỗi xảy ra, thử lại.'
}

/** Ô chỉnh ngưỡng chênh lệch giữa tiền theo sổ và tiền tính từ kg x đơn giá. */
export function OChinhNguong() {
  const [nguong, datNguong] = useNguongChenh()
  const [nhap, setNhap] = useState(String(nguong))
  const [thongBao, setThongBao] = useState('')
  const [loi, setLoi] = useState('')

  function luu(e: FormEvent) {
    e.preventDefault()
    const n = Number(nhap.trim().replace(/\./g, ''))
    if (!datNguong(n)) {
      setThongBao('')
      setLoi('Ngưỡng phải là số đồng nguyên, từ 0 trở lên.')
      return
    }
    setLoi('')
    setThongBao(`Đã lưu: lệch trên ${hienTien(n)} thì form chốt tiền bắt chọn số đúng.`)
  }

  return (
    <form className="nls-nguong" onSubmit={luu} aria-label="Ngưỡng chênh lệch">
      <h3>Ngưỡng chênh lệch tiền và kg</h3>
      <p className="phu">
        Khi tiền tính từ kg và đơn giá khác tiền ghi trong sổ quá ngưỡng này, form chốt tiền sẽ bắt chọn số đúng.
        Hiện tại: {hienTien(nguong)}.
      </p>
      <label>
        Ngưỡng (đồng)
        <input value={nhap} onChange={(e) => setNhap(e.target.value)} inputMode="numeric" />
      </label>
      <button type="submit">Lưu ngưỡng</button>
      {thongBao && <p role="status">{thongBao}</p>}
      {loi && (
        <p role="alert" className="loi">
          {loi}
        </p>
      )}
    </form>
  )
}

function BangKiemTra({ kt }: { kt: BanKiemTra }) {
  const tong = kt.moi.phieu + kt.moi.khach + kt.moi.dichVu
  return (
    <div className="nls-kt" aria-label="Bản kiểm tra trước khi nhập">
      <table>
        <caption>Số liệu trong gói</caption>
        <tbody>
          <tr>
            <th scope="row">Phiếu đã trả</th>
            <td>{kt.soPhieuDaTra}</td>
          </tr>
          <tr>
            <th scope="row">Phiếu chưa thanh toán</th>
            <td>{kt.soPhieuChuaThanhToan}</td>
          </tr>
          <tr>
            <th scope="row">Khách</th>
            <td>{kt.soKhach}</td>
          </tr>
          <tr>
            <th scope="row">Dịch vụ</th>
            <td>{kt.soDichVu}</td>
          </tr>
          <tr>
            <th scope="row">Tiền mặt</th>
            <td>{hienTien(kt.tienMat)}</td>
          </tr>
          <tr>
            <th scope="row">Chuyển khoản</th>
            <td>{hienTien(kt.chuyenKhoan)}</td>
          </tr>
          <tr>
            <th scope="row">Hóa đơn nhập sai quy trình</th>
            <td>{kt.soNhapSaiQuyTrinh}</td>
          </tr>
          <tr>
            <th scope="row">Phiếu gắn khách lẻ</th>
            <td>{kt.soKhachLe}</td>
          </tr>
          <tr>
            <th scope="row">Số điện thoại</th>
            <td>
              hợp lệ {kt.soDienThoai.hopLe}, sai độ dài {kt.soDienThoai.saiDoDai}, có chữ {kt.soDienThoai.coChu}, trống{' '}
              {kt.soDienThoai.trong}
            </td>
          </tr>
        </tbody>
      </table>
      {kt.doiChieu.length > 0 && (
        <ul className="nls-doi-chieu" aria-label="Đối chiếu với KiotViet">
          {kt.doiChieu.map((m) => (
            <li key={m.ten} className={m.khop ? 'khop' : 'lech'}>
              {m.khop ? 'Khớp' : 'Lệch'} · {TEN_DOI_CHIEU[m.ten] ?? m.ten}: có {hienGiaTri(m.ten, m.co)}, KiotViet{' '}
              {hienGiaTri(m.ten, m.mong)}
            </li>
          ))}
        </ul>
      )}
      <p>
        Sẽ thêm mới: {kt.moi.phieu} phiếu, {kt.moi.khach} khách, {kt.moi.dichVu} dịch vụ. Đã có sẵn (bỏ qua, không
        ghi đè): {kt.daCo.phieu} phiếu, {kt.daCo.khach} khách, {kt.daCo.dichVu} dịch vụ.
        {tong === 0 && ' Không có gì mới để nhập.'}
      </p>
      {kt.canhBao.map((c) => (
        <p key={c} className="phu">
          Lưu ý: {c}
        </p>
      ))}
      {kt.loi.length > 0 && (
        <div role="alert" className="loi">
          <strong>Gói còn lỗi, chưa nhập được:</strong>
          <ul>
            {kt.loi.slice(0, 10).map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
          {kt.loi.length > 10 && <p>Và {kt.loi.length - 10} lỗi khác.</p>}
        </div>
      )}
    </div>
  )
}

export interface ManNhapLichSuProps {
  nhapLichSu: DichVuNhapLichSu
  bangGia: DichVu[]
  /** Báo cho màn khác đọc lại dữ liệu sau khi nhập. */
  onDoi: () => void
}

export function ManNhapLichSu({ nhapLichSu, bangGia, onDoi }: ManNhapLichSuProps) {
  const [goi, setGoi] = useState<GoiNhapLichSu>()
  const [tenFile, setTenFile] = useState('')
  const [kt, setKt] = useState<BanKiemTra>()
  const [ketQua, setKetQua] = useState<KetQuaNhap>()
  const [loi, setLoi] = useState('')
  const [dangNhap, setDangNhap] = useState(false)
  const [xacNhan, setXacNhan] = useState(false)

  // Bản kiểm tra tính lại theo kho hiện tại: sau khi nhập thì số "đã có" cập nhật.
  useEffect(() => {
    if (!goi) return
    let huy = false
    void nhapLichSu.kiemTra(goi).then((k) => {
      if (!huy) setKt(k)
    })
    return () => {
      huy = true
    }
  }, [goi, nhapLichSu, ketQua])

  async function chonFile(file: File | undefined) {
    setGoi(undefined)
    setKt(undefined)
    setKetQua(undefined)
    setXacNhan(false)
    setLoi('')
    if (!file) return
    setTenFile(file.name)
    try {
      setGoi(docGoi(await file.text()))
    } catch (e) {
      setLoi(thongBaoLoi(e))
    }
  }

  async function nhap() {
    if (!goi) return
    setDangNhap(true)
    setLoi('')
    try {
      setKetQua(await nhapLichSu.nhap(goi, { xacNhan: true }))
      setXacNhan(false)
      onDoi()
    } catch (e) {
      setLoi(thongBaoLoi(e))
    } finally {
      setDangNhap(false)
    }
  }

  const coGiNhap = kt !== undefined && kt.loi.length === 0 && kt.moi.phieu + kt.moi.khach + kt.moi.dichVu > 0

  return (
    <section className="nls" aria-label="Nhập lịch sử KiotViet">
      <h2>Nhập lịch sử từ KiotViet</h2>
      <p className="phu">
        Chọn file JSON &quot;gói nhập lịch sử&quot; do công cụ <code>tools/nhap-kiotviet.mjs</code> tạo từ các file Excel
        KiotViet. App xem trước số liệu, anh xác nhận rồi mới ghi. Chạy lại cùng file không tạo phiếu hay khách trùng.
      </p>
      <label className="nls-file">
        File gói nhập lịch sử (.json)
        <input
          type="file"
          accept=".json,application/json"
          aria-label="File gói nhập lịch sử"
          onChange={(e) => void chonFile(e.target.files?.[0])}
        />
      </label>
      {loi && (
        <p role="alert" className="loi">
          {loi}
        </p>
      )}
      {goi && kt && (
        <>
          <p>
            File: <strong>{tenFile}</strong>
          </p>
          <BangKiemTra kt={kt} />
          {coGiNhap && !ketQua && (
            <div className="nls-xac-nhan">
              <label className="dong-chon">
                <input type="checkbox" checked={xacNhan} onChange={(e) => setXacNhan(e.target.checked)} />
                Tôi đã xem số liệu trên và đồng ý nhập
              </label>
              <button type="button" disabled={!xacNhan || dangNhap} onClick={() => void nhap()}>
                {dangNhap ? 'Đang nhập...' : 'Nhập vào app'}
              </button>
            </div>
          )}
        </>
      )}
      {ketQua && (
        <p role="status" className="nls-xong">
          Đã nhập xong: thêm {ketQua.phieuMoi} phiếu, {ketQua.khachMoi + ketQua.khachLeMoi} khách, {ketQua.dichVuMoi} dịch
          vụ. Bỏ qua vì đã có: {ketQua.phieuDaCo} phiếu, {ketQua.khachDaCo} khách, {ketQua.dichVuDaCo} dịch vụ. Dữ liệu nằm
          trong máy và tự gửi lên Google Sheet khi đã cài đặt đồng bộ.
        </p>
      )}

      <section aria-label="Bảng giá dịch vụ" className="nls-bang-gia">
        <h3>Bảng giá dịch vụ ({bangGia.length})</h3>
        {bangGia.length === 0 ? (
          <p className="phu">Chưa có dịch vụ nào. Nhập gói lịch sử ở trên để có bảng giá thật.</p>
        ) : (
          <details>
            <summary>Xem {bangGia.length} dịch vụ</summary>
            <ul className="nls-ds-dich-vu">
              {bangGia.map((d) => (
                <li key={d.ma}>
                  <span>{d.ten}</span>
                  <span>
                    {hienTien(d.donGia)}
                    {d.kieu === 'kg' ? '/kg' : ''}
                  </span>
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>
      <OChinhNguong />
    </section>
  )
}

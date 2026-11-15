import { useState } from 'react'
import type { DichVu } from '../core/bang-gia.ts'
import type { CongTacChucNang } from '../core/nhat-ky-phieu.ts'
import type { DichVuSuaSai } from '../core/sua-sai-service.ts'
import type { ChiTietTien } from '../core/tinh-tien.ts'
import type { Phieu, PhuongThuc } from '../core/types.ts'
import { docNgay, hienNgay, hienTien, homNayIso, nhanNguonPhieu } from './dinh-dang.ts'
import FormChotTien from './FormChotTien.tsx'
import { BangSuaSai, FormLyDo } from './sua-sai-ui.tsx'

const TEN_PHUONG_THUC: Record<PhuongThuc, string> = {
  'tien-mat': 'Tiền mặt',
  'chuyen-khoan': 'Chuyển khoản',
}

/** Mọi thứ một dòng phiếu cần để vừa xem vừa thao tác. Dùng chung cho màn Phiếu và màn Đồ chưa lấy. */
export interface HanhDongPhieu {
  suaSai: DichVuSuaSai
  congTac: CongTacChucNang
  bangGia: DichVu[]
  chay: (viec: () => Promise<unknown>) => Promise<boolean>
  onChot: (id: string, tien: number, chiTiet?: ChiTietTien) => Promise<boolean>
  onTra: (id: string, ngay: string, pt: PhuongThuc) => Promise<boolean>
  onDong: (id: string, lyDo: string) => Promise<boolean>
}

export function DongPhieu(props: {
  phieu: Phieu
  hanhDong: HanhDongPhieu
  /** Chỉ màn Đồ chưa lấy truyền: số ngày tồn và đã quá ngưỡng cảnh báo hay chưa. */
  ton?: { soNgay: number; quaNguong: boolean }
}) {
  const { phieu: p, hanhDong: h } = props
  const [ngayTra, setNgayTra] = useState(hienNgay(homNayIso()))
  const [pt, setPt] = useState<PhuongThuc>('tien-mat')
  const [loiNgay, setLoiNgay] = useState('')
  const [dangDong, setDangDong] = useState(false)
  const nguon = nhanNguonPhieu(p.nguon)
  const conODoTiem = p.nhan === 'Chưa tính tiền' || p.nhan === 'Chờ trả khách'

  return (
    <li className={`phieu nhan-${p.trangThai}${props.ton?.quaNguong ? ' qua-nguong' : ''}`}>
      <div className="dau">
        <strong>{p.khach.tenHienThi}</strong>
        <span className="nhom-nhan">
          {nguon && <span className={nguon.canhBao ? 'nhan nhan-canh-bao' : 'nhan nhan-nguon'}>{nguon.chu}</span>}
          <span className="nhan">{p.nhan}</span>
        </span>
      </div>
      <div>
        {p.moTa}
        {p.ghiChu ? ` (${p.ghiChu})` : ''}
      </div>
      <div className="phu">
        Nhận {hienNgay(p.ngayNhan) || 'chưa rõ ngày'}
        {p.tongTien !== undefined && ` · ${hienTien(p.tongTien)}`}
        {p.ngayTra && p.phuongThuc && ` · Trả ${hienNgay(p.ngayTra)} (${TEN_PHUONG_THUC[p.phuongThuc]})`}
      </div>
      {props.ton && (
        <div className="ton">
          {props.ton.soNgay} ngày ở tiệm{props.ton.quaNguong ? ' - quá hạn' : ''}
        </div>
      )}
      {(p.thayTheCho || p.thayTheBoi) && (
        <div className="phu">
          {p.thayTheCho && `Thay thế phiếu ${p.thayTheCho}. `}
          {p.thayTheBoi && `Đã được thay bằng phiếu ${p.thayTheBoi}.`}
        </div>
      )}
      <BangSuaSai phieu={p} suaSai={h.suaSai} congTac={h.congTac} chay={h.chay} />
      {p.nhan === 'Chưa tính tiền' && (
        <FormChotTien
          tenKhach={p.khach.ten}
          bangGia={h.bangGia}
          onChot={(tien, chiTiet) => h.onChot(p.id, tien, chiTiet)}
        />
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
            void h.onTra(p.id, iso, pt)
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
      {conODoTiem && !dangDong && (
        <button type="button" className="phu-nut dong-phieu-nut" onClick={() => setDangDong(true)}>
          Đóng phiếu {p.khach.ten}
        </button>
      )}
      {conODoTiem && dangDong && (
        <FormLyDo
          nhan="Lý do đóng phiếu (ví dụ: khách đã lấy đồ từ lâu, không còn đồ ở tiệm)"
          goi="Đóng phiếu"
          onXacNhan={(lyDo) => h.onDong(p.id, `Đóng phiếu: ${lyDo.trim()}`)}
          onDong={() => setDangDong(false)}
        />
      )}
    </li>
  )
}

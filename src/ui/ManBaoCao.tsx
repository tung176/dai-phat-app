import { useMemo, useState } from 'react'
import { baoCaoKy, khoangCuaNgay, khoangCuaThang } from '../core/bao-cao.ts'
import type { Phieu } from '../core/types.ts'
import { hienNgay, hienTien } from './dinh-dang.ts'
import './bao-cao.css'

type KieuKy = 'thang' | 'ngay'

/** Báo cáo thu theo ngày trả. `homNay` dạng ISO, truyền vào để dễ kiểm thử. */
export default function ManBaoCao(props: { phieus: Phieu[]; homNay: string }) {
  const [kieu, setKieu] = useState<KieuKy>('thang')
  const [thang, setThang] = useState(props.homNay.slice(0, 7))
  const [ngay, setNgay] = useState(props.homNay)

  const khoang = kieu === 'thang' ? khoangCuaThang(thang || props.homNay.slice(0, 7)) : khoangCuaNgay(ngay || props.homNay)
  const bc = useMemo(() => baoCaoKy(props.phieus, khoang), [props.phieus, khoang.tuNgay, khoang.denNgay])

  return (
    <section className="bc" aria-label="Báo cáo thu">
      <h2>Báo cáo thu</h2>
      <p className="bc-ghi-chu">Tính theo ngày trả. Phiếu hủy, phiếu xóa và phiếu chưa trả không tính.</p>
      <div className="bc-chon">
        <div className="bc-kieu" role="group" aria-label="Kiểu kỳ">
          <button type="button" aria-pressed={kieu === 'thang'} onClick={() => setKieu('thang')}>
            Theo tháng
          </button>
          <button type="button" aria-pressed={kieu === 'ngay'} onClick={() => setKieu('ngay')}>
            Theo ngày
          </button>
        </div>
        {kieu === 'thang' ? (
          <label>
            Tháng
            <input type="month" value={thang} onChange={(e) => setThang(e.target.value)} />
          </label>
        ) : (
          <label>
            Ngày
            <input type="date" value={ngay} onChange={(e) => setNgay(e.target.value)} />
          </label>
        )}
      </div>

      <table className="bc-bang" aria-label="Tổng thu của kỳ">
        <tbody>
          <tr>
            <th scope="row">Số phiếu</th>
            <td>{bc.tong.soPhieu}</td>
          </tr>
          <tr>
            <th scope="row">Tiền mặt</th>
            <td>{hienTien(bc.tong.tienMat)}</td>
          </tr>
          <tr>
            <th scope="row">Chuyển khoản</th>
            <td>{hienTien(bc.tong.chuyenKhoan)}</td>
          </tr>
          <tr className="bc-tong">
            <th scope="row">Tổng thu</th>
            <td>{hienTien(bc.tong.tongTien)}</td>
          </tr>
        </tbody>
      </table>

      {kieu === 'thang' && (
        <>
          <h3>Theo ngày</h3>
          {bc.theoNgay.length === 0 ? (
            <p>Không có phiếu trả trong kỳ này.</p>
          ) : (
            <div className="bc-cuon">
              <table className="bc-bang bc-ngay">
                <thead>
                  <tr>
                    <th>Ngày</th>
                    <th>Phiếu</th>
                    <th>Tiền mặt</th>
                    <th>Chuyển khoản</th>
                    <th>Tổng</th>
                  </tr>
                </thead>
                <tbody>
                  {bc.theoNgay.map((n) => (
                    <tr key={n.ngay}>
                      <td>{hienNgay(n.ngay)}</td>
                      <td>{n.soPhieu}</td>
                      <td>{hienTien(n.tienMat)}</td>
                      <td>{hienTien(n.chuyenKhoan)}</td>
                      <td>{hienTien(n.tongTien)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      <h3>Top dịch vụ</h3>
      {bc.topDichVu.length === 0 ? (
        <p>Chưa có phiếu nào có dòng dịch vụ trong kỳ này.</p>
      ) : (
        <div className="bc-cuon">
          <table className="bc-bang">
            <thead>
              <tr>
                <th>Dịch vụ</th>
                <th>Phiếu</th>
                <th>Doanh thu</th>
              </tr>
            </thead>
            <tbody>
              {bc.topDichVu.map((d) => (
                <tr key={d.ma}>
                  <td>{d.ten}</td>
                  <td>{d.soPhieu}</td>
                  <td>{hienTien(d.doanhThu)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="bc-ghi-chu">
        Top dịch vụ chỉ tính {bc.phieuCoDongDichVu.soPhieu} phiếu có dòng dịch vụ ({hienTien(bc.phieuCoDongDichVu.tongTien)}).
        {' '}
        {bc.phieuChiCoTongTien.soPhieu} phiếu chỉ có tổng tiền ({hienTien(bc.phieuChiCoTongTien.tongTien)}) vẫn nằm trong tổng thu
        nhưng không có trong top này.
      </p>
    </section>
  )
}

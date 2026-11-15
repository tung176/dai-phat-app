import { useMemo, useState } from 'react'
import { doChuaLay, docNguong, type NguongCanhBao } from '../core/danh-sach-phieu.ts'
import type { Phieu } from '../core/types.ts'
import { DongPhieu, type HanhDongPhieu } from './dong-phieu-ui.tsx'

import './man-danh-sach.css'

const KHOA_NGUONG = 'giat-la.nguong-canh-bao'

function docNguongDaLuu(): NguongCanhBao {
  try {
    return docNguong(localStorage.getItem(KHOA_NGUONG))
  } catch {
    return docNguong(null)
  }
}

function luuNguong(n: NguongCanhBao): void {
  try {
    localStorage.setItem(KHOA_NGUONG, JSON.stringify(n))
  } catch {
    // không lưu được thì thôi, vẫn dùng trong phiên này
  }
}

/**
 * Đồ chưa lấy: phiếu còn đồ ở tiệm, lâu nhất trước, tô đỏ khi quá ngưỡng.
 * Dùng cùng dòng phiếu với màn Phiếu nên chốt tiền, trả khách, đóng phiếu làm ngay tại đây.
 * `homNay` dạng ISO, truyền vào để dễ kiểm thử.
 */
export function ManDoChuaLay(props: { phieus: Phieu[]; homNay: string; hanhDong: HanhDongPhieu }) {
  const [nguong, setNguong] = useState<NguongCanhBao>(docNguongDaLuu)
  const chuaLay = useMemo(() => doChuaLay(props.phieus, props.homNay, nguong), [props.phieus, props.homNay, nguong])

  function doiNguong(khoa: keyof NguongCanhBao, v: string) {
    const so = Number(v)
    if (v.trim() === '' || !Number.isInteger(so) || so < 0) return
    const moi = { ...nguong, [khoa]: so }
    setNguong(moi)
    luuNguong(moi)
  }

  return (
    <section className="mds" aria-label="Đồ chưa lấy">
      <h2>Đồ chưa lấy ({chuaLay.length})</h2>
      <div className="mds-nguong">
        <label>
          Cảnh báo chưa tính tiền quá (ngày)
          <input
            type="number"
            min={0}
            step={1}
            value={nguong.chuaTinhTien}
            onChange={(e) => doiNguong('chuaTinhTien', e.target.value)}
          />
        </label>
        <label>
          Cảnh báo chưa trả khách quá (ngày)
          <input
            type="number"
            min={0}
            step={1}
            value={nguong.chuaTraKhach}
            onChange={(e) => doiNguong('chuaTraKhach', e.target.value)}
          />
        </label>
      </div>
      {chuaLay.length === 0 ? (
        <p>Không có đồ nào còn ở tiệm.</p>
      ) : (
        <ul className="ds">
          {chuaLay.map(({ phieu, soNgay, quaNguong }) => (
            <DongPhieu key={phieu.id} phieu={phieu} hanhDong={props.hanhDong} ton={{ soNgay, quaNguong }} />
          ))}
        </ul>
      )}
    </section>
  )
}

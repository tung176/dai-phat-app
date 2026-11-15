import { useState } from 'react'
import './goi-y-gop.css'
import type { CapGoiYGop, CumGoiY, GoiYGopTheoCum, Khach, LyDoGiong } from '../core/khach.ts'

const LY_DO: Record<LyDoGiong, string> = {
  'trung-ten': 'Trùng tên (sau khi bỏ dấu, hoa thường)',
  'doi-thu-tu-tu': 'Cùng các từ, khác thứ tự',
  'gan-giong': 'Gần giống, có thể gõ nhầm',
}

/** Số cụm dựng mỗi lần: danh sách dài không vẽ một lúc. */
const SO_CUM_MOI_LAN = 20

function soKhach(k: Khach): string {
  if (!k.soDienThoai) return 'chưa có số'
  return k.dungDuocSo ? k.soDienThoai : `${k.soDienThoai} (số chưa đúng)`
}

function DongCap(props: { cap: CapGoiYGop; onGop: (giuLai: Khach, bo: Khach) => void }) {
  const { cap: c, onGop } = props
  return (
    <li className="goi-y-cap">
      <div>
        <strong>{c.a.tenHienThi}</strong> ({soKhach(c.a)}) và <strong>{c.b.tenHienThi}</strong> ({soKhach(c.b)})
      </div>
      <div className="phu">
        {LY_DO[c.lyDo]}
        {c.khacSoDienThoai && ' · hai số điện thoại khác nhau, có thể là hai người'}
      </div>
      <div className="hang">
        <button type="button" onClick={() => onGop(c.a, c.b)}>
          Gộp vào {c.a.id}
        </button>
        <button type="button" onClick={() => onGop(c.b, c.a)}>
          Gộp vào {c.b.id}
        </button>
      </div>
    </li>
  )
}

function Cum(props: { cum: CumGoiY; onGop: (giuLai: Khach, bo: Khach) => void }) {
  const { cum, onGop } = props
  const [moCap, setMoCap] = useState(false)
  const motCap = cum.cap.length === 1
  return (
    <li className="phieu goi-y-cum">
      <div>
        <strong>{[...new Set(cum.khach.map((k) => k.tenGoc))].join(' / ')}</strong> ({cum.khach.length} khách)
      </div>
      <div className="phu">
        {LY_DO[cum.lyDo[0]!].toLowerCase()}
        {cum.lyDo.length > 1 && `; có cả ${cum.lyDo.slice(1).map((l) => LY_DO[l].toLowerCase()).join(', ')}`}
      </div>
      <ul className="goi-y-khach">
        {cum.khach.map((k) => (
          <li key={k.id}>
            {k.tenHienThi} ({k.id}) · {soKhach(k)}
          </li>
        ))}
      </ul>
      {motCap ? (
        <ul className="ds goi-y-ds-cap">
          <DongCap cap={cum.cap[0]!} onGop={onGop} />
        </ul>
      ) : (
        <details onToggle={(e) => setMoCap((e.currentTarget as HTMLDetailsElement).open)}>
          <summary>Xem {cum.cap.length} cặp để gộp</summary>
          {moCap && (
            <ul className="ds goi-y-ds-cap">
              {cum.cap.map((c) => (
                <DongCap key={`${c.a.id}-${c.b.id}`} cap={c} onGop={onGop} />
              ))}
            </ul>
          )}
        </details>
      )}
    </li>
  )
}

function DanhSachCum(props: { cum: CumGoiY[]; onGop: (giuLai: Khach, bo: Khach) => void }) {
  const [soCum, setSoCum] = useState(SO_CUM_MOI_LAN)
  return (
    <>
      <ul className="ds">
        {props.cum.slice(0, soCum).map((c) => (
          <Cum key={c.khach.map((k) => k.id).join('+')} cum={c} onGop={props.onGop} />
        ))}
      </ul>
      {props.cum.length > soCum && (
        <button type="button" className="xem-them" onClick={() => setSoCum(soCum + SO_CUM_MOI_LAN)}>
          Xem thêm {Math.min(SO_CUM_MOI_LAN, props.cum.length - soCum)} cụm (còn {props.cum.length - soCum})
        </button>
      )}
    </>
  )
}

/**
 * Gợi ý gộp khách: mục chính chỉ có cụm cần xem; cụm chỉ gồm khách có số điện thoại hợp lệ khác nhau
 * (nhiều khả năng là người khác nhau) thu gọn trong "Ít khả năng trùng" và chỉ vẽ khi mở ra.
 */
export function GoiYGop(props: { goiY: GoiYGopTheoCum; onGop: (giuLai: Khach, bo: Khach) => void }) {
  const { canXem, itKhaNangTrung } = props.goiY
  const [moAn, setMoAn] = useState(false)
  return (
    <>
      <h2>Gợi ý gộp khách ({canXem.length})</h2>
      {canXem.length === 0 ? (
        <p>Chưa thấy cụm tên nào cần xem.</p>
      ) : (
        <DanhSachCum cum={canXem} onGop={props.onGop} />
      )}
      {itKhaNangTrung.length > 0 && (
        <details className="goi-y-it" onToggle={(e) => setMoAn((e.currentTarget as HTMLDetailsElement).open)}>
          <summary>Ít khả năng trùng ({itKhaNangTrung.length})</summary>
          <p className="phu">Tên giống nhau nhưng cả hai khách đều có số điện thoại đúng và khác nhau, nhiều khả năng là hai người.</p>
          {moAn && <DanhSachCum cum={itKhaNangTrung} onGop={props.onGop} />}
        </details>
      )}
    </>
  )
}

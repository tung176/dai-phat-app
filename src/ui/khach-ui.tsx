import { useEffect, useState, type FormEvent } from 'react'
import type { CapGoiYGop, Khach, NhatKyGop } from '../core/khach.ts'
import type { DichVuKhach } from '../core/khach-service.ts'
import { LoiNghiepVu } from '../core/types.ts'
import { hienNgay } from './dinh-dang.ts'

const LY_DO: Record<CapGoiYGop['lyDo'], string> = {
  'trung-ten': 'Trùng tên (sau khi bỏ dấu, hoa thường)',
  'doi-thu-tu-tu': 'Cùng các từ, khác thứ tự',
  'gan-giong': 'Gần giống, có thể gõ nhầm',
}

function thongBaoLoi(e: unknown): string {
  return e instanceof LoiNghiepVu ? e.message : 'Có lỗi xảy ra, thử lại.'
}

export function ManHinhKhach(props: { khach: DichVuKhach; onDoi: () => void }) {
  const { khach, onDoi } = props
  const [ds, setDs] = useState<Khach[]>([])
  const [canBoSung, setCanBoSung] = useState<Khach[]>([])
  const [goiY, setGoiY] = useState<CapGoiYGop[]>([])
  const [nhatKy, setNhatKy] = useState<NhatKyGop[]>([])
  const [tim, setTim] = useState('')
  const [loi, setLoi] = useState('')
  const [thongBao, setThongBao] = useState('')

  const [lan, setLan] = useState(0)

  useEffect(() => {
    let huy = false
    void Promise.all([khach.tim(tim), khach.canBoSung(), khach.goiYGop(), khach.nhatKyGop()]).then(
      ([a, b, c, d]) => {
        if (huy) return
        setDs(a)
        setCanBoSung(b)
        setGoiY(c)
        setNhatKy(d)
      },
    )
    return () => {
      huy = true
    }
  }, [khach, tim, lan])

  async function chay(viec: () => Promise<unknown>, tin?: string) {
    try {
      await viec()
      setLoi('')
      setThongBao(tin ?? '')
      setLan((n) => n + 1)
      onDoi()
    } catch (e) {
      setLoi(thongBaoLoi(e))
    }
  }

  function xacNhanGop(giuLai: Khach, bo: Khach) {
    const ok = window.confirm(
      `Gộp "${bo.tenHienThi}" vào "${giuLai.tenHienThi}"? Mọi phiếu của "${bo.tenHienThi}" sẽ chuyển sang "${giuLai.tenHienThi}". Có thể hoàn tác sau.`,
    )
    if (!ok) return
    void chay(
      () => khach.gop({ giuLai: giuLai.id, gopVao: [bo.id], xacNhan: true }),
      `Đã gộp "${bo.tenHienThi}" vào "${giuLai.tenHienThi}".`,
    )
  }

  return (
    <section aria-label="Khách">
      {loi && (
        <p role="alert" className="loi">
          {loi}
        </p>
      )}
      {thongBao && <p role="status">{thongBao}</p>}

      <FormThemKhach khach={khach} onThem={(d) => chay(() => khach.them(d))} />

      <h2>Cần bổ sung số điện thoại ({canBoSung.length})</h2>
      {canBoSung.length === 0 ? (
        <p>Khách nào cũng có số dùng được.</p>
      ) : (
        <ul className="ds">
          {canBoSung.map((k) => (
            <DongBoSung
              key={k.id}
              khach={k}
              onLuu={(sdt) => chay(() => khach.capNhat(k.id, { soDienThoai: sdt }))}
            />
          ))}
        </ul>
      )}

      <h2>Gợi ý gộp khách ({goiY.length})</h2>
      {goiY.length === 0 ? (
        <p>Chưa thấy cặp tên nào gần giống.</p>
      ) : (
        <ul className="ds">
          {goiY.map((c) => (
            <li key={`${c.a.id}-${c.b.id}`} className="phieu">
              <div>
                <strong>{c.a.tenHienThi}</strong> và <strong>{c.b.tenHienThi}</strong>
              </div>
              <div className="phu">
                {LY_DO[c.lyDo]}
                {c.khacSoDienThoai && ' · hai số điện thoại khác nhau, có thể là hai người'}
              </div>
              <div className="hang">
                <button type="button" onClick={() => xacNhanGop(c.a, c.b)}>
                  Gộp vào {c.a.id}
                </button>
                <button type="button" onClick={() => xacNhanGop(c.b, c.a)}>
                  Gộp vào {c.b.id}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <h2>Danh sách khách ({ds.length})</h2>
      <label>
        Tìm theo tên, vị trí, số điện thoại
        <input value={tim} onChange={(e) => setTim(e.target.value)} />
      </label>
      {ds.length === 0 ? (
        <p>Không có khách nào.</p>
      ) : (
        <ul className="ds">
          {ds.map((k) => (
            <li key={k.id} className="phieu">
              <div className="dau">
                <strong>{k.tenHienThi}</strong>
                <span className="nhan">{k.id}</span>
              </div>
              <div className="phu">
                {k.soDienThoai ? k.soDienThoai : 'Chưa có số'}
                {k.soDienThoai && !k.dungDuocSo && ' (số chưa đúng)'}
              </div>
              <label>
                <input
                  type="checkbox"
                  checked={k.dongYNhanTin === 'dong-y'}
                  onChange={(e) => void chay(() => khach.datDongYNhanTin(k.id, e.target.checked))}
                />{' '}
                Đồng ý nhận tin {k.dongYNhanTin === 'chua-hoi' && '(chưa hỏi)'}
              </label>
            </li>
          ))}
        </ul>
      )}

      <h2>Nhật ký gộp</h2>
      {nhatKy.length === 0 ? (
        <p>Chưa gộp lần nào.</p>
      ) : (
        <ul className="ds">
          {nhatKy.map((n) => (
            <li key={n.id} className="phieu">
              <div>
                {hienNgay(n.ngay)}: gộp {n.gopVao.join(', ')} vào {n.giuLai}, chuyển {n.phieuDaChuyen.length} phiếu
                {n.daHoanTac && ' (đã hoàn tác)'}
              </div>
              {!n.daHoanTac && (
                <button
                  type="button"
                  onClick={() => void chay(() => khach.hoanTacGop(n.id), 'Đã hoàn tác lần gộp.')}
                >
                  Hoàn tác
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

interface DauVaoForm {
  ten: string
  viTri?: string
  soDienThoai?: string
}

function FormThemKhach(props: { khach: DichVuKhach; onThem: (d: DauVaoForm) => Promise<void> }) {
  const [ten, setTen] = useState('')
  const [viTri, setViTri] = useState('')
  const [sdt, setSdt] = useState('')
  const [giong, setGiong] = useState<Khach[]>([])

  useEffect(() => {
    let huy = false
    void (ten.trim() ? props.khach.goiYKhop(ten) : Promise.resolve([])).then((k) => {
      if (!huy) setGiong(k)
    })
    return () => {
      huy = true
    }
  }, [props.khach, ten])

  async function gui(e: FormEvent) {
    e.preventDefault()
    await props.onThem({ ten, viTri: viTri || undefined, soDienThoai: sdt || undefined })
    setTen('')
    setViTri('')
    setSdt('')
  }

  return (
    <form onSubmit={(e) => void gui(e)} className="form" aria-label="Thêm khách">
      <h2>Thêm khách</h2>
      <label>
        Tên khách
        <input value={ten} onChange={(e) => setTen(e.target.value)} required />
      </label>
      {giong.length > 0 && (
        <p role="note" className="phu">
          Đã có khách tên giống: {giong.map((k) => k.tenHienThi).join('; ')}. Kiểm tra trước khi thêm.
        </p>
      )}
      <label>
        Ghi chú vị trí
        <input value={viTri} onChange={(e) => setViTri(e.target.value)} placeholder="tầng 2, B5..." />
      </label>
      <label>
        Số điện thoại (không bắt buộc)
        <input value={sdt} onChange={(e) => setSdt(e.target.value)} inputMode="tel" />
      </label>
      <button type="submit">Thêm khách</button>
    </form>
  )
}

function DongBoSung(props: { khach: Khach; onLuu: (sdt: string) => Promise<void> }) {
  const [sdt, setSdt] = useState(props.khach.soDienThoai ?? '')
  const { khach: k } = props
  return (
    <li className="phieu">
      <div>
        <strong>{k.tenHienThi}</strong> · {k.soDienThoai ? `số chưa đúng: ${k.soDienThoai}` : 'thiếu số'}
      </div>
      <form
        className="hang"
        onSubmit={(e) => {
          e.preventDefault()
          void props.onLuu(sdt)
        }}
      >
        <input
          aria-label={`Số điện thoại ${k.tenHienThi}`}
          value={sdt}
          onChange={(e) => setSdt(e.target.value)}
          inputMode="tel"
        />
        <button type="submit">Lưu số</button>
      </form>
    </li>
  )
}

import { useState, type FormEvent } from 'react'
import { LoiDongBo, goiAppsScript } from '../core/gas-client.ts'
import type { TrangThaiDongBo } from '../core/kho-sheets.ts'
import type { KetNoiSheets } from './dich-vu.ts'
import './dong-bo.css'

const NHAN: Record<TrangThaiDongBo['kieu'], string> = {
  'chua-cai-dat': 'Chưa cài đặt đồng bộ',
  'chua-dong-bo': 'Chưa đồng bộ',
  'dang-gui': 'Đang đồng bộ...',
  'da-dong-bo': 'Đã đồng bộ',
  'cho-mang': 'Đang chờ mạng',
  loi: 'Lỗi đồng bộ',
}

function hienGio(luc: number): string {
  return new Date(luc).toLocaleString('vi-VN', { hour12: false })
}

export function ChiBaoDongBo(props: { trangThai?: TrangThaiDongBo; onMoCaiDat: () => void }) {
  const t = props.trangThai
  if (!t) return null
  return (
    <div className={`dong-bo dong-bo-${t.kieu}`} role="status" aria-live="polite">
      <span>
        {NHAN[t.kieu]}
        {t.choGui > 0 && ` · ${t.choGui} phiếu chờ gửi`}
        {t.kieu === 'da-dong-bo' && t.lanCuoi ? ` · ${hienGio(t.lanCuoi)}` : ''}
        {t.thongBao ? ` · ${t.thongBao}` : ''}
      </span>
      <button type="button" onClick={props.onMoCaiDat}>
        Cài đặt
      </button>
    </div>
  )
}

export function ManCaiDat(props: { ketNoi: KetNoiSheets; onDong: () => void }) {
  const { ketNoi: kn } = props
  const [ma, setMa] = useState('')
  const [daCai, setDaCai] = useState(() => kn.luu.doc() !== null)
  const [thongBao, setThongBao] = useState('')
  const [loi, setLoi] = useState('')

  function luu(e: FormEvent) {
    e.preventDefault()
    setThongBao('')
    if (!kn.luu.datTuMa(ma)) {
      setLoi('Mã cài đặt không đúng. Dán lại đúng cả chuỗi bắt đầu bằng "giatla1:".')
      return
    }
    setLoi('')
    setMa('')
    setDaCai(true)
    setThongBao('Đã lưu mã cài đặt trên máy này. Đang đồng bộ...')
    void kn.kho.dongBo()
  }

  async function thu() {
    const cau = kn.luu.doc()
    if (!cau) return
    setLoi('')
    setThongBao('Đang thử kết nối...')
    try {
      await goiAppsScript(cau, 'ping')
      setThongBao('Kết nối được, mã bí mật đúng.')
    } catch (e) {
      setThongBao('')
      setLoi(e instanceof LoiDongBo ? e.message : 'Không thử được.')
    }
  }

  function xoa() {
    kn.luu.xoa()
    setDaCai(false)
    setThongBao('Đã xóa mã cài đặt khỏi máy này. Dữ liệu trong máy và trên Sheet vẫn còn.')
    void kn.kho.dongBo()
  }

  return (
    <section className="cai-dat" aria-label="Cài đặt đồng bộ">
      <h2>Cài đặt đồng bộ Google Sheets</h2>
      <p>{daCai ? 'Máy này đã có mã cài đặt (không hiển thị lại để giữ bí mật).' : 'Máy này chưa có mã cài đặt.'}</p>
      <form onSubmit={luu} className="form">
        <label>
          Mã cài đặt (bắt đầu bằng giatla1:)
          <textarea
            value={ma}
            onChange={(e) => setMa(e.target.value)}
            rows={3}
            autoComplete="off"
            spellCheck={false}
            aria-label="Mã cài đặt"
          />
        </label>
        <button type="submit" disabled={ma.trim() === ''}>
          Lưu mã cài đặt
        </button>
      </form>
      {daCai && (
        <div className="hang">
          <button type="button" onClick={() => void thu()}>
            Thử kết nối
          </button>
          <button type="button" onClick={() => void props.ketNoi.kho.dongBo()}>
            Đồng bộ ngay
          </button>
          <button type="button" onClick={xoa}>
            Xóa mã cài đặt
          </button>
        </div>
      )}
      {thongBao && <p role="status">{thongBao}</p>}
      {loi && (
        <p role="alert" className="loi">
          {loi}
        </p>
      )}
      <button type="button" onClick={props.onDong}>
        Đóng
      </button>
    </section>
  )
}

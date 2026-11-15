import { useEffect, useState, type FormEvent } from 'react'
import { nhanTinSangCsv, type DanhSachNhanTin } from '../core/nhan-tin.ts'
import type { DichVuNhomKhach } from '../core/nhom-khach-service.ts'
import type { LuuNguongNhom } from '../core/nhom-khach-cai-dat.ts'
import {
  TEN_NHOM,
  type KetQuaNhomKhach,
  type MaNhom,
  type NguongNhom,
} from '../core/nhom-khach.ts'
import { LoiNghiepVu } from '../core/types.ts'
import { hienNgay, hienTien } from './dinh-dang.ts'
import './nhom-khach.css'

function thongBaoLoi(e: unknown): string {
  return e instanceof LoiNghiepVu ? e.message : 'Có lỗi xảy ra, thử lại.'
}

const phanTram = (x: number) => `${Math.round(x * 1000) / 10}%`

function taiCsv(ten: string, noiDung: string) {
  const url = URL.createObjectURL(new Blob([noiDung], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = ten
  a.click()
  URL.revokeObjectURL(url)
}

export function ManNhomKhach(props: { nhomKhach: DichVuNhomKhach; luuNguong: LuuNguongNhom; homNay: string }) {
  const { nhomKhach, luuNguong, homNay } = props
  const [nguong, setNguong] = useState<NguongNhom>(() => luuNguong.doc())
  const [kq, setKq] = useState<KetQuaNhomKhach>()
  const [chon, setChon] = useState<MaNhom>('trung-thanh')
  const [nhanTin, setNhanTin] = useState<DanhSachNhanTin>()
  const [loi, setLoi] = useState('')
  const [thongBao, setThongBao] = useState('')
  const [lan, setLan] = useState(0)

  useEffect(() => {
    let huy = false
    void Promise.all([nhomKhach.xem(nguong), nhomKhach.danhSachNhanTin(chon, nguong)]).then(([a, b]) => {
      if (huy) return
      setKq(a)
      setNhanTin(b)
    })
    return () => {
      huy = true
    }
  }, [nhomKhach, nguong, chon, lan])

  async function chay(viec: () => Promise<unknown>, tin = '') {
    try {
      const r = await viec()
      setLoi('')
      setThongBao(typeof r === 'string' ? r : tin)
      setLan((n) => n + 1)
    } catch (e) {
      setThongBao('')
      setLoi(thongBaoLoi(e))
    }
  }

  function tickCaNhom() {
    const tong = kq?.nhom.find((n) => n.nhom === chon)
    if (!tong) return
    const canTick = tong.soKhach - tong.soDaDongY
    if (canTick === 0) {
      setThongBao('Cả nhóm đã được tick rồi.')
      return
    }
    const ok = window.confirm(
      `Tick "đồng ý nhận tin" cho ${canTick} khách nhóm ${TEN_NHOM[chon]}? Chỉ tick khi các khách này đã đồng ý nhận tin. Thao tác được ghi nhật ký.`,
    )
    if (!ok) return
    void chay(async () => {
      const r = await nhomKhach.datDongYHangLoat({ nhom: chon, nguong, xacNhan: true })
      return `Đã tick đồng ý cho ${r.soDoi} khách.`
    })
  }

  function xuatCsv() {
    if (!nhanTin || nhanTin.dong.length === 0) return
    taiCsv(`nhan-tin-${chon}-${homNay}.csv`, nhanTinSangCsv(nhanTin.dong))
  }

  function luuNguongMoi(moi: NguongNhom): boolean {
    if (!luuNguong.dat(moi)) {
      setLoi('Ngưỡng chưa hợp lệ: các số phải là số nguyên từ 1, Thân thiết từ 2, Trung thành lớn hơn Thân thiết.')
      return false
    }
    setLoi('')
    setNguong(moi)
    setThongBao('Đã lưu ngưỡng (chỉ trên máy này).')
    return true
  }

  const trongNhom = kq?.khach.filter((k) => k.nhom === chon) ?? []
  const tongChon = kq?.nhom.find((n) => n.nhom === chon)

  return (
    <section aria-label="Nhóm khách" className="nk">
      <h2>Nhóm khách</h2>
      {loi && (
        <p role="alert" className="loi">
          {loi}
        </p>
      )}
      {thongBao && <p role="status">{thongBao}</p>}

      <ul className="nk-tong">
        {kq?.nhom.map((n) => (
          <li key={n.nhom}>
            <button
              type="button"
              className="nk-the"
              aria-pressed={chon === n.nhom}
              onClick={() => setChon(n.nhom)}
              aria-label={`Nhóm ${TEN_NHOM[n.nhom]}`}
            >
              <strong>{TEN_NHOM[n.nhom]}</strong>
              <span>{n.soKhach} khách</span>
              <span>Doanh thu {phanTram(n.tyTrong)}</span>
              <span className={n.thieuSo > 0 ? 'nk-canh' : ''}>Thiếu số: {n.thieuSo}</span>
              <span>Đã đồng ý: {n.soDaDongY}</span>
            </button>
          </li>
        ))}
      </ul>
      {kq && kq.chuaCoNhom > 0 && (
        <p className="phu">{kq.chuaCoNhom} khách chưa có phiếu đã trả nên chưa thuộc nhóm nào.</p>
      )}

      <h3>Nhóm {TEN_NHOM[chon]}</h3>
      {tongChon && (
        <p className="phu">
          {tongChon.soKhach} khách, doanh thu {hienTien(tongChon.doanhThu)} ({phanTram(tongChon.tyTrong)} tổng).
        </p>
      )}

      {nhanTin && (
        <div className="nk-xuat">
          <p className={nhanTin.thieuSo + nhanTin.chuaDongY > 0 ? 'nk-canh' : ''}>
            Danh sách nhắn tin: <strong>{nhanTin.dong.length}</strong> khách đủ điều kiện (có số hợp lệ và đã đồng ý).
            {nhanTin.thieuSo + nhanTin.chuaDongY > 0 &&
              ` Loại ra ${nhanTin.thieuSo + nhanTin.chuaDongY} khách: ${nhanTin.thieuSo} thiếu số điện thoại hợp lệ, ${nhanTin.chuaDongY} chưa tick đồng ý nhận tin.`}
          </p>
          <div className="hang">
            <button type="button" onClick={xuatCsv} disabled={nhanTin.dong.length === 0}>
              Xuất CSV nhắn tin
            </button>
            <button type="button" onClick={tickCaNhom} className="nk-phu">
              Tick đồng ý cả nhóm
            </button>
          </div>
        </div>
      )}

      {trongNhom.length === 0 ? (
        <p>Chưa có khách nào trong nhóm này.</p>
      ) : (
        <ul className="ds">
          {trongNhom.map((k) => (
            <li key={k.khachId} className="phieu">
              <div className="dau">
                <strong>{k.tenHienThi}</strong>
                <span className="nhan">{k.soLanMua} lần</span>
              </div>
              <div className="phu">
                {k.soDienThoai ? k.soDienThoai : 'Chưa có số'}
                {k.soDienThoai && !k.dungDuocSo && ' (số chưa đúng)'}
                {' · Mua gần nhất '}
                {hienNgay(k.ngayMuaGanNhat)}
                {k.soNgayChuaQuayLai !== undefined && ` (${k.soNgayChuaQuayLai} ngày trước)`}
                {` · ${hienTien(k.doanhThu)}`}
              </div>
              <label className="nk-tick">
                <input
                  type="checkbox"
                  checked={k.dongYNhanTin}
                  aria-label={`Đồng ý nhận tin ${k.tenHienThi}`}
                  onChange={(e) => void chay(() => nhomKhach.datDongY(k.khachId, e.target.checked))}
                />
                Đồng ý nhận tin
              </label>
            </li>
          ))}
        </ul>
      )}

      <FormNguong key={JSON.stringify(nguong)} nguong={nguong} onLuu={luuNguongMoi} onMacDinh={() => {
        luuNguong.macDinh()
        setNguong(luuNguong.doc())
        setLoi('')
        setThongBao('Đã về ngưỡng mặc định.')
      }} />
    </section>
  )
}

function FormNguong(props: { nguong: NguongNhom; onLuu: (n: NguongNhom) => boolean; onMacDinh: () => void }) {
  const [nhap, setNhap] = useState(() => chuoiHoa(props.nguong))

  function gui(e: FormEvent) {
    e.preventDefault()
    props.onLuu({
      ngayGanDay: Number(nhap.ngayGanDay),
      tuLanTrungThanh: Number(nhap.tuLanTrungThanh),
      tuLanThanThiet: Number(nhap.tuLanThanThiet),
      tuLanCanQuanTam: Number(nhap.tuLanCanQuanTam),
    })
  }
  const o = (khoa: keyof NguongNhom, nhan: string) => (
    <label>
      {nhan}
      <input
        value={nhap[khoa]}
        inputMode="numeric"
        onChange={(e) => setNhap({ ...nhap, [khoa]: e.target.value })}
      />
    </label>
  )
  return (
    <form className="form nk-nguong" onSubmit={gui} aria-label="Ngưỡng nhóm khách">
      <h2>Ngưỡng chia nhóm</h2>
      {o('ngayGanDay', 'Gần đây: trong (ngày)')}
      {o('tuLanTrungThanh', 'Trung thành: từ (lần)')}
      {o('tuLanThanThiet', 'Thân thiết: từ (lần)')}
      {o('tuLanCanQuanTam', 'Cần quan tâm: từ (lần, quá hạn)')}
      <div className="hang">
        <button type="submit">Lưu ngưỡng</button>
        <button type="button" className="nk-phu" onClick={props.onMacDinh}>
          Về mặc định
        </button>
      </div>
      <p className="phu">
        Tiềm năng là dưới ngưỡng Thân thiết (còn gần đây); Sắp rời bỏ là quá hạn mà ít hơn ngưỡng Cần quan tâm. Ngưỡng lưu
        trên máy này.
      </p>
    </form>
  )
}

function chuoiHoa(n: NguongNhom): Record<keyof NguongNhom, string> {
  return {
    ngayGanDay: String(n.ngayGanDay),
    tuLanTrungThanh: String(n.tuLanTrungThanh),
    tuLanThanThiet: String(n.tuLanThanThiet),
    tuLanCanQuanTam: String(n.tuLanCanQuanTam),
  }
}


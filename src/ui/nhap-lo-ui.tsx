import { useCallback, useEffect, useState } from 'react'
import {
  docBangDoiChieu,
  xuatBangDoiChieu,
  type BangDoiChieu,
  type DongSo,
  type TruongO,
} from '../core/nhap-lo.ts'
import type {
  DichVuNhapLo,
  KetQuaGhiPhieu,
  KetQuaXemTruoc,
  LoaiPhieuDuKien,
  PhieuDuKien,
  QuyetDinhNhapLo,
} from '../core/nhap-lo-service.ts'
import { LoiNghiepVu } from '../core/types.ts'
import { docNgay, hienNgay, hienTien, homNayIso } from './dinh-dang.ts'
import './nhap-lo.css'

const TEN_LOAI: Record<LoaiPhieuDuKien, string> = {
  tam: 'Phiếu tạm (chưa tính tiền)',
  'cho-tra': 'Chờ trả khách',
  'da-tra': 'Đã trả',
  'can-hoi': 'Cần hỏi, chưa ghi',
  'bo-qua': 'Bỏ qua (đã có trong KiotViet)',
  'da-nhap': 'Đã nhập trước đó',
}

function bangTrong(): BangDoiChieu {
  return { lo: `so-${homNayIso()}`, dong: [] }
}

function maMoi(dong: DongSo[]): string {
  const so = dong.map((d) => /^d(\d+)$/.exec(d.ma)?.[1]).filter(Boolean).map(Number)
  return `d${Math.max(0, ...so) + 1}`
}

/** Ô nhập có bản nháp: chỉ ghi vào bảng khi đọc được; sai thì viền đỏ. Sửa ô là bỏ tô vàng của ô đó. */
function O(props: {
  nhan: string
  gia: string
  vang: boolean
  doc: (chuoi: string) => boolean
  onDoi: (chuoi: string) => void
  inputMode?: 'numeric'
  rong?: boolean
}) {
  const [nhap, setNhap] = useState(props.gia)
  const [dangSua, setDangSua] = useState(false)
  const hienGia = dangSua ? nhap : props.gia
  const sai = dangSua && !props.doc(nhap)
  return (
    <label className={props.rong ? 'nl-rong' : undefined}>
      <span className="nl-nhan">{props.nhan}</span>
      <input
        value={hienGia}
        inputMode={props.inputMode}
        className={`${props.vang ? 'nl-vang' : ''} ${sai ? 'nl-sai' : ''}`}
        aria-invalid={sai}
        onFocus={() => {
          setNhap(props.gia)
          setDangSua(true)
        }}
        onChange={(e) => {
          setNhap(e.target.value)
          if (props.doc(e.target.value)) props.onDoi(e.target.value)
        }}
        onBlur={() => setDangSua(false)}
      />
    </label>
  )
}

function DongBang(props: {
  d: DongSo
  capNhat: (moi: DongSo) => void
  xoa: () => void
}) {
  const { d } = props
  const vang = (t: TruongO) => d.khongChac?.includes(t) === true
  /** Sửa một ô thì ô đó hết "không chắc". */
  const sua = (t: TruongO | undefined, thay: Partial<DongSo>) => {
    const conLai = (d.khongChac ?? []).filter((x) => x !== t)
    const moi = Object.fromEntries(
      Object.entries({ ...d, ...thay }).filter(([, v]) => v !== undefined),
    ) as unknown as DongSo
    if (conLai.length > 0) moi.khongChac = conLai
    else delete moi.khongChac
    props.capNhat(moi)
  }
  const chuoiNgay = (n?: string) => hienNgay(n)
  const suaNgay = (t: 'ngayNhan' | 'ngayTra', chuoi: string) => {
    const iso = docNgay(chuoi)
    if (iso) sua(t, { [t]: iso })
    else if (chuoi.trim() === '') sua(t, { [t]: undefined })
  }
  return (
    <li className="nl-dong">
      <O nhan="Khách" gia={d.khach} vang={vang('khach')} doc={() => true} onDoi={(v) => sua('khach', { khach: v.trim() })} />
      <O nhan="Ghi chú vị trí" gia={d.viTri ?? ''} vang={vang('viTri')} doc={() => true} onDoi={(v) => sua('viTri', { viTri: v.trim() || undefined })} />
      <O nhan="Mô tả" gia={d.moTa} vang={vang('moTa')} doc={() => true} onDoi={(v) => sua('moTa', { moTa: v.trim() })} rong />
      <O
        nhan="Tiền (đ)"
        gia={d.tien === undefined ? '' : String(d.tien)}
        vang={vang('tien')}
        inputMode="numeric"
        doc={(v) => v.trim() === '' || /^[\d.\s]+$/.test(v)}
        onDoi={(v) => {
          const so = Number(v.replace(/[.\s]/g, ''))
          sua('tien', { tien: v.trim() === '' || !(so > 0) ? undefined : so })
        }}
      />
      <O nhan="Ngày nhận (dd/mm/yyyy)" gia={chuoiNgay(d.ngayNhan)} vang={vang('ngayNhan')} inputMode="numeric" doc={(v) => v.trim() === '' || docNgay(v) !== undefined} onDoi={(v) => suaNgay('ngayNhan', v)} />
      <O nhan="Ngày trả (dd/mm/yyyy)" gia={chuoiNgay(d.ngayTra)} vang={vang('ngayTra')} inputMode="numeric" doc={(v) => v.trim() === '' || docNgay(v) !== undefined} onDoi={(v) => suaNgay('ngayTra', v)} />
      <O nhan="Nhóm (ngoặc nhọn)" gia={d.nhom ?? ''} vang={false} doc={() => true} onDoi={(v) => sua(undefined, { nhom: v.trim() || undefined })} />
      <div className="nl-dau">
        <label className={vang('tienMat') ? 'nl-vang' : undefined}>
          <input type="checkbox" checked={d.tienMat === true} onChange={(e) => sua('tienMat', { tienMat: e.target.checked || undefined })} />
          Tiền mặt
        </label>
        <label className={vang('chuyenKhoan') ? 'nl-vang' : undefined}>
          <input type="checkbox" checked={d.chuyenKhoan === true} onChange={(e) => sua('chuyenKhoan', { chuyenKhoan: e.target.checked || undefined })} />
          Chuyển khoản
        </label>
        <button type="button" className="nl-xoa" onClick={props.xoa} aria-label={`Xóa dòng ${d.ma}`}>
          Xóa dòng
        </button>
      </div>
      {(d.khongChac?.length ?? 0) > 0 && <p className="nl-ghi-vang">Ô tô vàng chưa chắc, để trống: điền lại hoặc sửa ô đó.</p>}
    </li>
  )
}

function PhieuXemTruoc(props: {
  p: PhieuDuKien
  quyetDinh: QuyetDinhNhapLo
  datQuyetDinh: (f: (q: QuyetDinhNhapLo) => QuyetDinhNhapLo) => void
}) {
  const { p } = props
  const chonKhach = p.khach.chon === undefined ? '' : p.khach.chon === 'moi' ? 'moi' : p.khach.chon.khachId
  const chonGhep = p.ghep?.chon === undefined ? '' : p.ghep.chon === 'tao-moi' ? 'tao-moi' : p.ghep.chon.phieuId
  const khachCan = p.khach.goiY.length > 0
  return (
    <li className={`nl-pk nl-loai-${p.loai} ${p.sanSang ? 'nl-san-sang' : ''}`}>
      <div className="nl-pk-dau">
        <strong>
          {p.khach.ten || '(thiếu tên)'}
          {p.khach.viTri ? ` (${p.khach.viTri})` : ''}
        </strong>
        <span className="nl-the">{TEN_LOAI[p.loai]}</span>
      </div>
      <div className="nl-pk-phu">
        Dòng {p.maDong.join(', ')} · {p.moTa || '(thiếu mô tả)'} · nhận {hienNgay(p.ngayNhan) || '?'}
        {p.tien !== undefined && ` · ${hienTien(p.tien)}`}
        {p.ngayTra && p.phuongThuc && ` · trả ${hienNgay(p.ngayTra)} (${p.phuongThuc === 'tien-mat' ? 'tiền mặt' : 'chuyển khoản'})`}
      </div>
      {p.lyDoHoi.map((l) => (
        <p key={l} className="nl-hoi" role="alert">
          {l}
        </p>
      ))}
      {p.canhBao.map((l) => (
        <p key={l} className="nl-canh-bao">
          {l}
        </p>
      ))}
      {p.loai === 'bo-qua' && <p className="nl-canh-bao">{p.trungVoi ? `Trùng phiếu ${p.trungVoi} đã có trong kho.` : 'Không ghi, dữ liệu này đã có trong KiotViet.'}</p>}
      {p.loai === 'da-nhap' && <p className="nl-canh-bao">Đã tạo phiếu {p.phieuDaCo} từ lần nhập trước, không tạo lại.</p>}
      {p.ghep && !p.ghep.tiepTuc && (
        <label>
          <span className="nl-nhan">Nhận trước 30/10: khớp phiếu tạm KiotViet nào?</span>
          <select
            value={chonGhep}
            onChange={(e) =>
              props.datQuyetDinh((q) => {
                const ghep = { ...q.ghep }
                if (e.target.value === '') delete ghep[p.khoa]
                else ghep[p.khoa] = e.target.value === 'tao-moi' ? 'tao-moi' : { phieuId: e.target.value }
                return { ...q, ghep }
              })
            }
          >
            <option value="">— chọn —</option>
            {p.ghep.ungVien.map((u) => (
              <option key={u.phieuId} value={u.phieuId}>
                Hoàn thành phiếu {u.phieuId}: {u.tenKhach}, nhận {hienNgay(u.ngayNhan)}
                {u.tongTien !== undefined ? `, ${hienTien(u.tongTien)}` : ', chưa có tiền'}
                {u.lechTien ? ` (lệch ${hienTien(u.lechTien)})` : ''}
              </option>
            ))}
            <option value="tao-moi">Không khớp phiếu nào: tạo phiếu mới</option>
          </select>
        </label>
      )}
      {p.ghep?.tiepTuc && <p className="nl-canh-bao">Phiếu {p.ghep.ungVien[0]?.phieuId} nhập dở từ lần trước, sẽ làm nốt.</p>}
      {khachCan && (p.loai === 'tam' || p.loai === 'cho-tra' || p.loai === 'da-tra') && !(typeof p.ghep?.chon === 'object') && (
        <label>
          <span className="nl-nhan">Khách này là ai? (xác nhận từng tên)</span>
          <select
            value={chonKhach}
            onChange={(e) =>
              props.datQuyetDinh((q) => {
                const khach = { ...q.khach }
                if (e.target.value === '') delete khach[p.khach.khoa]
                else khach[p.khach.khoa] = e.target.value === 'moi' ? 'moi' : { khachId: e.target.value }
                return { ...q, khach }
              })
            }
          >
            <option value="">— chọn —</option>
            {p.khach.goiY.map((k) => (
              <option key={k.id} value={k.id}>
                Khách cũ: {k.tenHienThi}
                {k.soDienThoai ? ` · ${k.soDienThoai}` : ' · chưa có số'}
              </option>
            ))}
            <option value="moi">Khách mới (không số điện thoại)</option>
          </select>
        </label>
      )}
      {p.loai !== 'bo-qua' && p.loai !== 'da-nhap' && !khachCan && p.loai !== 'can-hoi' && !p.ghep && (
        <p className="nl-canh-bao">Khách mới, chưa trùng ai.</p>
      )}
    </li>
  )
}

function thongBaoLoi(e: unknown): string {
  return e instanceof LoiNghiepVu ? e.message : 'Có lỗi xảy ra, thử lại.'
}

/** Màn nhập lô từ sổ: dán hoặc chọn bảng đối chiếu (hoặc gõ tay), xem trước, xác nhận, rồi mới ghi. */
export function ManNhapLo(props: { nhapLo: DichVuNhapLo; onDoi?: () => void }) {
  const { nhapLo } = props
  const [nguon, setNguon] = useState('')
  const [bang, setBang] = useState<BangDoiChieu>(bangTrong)
  const [quyetDinh, setQuyetDinh] = useState<QuyetDinhNhapLo>({})
  const [kq, setKq] = useState<KetQuaXemTruoc>()
  const [canhBaoDoc, setCanhBaoDoc] = useState<string[]>([])
  const [loi, setLoi] = useState('')
  const [daDuyet, setDaDuyet] = useState(false)
  const [ketQuaGhi, setKetQuaGhi] = useState<KetQuaGhiPhieu[]>()
  const [xuat, setXuat] = useState('')

  useEffect(() => {
    let huy = false
    nhapLo
      .xemTruoc(bang, quyetDinh)
      .then((r) => {
        if (!huy) setKq(r)
      })
      .catch((e: unknown) => {
        if (!huy) setLoi(thongBaoLoi(e))
      })
    return () => {
      huy = true
    }
  }, [nhapLo, bang, quyetDinh])

  const napTu = (chuoi: string) => {
    try {
      const { bang: moi, canhBao } = docBangDoiChieu(chuoi)
      setBang(moi)
      setQuyetDinh({})
      setCanhBaoDoc(canhBao)
      setLoi('')
      setKetQuaGhi(undefined)
      setDaDuyet(false)
    } catch (e) {
      setLoi(thongBaoLoi(e))
    }
  }

  const datQuyetDinh = useCallback((f: (q: QuyetDinhNhapLo) => QuyetDinhNhapLo) => {
    setQuyetDinh(f)
    setDaDuyet(false)
  }, [])

  const capNhatBang = (f: (d: DongSo[]) => DongSo[]) => {
    setBang((b) => ({ ...b, dong: f(b.dong) }))
    setDaDuyet(false)
  }

  async function ghi() {
    try {
      const r = await nhapLo.ghi(bang, quyetDinh, { duyet: true })
      setKetQuaGhi(r.ketQua)
      setLoi('')
      setDaDuyet(false)
      setKq(await nhapLo.xemTruoc(bang, quyetDinh))
      props.onDoi?.()
    } catch (e) {
      setLoi(thongBaoLoi(e))
    }
  }

  const chuaChonGhep = kq?.phieu.filter((p) => p.ghep && !p.ghep.tiepTuc && p.ghep.chon === undefined && p.ghep.ungVien.length === 0) ?? []

  return (
    <section className="nl" aria-label="Nhập lô từ sổ">
      <h2>Nhập lô từ sổ</h2>
      <div className="nl-khung">
        <h3>1. Bảng đối chiếu</h3>
        <p className="nl-ghi">
          Dán nội dung bảng đối chiếu (JSON do Claude xuất từ ảnh sổ) hoặc chọn file, hoặc gõ từng dòng bên dưới.
        </p>
        <textarea
          aria-label="Dán bảng đối chiếu"
          rows={4}
          value={nguon}
          onChange={(e) => setNguon(e.target.value)}
          placeholder='{"dinhDang":"bang-doi-chieu-so","phienBan":1,"lo":"...","dong":[...]}'
        />
        <div className="nl-hang">
          <button type="button" onClick={() => napTu(nguon)} disabled={nguon.trim() === ''}>
            Đọc bảng đã dán
          </button>
          <label className="nl-file">
            Chọn file
            <input
              type="file"
              accept=".json,application/json,text/plain"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void f.text().then((t) => (setNguon(t), napTu(t)))
                e.target.value = ''
              }}
            />
          </label>
          <button
            type="button"
            className="nl-phu"
            onClick={() => {
              setBang(bangTrong())
              setQuyetDinh({})
              setCanhBaoDoc([])
              setKetQuaGhi(undefined)
            }}
          >
            Bảng trống
          </button>
        </div>
        {loi && (
          <p role="alert" className="loi">
            {loi}
          </p>
        )}
        {canhBaoDoc.map((c) => (
          <p key={c} className="nl-canh-bao">
            {c}
          </p>
        ))}
      </div>

      <div className="nl-khung">
        <h3>2. Sửa bảng ({bang.dong.length} dòng)</h3>
        <label className="nl-lo">
          <span className="nl-nhan">Mã lô (cùng mã lô + mã dòng là cùng một dòng sổ, nhập lại không bị nhân đôi)</span>
          <input value={bang.lo} onChange={(e) => setBang((b) => ({ ...b, lo: e.target.value.trim() }))} />
        </label>
        <ul className="nl-bang">
          {bang.dong.map((d) => (
            <DongBang
              key={d.ma}
              d={d}
              capNhat={(moi) => capNhatBang((ds) => ds.map((x) => (x.ma === d.ma ? moi : x)))}
              xoa={() => capNhatBang((ds) => ds.filter((x) => x.ma !== d.ma))}
            />
          ))}
        </ul>
        <div className="nl-hang">
          <button
            type="button"
            onClick={() =>
              capNhatBang((ds) => {
                const truoc = ds.at(-1)
                return [...ds, { ma: maMoi(ds), khach: '', moTa: '', ...(truoc?.ngayNhan ? { ngayNhan: truoc.ngayNhan } : {}) }]
              })
            }
          >
            Thêm dòng
          </button>
          <button type="button" className="nl-phu" onClick={() => setXuat(xuatBangDoiChieu(bang))}>
            Xuất bảng ra JSON
          </button>
        </div>
        {xuat && <textarea aria-label="Bảng đối chiếu dạng JSON" rows={6} readOnly value={xuat} />}
      </div>

      <div className="nl-khung">
        <h3>3. Đối chiếu và duyệt</h3>
        {!kq || kq.phieu.length === 0 ? (
          <p>Chưa có dòng nào.</p>
        ) : (
          <>
            <p className="nl-tong" aria-live="polite">
              {kq.phieu.length} phiếu dự kiến: {kq.soSanSang} sẵn sàng ghi · {kq.tongKet['can-hoi']} cần hỏi ·{' '}
              {kq.tongKet['bo-qua']} bỏ qua · {kq.tongKet['da-nhap']} đã nhập trước đó
            </p>
            {chuaChonGhep.length > 0 && (
              <button
                type="button"
                className="nl-phu"
                onClick={() =>
                  datQuyetDinh((q) => ({
                    ...q,
                    ghep: { ...q.ghep, ...Object.fromEntries(chuaChonGhep.map((p) => [p.khoa, 'tao-moi' as const])) },
                  }))
                }
              >
                Tạo mới cho {chuaChonGhep.length} dòng không có phiếu tạm nào khớp
              </button>
            )}
            <ul className="nl-ds">
              {kq.phieu.map((p) => (
                <PhieuXemTruoc key={p.khoa} p={p} quyetDinh={quyetDinh} datQuyetDinh={datQuyetDinh} />
              ))}
            </ul>
            <label className="nl-duyet">
              <input type="checkbox" checked={daDuyet} onChange={(e) => setDaDuyet(e.target.checked)} />
              Tôi đã xem bảng đối chiếu và duyệt các phiếu sẵn sàng
            </label>
            <button type="button" disabled={!daDuyet || kq.soSanSang === 0} onClick={() => void ghi()}>
              Ghi {kq.soSanSang} phiếu sẵn sàng
            </button>
          </>
        )}
        {ketQuaGhi && (
          <div className="nl-ket-qua" role="status">
            <strong>Kết quả ghi</strong>
            <ul>
              {ketQuaGhi.length === 0 && <li>Không có phiếu nào được ghi.</li>}
              {ketQuaGhi.map((r) => (
                <li key={r.khoa}>
                  Dòng {r.maDong.join(', ')}:{' '}
                  {r.ket === 'loi'
                    ? `lỗi, ${r.loi ?? ''}`
                    : r.ket === 'da-tao'
                      ? `đã tạo/làm nốt phiếu ${r.phieuId}`
                      : `đã hoàn thành phiếu cũ ${r.phieuId}`}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  )
}

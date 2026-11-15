import type { BangDem, MucChoGui } from './bang-dem.ts'

const KHO_BAN_GHI = 'banGhi'
const KHO_CHO_GUI = 'choGui'
const KHO_META = 'meta'

type MucCho = { id: string; phienBan: number }

function yeuCau<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((xong, loi) => {
    r.onsuccess = () => xong(r.result)
    r.onerror = () => loi(r.error)
  })
}

function giaoDich(tx: IDBTransaction): Promise<void> {
  return new Promise((xong, loi) => {
    tx.oncomplete = () => xong()
    tx.onerror = () => loi(tx.error)
    tx.onabort = () => loi(tx.error)
  })
}

/** Bản đệm lưu trong IndexedDB của trình duyệt: còn nguyên khi tắt app, mở lại. */
export function taoBangDemIndexedDb<T extends { id: string }>(tenCsdl = 'giat-la-dem'): BangDem<T> {
  let dang: Promise<IDBDatabase> | undefined
  function mo(): Promise<IDBDatabase> {
    dang ??= new Promise((xong, loi) => {
      const r = indexedDB.open(tenCsdl, 1)
      r.onupgradeneeded = () => {
        const db = r.result
        db.createObjectStore(KHO_BAN_GHI, { keyPath: 'id' })
        db.createObjectStore(KHO_CHO_GUI, { keyPath: 'id' })
        db.createObjectStore(KHO_META)
      }
      r.onsuccess = () => xong(r.result)
      r.onerror = () => loi(r.error)
    })
    return dang
  }

  async function chay<T>(
    cac: string[],
    che: IDBTransactionMode,
    viec: (tx: IDBTransaction) => Promise<T>,
  ): Promise<T> {
    const tx = (await mo()).transaction(cac, che)
    const xong = giaoDich(tx)
    const kq = await viec(tx)
    await xong
    return kq
  }

  return {
    ghi: (b) =>
      chay([KHO_BAN_GHI, KHO_CHO_GUI, KHO_META], 'readwrite', async (tx) => {
        const meta = tx.objectStore(KHO_META)
        const pb = (((await yeuCau(meta.get('phienBan'))) as number | undefined) ?? 0) + 1
        meta.put(pb, 'phienBan')
        tx.objectStore(KHO_BAN_GHI).put(b)
        tx.objectStore(KHO_CHO_GUI).put({ id: b.id, phienBan: pb } satisfies MucCho)
      }),
    lay: (id) =>
      chay([KHO_BAN_GHI], 'readonly', async (tx) => {
        return (await yeuCau(tx.objectStore(KHO_BAN_GHI).get(id))) as T | undefined
      }),
    tatCa: () =>
      chay([KHO_BAN_GHI], 'readonly', async (tx) => {
        return (await yeuCau(tx.objectStore(KHO_BAN_GHI).getAll())) as T[]
      }),
    choGui: () =>
      chay([KHO_BAN_GHI, KHO_CHO_GUI], 'readonly', async (tx) => {
        const cho = (await yeuCau(tx.objectStore(KHO_CHO_GUI).getAll())) as MucCho[]
        const ra: Array<MucChoGui<T>> = []
        for (const m of cho) {
          const b = (await yeuCau(tx.objectStore(KHO_BAN_GHI).get(m.id))) as T | undefined
          if (b) ra.push({ banGhi: b, phienBan: m.phienBan })
        }
        return ra
      }),
    danhDauDaGui: (muc) =>
      chay([KHO_CHO_GUI], 'readwrite', async (tx) => {
        const kho = tx.objectStore(KHO_CHO_GUI)
        for (const m of muc) {
          const hienTai = (await yeuCau(kho.get(m.id))) as MucCho | undefined
          if (hienTai?.phienBan === m.phienBan) kho.delete(m.id)
        }
      }),
    nhanTuMayChu: (ds) =>
      chay([KHO_BAN_GHI, KHO_CHO_GUI], 'readwrite', async (tx) => {
        const cho = new Set(
          ((await yeuCau(tx.objectStore(KHO_CHO_GUI).getAllKeys())) as IDBValidKey[]).map(String),
        )
        const kho = tx.objectStore(KHO_BAN_GHI)
        for (const k of (await yeuCau(kho.getAllKeys())) as IDBValidKey[]) {
          if (!cho.has(String(k))) kho.delete(k)
        }
        for (const b of ds) if (!cho.has(b.id)) kho.put(b)
      }),
  }
}

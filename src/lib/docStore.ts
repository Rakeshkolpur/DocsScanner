import type { EnhanceOptions } from './imageEnhance'

export interface StoredPage {
  dataUrl: string
  baseDataUrl: string
  enhance: EnhanceOptions
}

export interface StoredDocument {
  id: string
  name: string
  createdAt: number
  updatedAt: number
  pages: StoredPage[]
}

const DB_NAME = 'filequik'
const DB_VERSION = 1
const STORE = 'documents'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function withStore<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode)
    const request = fn(tx.objectStore(STORE))
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
    tx.oncomplete = () => db.close()
  })
}

export async function listDocuments(): Promise<StoredDocument[]> {
  const docs = await withStore<StoredDocument[]>('readonly', (store) => store.getAll())
  return docs.sort((a, b) => b.updatedAt - a.updatedAt)
}

export async function getDocument(id: string): Promise<StoredDocument | null> {
  const doc = await withStore<StoredDocument | undefined>('readonly', (store) => store.get(id))
  return doc ?? null
}

export async function addDocument(name: string, pages: StoredPage[]): Promise<StoredDocument> {
  const now = Date.now()
  const doc: StoredDocument = {
    id: typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `${now}-${Math.random()}`,
    name,
    createdAt: now,
    updatedAt: now,
    pages,
  }
  await withStore('readwrite', (store) => store.put(doc))
  return doc
}

export async function saveDocument(doc: StoredDocument): Promise<void> {
  await withStore('readwrite', (store) => store.put({ ...doc, updatedAt: Date.now() }))
}

export async function deleteDocument(id: string): Promise<void> {
  await withStore('readwrite', (store) => store.delete(id))
}

export async function renameDocument(id: string, name: string): Promise<void> {
  const doc = await getDocument(id)
  if (!doc) return
  await saveDocument({ ...doc, name })
}

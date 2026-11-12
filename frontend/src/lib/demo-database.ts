// Payment decisions and demo balance entries share one atomic IndexedDB transaction.
export function idbResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error) })
}
export function idbComplete(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onabort = () => reject(tx.error || new Error('No changes were saved.')); tx.onerror = () => reject(tx.error) })
}
export async function openDemoDatabase(): Promise<IDBDatabase> {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const opening = indexedDB.open('lipahub-balance-preview', 2)
    opening.onupgradeneeded = () => {
      for (const [name, keyPath] of [['wallets', 'id'], ['entries', 'requestId'], ['instructions', 'country'], ['requests', 'id'], ['migrations', 'id']]) {
        if (!opening.result.objectStoreNames.contains(name)) opening.result.createObjectStore(name, { keyPath })
      }
    }
    opening.onsuccess = () => resolve(opening.result)
    opening.onerror = () => reject(new Error('Browser preview storage is unavailable.'))
  })
  try {
    if (await idbResult(db.transaction('migrations').objectStore('migrations').get('legacy-payments'))) return db
    let instructions: unknown[] = []; let requests: unknown[] = []
    if (typeof indexedDB.databases === 'function' && (await indexedDB.databases()).some(item => item.name === 'lipahub-payment-preview')) {
      const old = await new Promise<IDBDatabase>((resolve, reject) => { const opening = indexedDB.open('lipahub-payment-preview'); opening.onsuccess = () => resolve(opening.result); opening.onerror = () => reject(opening.error) })
      try {
        const tx = old.transaction(['instructions', 'requests'])
        ;[instructions, requests] = await Promise.all([idbResult(tx.objectStore('instructions').getAll()), idbResult(tx.objectStore('requests').getAll())])
      } finally { old.close() }
    }
    const tx = db.transaction(['migrations', 'instructions', 'requests'], 'readwrite'); const done = idbComplete(tx)
    if (!await idbResult(tx.objectStore('migrations').get('legacy-payments'))) {
      for (const value of instructions) tx.objectStore('instructions').put(value)
      for (const value of requests) tx.objectStore('requests').put(value)
      tx.objectStore('migrations').put({ id: 'legacy-payments' })
    }
    await done
    return db
  } catch (error) { db.close(); throw error }
}

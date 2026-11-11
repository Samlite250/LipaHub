const storageKey = 'lipahub-invitation'
const referencePattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function invitationReference(search: string): string | null {
  const query = new URLSearchParams(search)
  const supplied = query.get('ref')
  if (query.has('ref')) {
    const reference = supplied && referencePattern.test(supplied) ? supplied.toLowerCase() : null
    try {
      if (reference) sessionStorage.setItem(storageKey, JSON.stringify({ reference, expires: Date.now() + 7 * 86400000 }))
      else sessionStorage.removeItem(storageKey)
    } catch { /* A direct invitation still works when browser storage is disabled. */ }
    return reference
  }
  try {
    const saved = JSON.parse(sessionStorage.getItem(storageKey) || 'null')
    if (saved && typeof saved.reference === 'string' && referencePattern.test(saved.reference) && saved.expires > Date.now()) return saved.reference
    sessionStorage.removeItem(storageKey)
  } catch { /* Ordinary registration does not require local storage. */ }
  return null
}

export function clearInvitation() {
  try { sessionStorage.removeItem(storageKey) } catch { /* Optional browser storage. */ }
}

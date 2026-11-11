const storageKey = 'lipahub-invitation'
const referencePattern = /^[\p{L}\p{N}][\p{L}\p{N} ._'-]{1,79}$/u

export function shareInvitationReference(username: unknown, accountId: string): string {
  const name = typeof username === 'string' ? username.trim() : ''
  return referencePattern.test(name) ? name : accountId
}

export function invitationReference(search: string): string | null {
  const query = new URLSearchParams(search)
  const supplied = query.get('ref')?.trim()
  if (query.has('ref')) {
    const reference = supplied && referencePattern.test(supplied) ? supplied : null
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

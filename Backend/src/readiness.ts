import type { SupabaseClient } from '@supabase/supabase-js'

type ReadinessResult = { ready: boolean; checks: { name: string; ready: boolean }[]; checkedAt: string }

export function readinessCheck(auth: SupabaseClient | null, db: SupabaseClient | null) {
  let cached: ReadinessResult | null = null
  let pending: Promise<ReadinessResult> | null = null
  let expires = 0
  async function inspect() {
    const checks = [{ name: 'authentication_configured', ready: !!auth }, { name: 'server_storage_configured', ready: !!db }]
    if (auth && db) {
      const tables = ['system_settings', 'system_content', 'system_admin_audit', 'system_balance_accounts', 'system_balance_adjustments', 'support_tickets', 'support_messages', 'robot_payment_instructions', 'robot_activation_requests', 'robot_payment_proofs', 'robot_payment_audit']
      const tableChecks = tables.map(async table => {
        try { return { name: table, ready: !(await db.from(table).select('*', { head: true }).limit(1)).error } }
        catch { return { name: table, ready: false } }
      })
      const functionChecks = ['is_active_member', 'is_platform_admin'].map(async rpc => {
        try { return { name: rpc, ready: !(await db.rpc(rpc)).error } }
        catch { return { name: rpc, ready: false } }
      })
      const revisionCheck = (async () => {
        try {
          const { data, error } = await db.rpc('backend_schema_revision')
          return { name: 'schema_revision_8', ready: !error && Number(data) === 8 }
        } catch { return { name: 'schema_revision_8', ready: false } }
      })()
      const bucketCheck = (async () => {
        try {
          const { data, error } = await db.storage.getBucket('robot-payment-proofs')
          return { name: 'private_proof_bucket', ready: !error && !!data && data.public === false && Number(data.file_size_limit) === 5242880 && data.allowed_mime_types?.length === 2 && ['image/png', 'image/jpeg'].every(type => data.allowed_mime_types?.includes(type)) }
        } catch { return { name: 'private_proof_bucket', ready: false } }
      })()
      const invitationCheck = (async () => {
        try { return { name: 'invitation_username_lookup', ready: !(await db.rpc('resolve_invitation_username', { p_username: '__readiness__' })).error } }
        catch { return { name: 'invitation_username_lookup', ready: false } }
      })()
      const codeCheck = (async () => {
        try { return { name: 'invitation_code_lookup', ready: !(await db.rpc('resolve_invitation_code', { p_code: '__readiness__' })).error } }
        catch { return { name: 'invitation_code_lookup', ready: false } }
      })()
      const reviewCheck = (async () => {
        try { return { name: 'payment_review_version', ready: !(await db.from('robot_activation_requests').select('review_version,bonus_credited_minor', { head: true }).limit(1)).error } }
        catch { return { name: 'payment_review_version', ready: false } }
      })()
      const activationCheck = (async () => {
        try { return {name: 'rwanda_account_activation', ready: !(await db.from('rwanda_account_activations').select('user_id,activated_at', {head: true}).limit(1)).error} }
        catch { return {name: 'rwanda_account_activation', ready: false} }
      })()
      checks.push(...await Promise.all([...tableChecks, ...functionChecks, revisionCheck, bucketCheck, invitationCheck, codeCheck, reviewCheck, activationCheck]))
    }
    return { ready: checks.every(check => check.ready), checks, checkedAt: new Date().toISOString() }
  }
  return async () => {
    if (cached && Date.now() < expires) return cached
    if (!pending) pending = inspect().then(result => { cached = result; expires = Date.now() + 5000; return result }).finally(() => { pending = null })
    return pending
  }
}

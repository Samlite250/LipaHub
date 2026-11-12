import { before, after, beforeEach, afterEach, test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { createHash } from 'node:crypto'

// Actual PostgreSQL execution with minimal Supabase Auth/Storage schema fixtures.
// This does not replace testing Auth, PostgREST or Storage against Supabase itself.
const db = new PGlite()
const admin = '11111111-1111-4111-8111-111111111111'
const member = '22222222-2222-4222-8222-222222222222'
const other = '33333333-3333-4333-8333-333333333333'
const banned = '44444444-4444-4444-8444-444444444444'
const ticket = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const reply = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const requestId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'

before(async () => {
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create schema storage;
    grant usage on schema public,auth,storage to anon,authenticated,service_role;
    create table auth.users(id uuid primary key, raw_app_meta_data jsonb default '{}', banned_until timestamptz, raw_user_meta_data jsonb default '{}');
    create function auth.jwt() returns jsonb language sql stable as $$
      select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb
    $$;
    create function auth.uid() returns uuid language sql stable as $$ select (auth.jwt()->>'sub')::uuid $$;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);
    alter table storage.objects enable row level security;
    grant all on storage.objects to anon,authenticated,service_role;
    create policy unrelated_storage_policy on storage.objects for all to anon,authenticated using(true) with check(true);
    insert into auth.users values
      ('${admin}','{"role":"admin"}',null),('${member}','{}',null),('${other}','{}',null),
      ('${banned}','{"role":"admin"}','2099-01-01');
  `)
  const directory = new URL('../migrations/', import.meta.url)
  for (const name of (await readdir(directory)).filter(name => name.endsWith('.sql')).sort()) {
    try { await db.exec(await readFile(new URL(name, directory), 'utf8')) }
    catch (error) { throw new Error(`Migration ${name} failed: ${error.message}`, { cause: error }) }
  }
  await db.query(`insert into public.robot_payment_instructions(country,version,methods,updated_by)
    values('Burundi',1,$1::jsonb,$2)`, [JSON.stringify([{ id: 'test-method', enabled: true }]), admin])
  for (const [id, owner] of [[ticket, member], [reply, other]]) {
    await db.query(`insert into public.robot_activation_requests(id,user_id,country,plan_id,full_name,phone,instruction_version,payment_method,quote)
      values($1,$2,'Burundi','robot-01','Test Member','+25779000000',1,'{}','{}')`, [id, owner])
    await db.query(`insert into public.robot_payment_proofs(id,request_id,object_path,original_name,mime_type,size_bytes)
      values($1,$1,$2,'proof.png','image/png',100)`, [id, `${owner}/${id}/proof.png`])
    await db.query(`insert into storage.objects(bucket_id,name) values('robot-payment-proofs',$1)`, [`${owner}/${id}/proof.png`])
  }
}, { timeout: 60000 })
beforeEach(() => db.exec('begin'))
afterEach(() => db.exec('rollback'))
after(() => db.close())

async function role(name, user = member, claims = {}) {
  assert.ok(['postgres', 'service_role', 'authenticated', 'anon'].includes(name))
  await db.exec(`set local role ${name}`)
  await db.query(`select set_config('request.jwt.claims',$1,true)`, [JSON.stringify({ sub: user, app_metadata: claims })])
}
async function rejected(sql, values, code) {
  await db.exec('savepoint rejected_operation')
  let failure
  try { await db.query(sql, values) } catch (error) { failure = error }
  await db.exec('rollback to savepoint rejected_operation; release savepoint rejected_operation')
  assert.equal(failure?.code, code, failure?.message || 'Operation unexpectedly succeeded')
}

test('username invitations resolve case-insensitively and reject duplicate or suspended accounts', async () => {
  await db.query(`update auth.users set raw_user_meta_data = '{"username":"Cynthia","display_name":"New display name"}' where id=$1`, [member])
  let found = await db.query(`select * from public.resolve_invitation_username('cYnThIa')`)
  assert.deepEqual(found.rows, [{id: member, username: 'Cynthia'}])
  await db.query(`update auth.users set raw_user_meta_data = '{"username":"cynthia"}' where id=$1`, [other])
  assert.equal((await db.query(`select * from public.resolve_invitation_username('Cynthia')`)).rows.length, 0)
  await db.query(`update auth.users set raw_user_meta_data = '{}' where id=$1`, [other])
  await db.query(`update auth.users set banned_until = '2099-01-01' where id=$1`, [member])
  assert.equal((await db.query(`select * from public.resolve_invitation_username('Cynthia')`)).rows.length, 0)
})

test('browser roles cannot call the service-only username lookup', async () => {
  await role('anon')
  await rejected(`select * from public.resolve_invitation_username('Cynthia')`, [], '42501')
  await rejected(`select * from public.resolve_invitation_code('abcdefgh')`, [], '42501')
  await role('authenticated')
  await rejected(`select * from public.resolve_invitation_username('Cynthia')`, [], '42501')
  await rejected(`select * from public.resolve_invitation_code('abcdefgh')`, [], '42501')
})

test('short username hashes match the browser algorithm and reject duplicate or suspended inviters', async () => {
  const code = createHash('sha256').update('cynthia').digest('base64url').slice(0, 8)
  await db.query(`update auth.users set raw_user_meta_data = '{"username":"Cynthia"}' where id=$1`, [member])
  await role('service_role')
  assert.deepEqual((await db.query(`select * from public.resolve_invitation_code($1)`, [code])).rows, [{id: member, username: 'Cynthia'}])
  await role('postgres')
  await db.query(`update auth.users set raw_user_meta_data = '{"username":"cYnThIa"}' where id=$1`, [other])
  assert.equal((await db.query(`select * from public.resolve_invitation_code($1)`, [code])).rows.length, 0)
  await db.query(`update auth.users set raw_user_meta_data = '{}' where id=$1`, [other])
  await db.query(`update auth.users set banned_until = '2099-01-01' where id=$1`, [member])
  assert.equal((await db.query(`select * from public.resolve_invitation_code($1)`, [code])).rows.length, 0)
})

test('all migrations apply and every application table enables RLS', async () => {
  const { rows } = await db.query(`select relname,relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relkind='r'`)
  assert.equal(rows.length, 12)
  assert.ok(rows.every(row => row.relrowsecurity), JSON.stringify(rows))
  const bucket = (await db.query(`select * from storage.buckets where id='robot-payment-proofs'`)).rows[0]
  assert.equal(bucket.public, false)
  assert.equal(Number(bucket.file_size_limit), 5242880)
  await role('service_role')
  assert.equal((await db.query('select public.backend_schema_revision() revision')).rows[0].revision, 8)
})

test('browser roles cannot execute server-only RPCs or edit balance/support tables', async () => {
  const functions = (await db.query(`select p.oid::regprocedure::text signature from pg_proc p join pg_namespace n on p.pronamespace=n.oid
    where n.nspname='public' and p.prosecdef and p.proname not in ('is_active_member','is_platform_admin')`)).rows
  for (const { signature } of functions) {
    for (const name of ['anon', 'authenticated']) {
      assert.equal((await db.query(`select has_function_privilege($1,$2,'EXECUTE') allowed`, [name, signature])).rows[0].allowed, false, `${name}: ${signature}`)
    }
  }
  await role('authenticated')
  await rejected(`select public.create_support_ticket($1,$2,'Test subject','A private support message')`, [member, requestId], '42501')
  await rejected(`select * from public.system_balance_accounts`, [], '42501')
  await rejected(`select * from public.support_tickets`, [], '42501')
  await rejected(`select * from public.robot_payment_instructions`, [], '42501')
})

test('proof RLS isolates owners and ignores a stale administrator claim', async () => {
  await role('authenticated', member, { role: 'admin' })
  const rows = (await db.query(`select user_id from public.robot_activation_requests`)).rows
  assert.deepEqual(rows.map(row => row.user_id), [member])
  assert.equal((await db.query(`select * from public.robot_payment_proofs`)).rows.length, 1)
  assert.equal((await db.query(`select * from storage.objects where bucket_id='robot-payment-proofs'`)).rows.length, 1)
  await rejected(`insert into storage.objects(bucket_id,name) values('robot-payment-proofs','forged.png')`, [], '42501')
  await role('authenticated', admin, {})
  assert.equal((await db.query(`select * from public.robot_activation_requests`)).rows.length, 2)
})

test('suspended users cannot bypass the API to read private proof data', async () => {
  await role('authenticated', banned, { role: 'admin' })
  assert.equal((await db.query(`select * from public.robot_activation_requests`)).rows.length, 0)
  assert.equal((await db.query(`select * from storage.objects where bucket_id='robot-payment-proofs'`)).rows.length, 0)
  await role('anon')
  assert.equal((await db.query(`select * from storage.objects where bucket_id='robot-payment-proofs'`)).rows.length, 0)
})

test('support RPCs enforce ownership, idempotency, versions and closed tickets', async () => {
  await role('service_role')
  const create = `select public.create_support_ticket($1,$2,'A support question','A private support message') item`
  const first = (await db.query(create, [member, requestId])).rows[0].item
  assert.deepEqual((await db.query(create, [member, requestId])).rows[0].item, first)
  await rejected(`select public.reply_support_ticket($1,$2,$3,'Not my ticket',1)`, [other, requestId, reply], '42501')
  const respond = `select public.reply_support_ticket($1,$2,$3,'More details',1) item`
  assert.equal((await db.query(respond, [member, requestId, reply])).rows[0].item.version, 2)
  assert.equal((await db.query(respond, [member, requestId, reply])).rows[0].item.version, 2)
  await rejected(`select public.reply_support_ticket($1,$2,$3,'Conflicting retry',1)`, [member, requestId, reply], '23505')
  await db.query(`select public.set_support_ticket_status($1,$2,'closed',2)`, [admin, requestId])
  await rejected(`select public.reply_support_ticket($1,$2,$3,'Late reply',3)`, [member, requestId, ticket], '22023')
  assert.equal((await db.query(`select * from public.support_messages where ticket_id=$1`, [requestId])).rows.length, 2)
})

test('balance adjustments are idempotent, reject stale writes and conserve the clearing ledger', async () => {
  await role('service_role')
  const adjust = `select public.adjust_system_balance($1,$2,'Rwanda',$3,5,'Verified correction',0,$4) item`
  const parameters = [admin, member, 100, requestId]
  const first = (await db.query(adjust, parameters)).rows[0].item
  assert.equal(Number(first.available_minor), 100)
  assert.equal((await db.query(adjust, parameters)).rows[0].item.version, 1)
  await rejected(adjust, [admin, member, 101, requestId], '23505')
  await rejected(adjust, [admin, member, 101, reply], '40001')
  await rejected(adjust, [member, member, 100, ticket], '42501')
  await role('postgres')
  const count = (await db.query(`select count(*)::integer count from public.system_balance_adjustments where user_id=$1`, [member])).rows[0].count
  assert.equal(count, 1)
  const total = (await db.query(`select (select sum(available_minor+bonus_minor) from public.system_balance_accounts where currency='RWF') +
    (select balance_minor from public.system_balance_clearing where currency='RWF') total`)).rows[0].total
  assert.equal(Number(total), 0)
})

test('worldwide country constraints and USD fallback survive the complete migration chain', async () => {
  await role('service_role')
  const value = (await db.query(`select public.adjust_system_balance($1,$2,'Japan',100,0,'Verified correction',0,$3) item`, [admin, member, requestId])).rows[0].item
  assert.equal(value.country, 'Japan')
  assert.equal(value.currency, 'USD')
  await rejected(`select public.adjust_system_balance($1,$2,'Unknown',100,0,'Verified correction',0,$3)`, [admin, member, ticket], '22023')
})

test('payment instruction RPC rejects suspended administrators', async () => {
  await role('service_role')
  await rejected(`select public.save_robot_payment_instructions('Burundi','[]',1,$1)`, [banned], '42501')
})

async function paymentQuote(value = {currency: 'BIF', bonusMinor: 261000, bonus: 261000, value: 60000}) {
  await db.query(`update public.robot_activation_requests set quote=$1::jsonb where id=$2`, [JSON.stringify(value), ticket])
}
test('payment approval atomically credits the saved bonus exactly once and conserves clearing', async () => {
  await paymentQuote()
  await role('service_role')
  await db.query(`select public.review_robot_activation_request($1,'verified','Payment matched',$2,1)`, [ticket, admin])
  const wallet = (await db.query(`select * from public.system_balance_accounts where user_id=$1 and country='Burundi'`, [member])).rows[0]
  assert.equal(Number(wallet.bonus_minor), 261000)
  assert.equal(Number(wallet.available_minor), 0)
  await db.query(`select public.review_robot_activation_request($1,'verified','Payment matched',$2,1)`, [ticket, admin])
  assert.equal((await db.query(`select * from public.system_balance_adjustments where request_id=$1`, [ticket])).rows.length, 1)
  const state = (await db.query(`select status,review_version,bonus_credited_minor from public.robot_activation_requests where id=$1`, [ticket])).rows[0]
  assert.equal(state.status, 'verified'); assert.equal(state.review_version, 2); assert.equal(Number(state.bonus_credited_minor), 261000)
  await role('postgres')
  const clearing = (await db.query(`select balance_minor from public.system_balance_clearing where currency='BIF'`)).rows[0]
  assert.equal(Number(clearing.balance_minor) + Number(wallet.bonus_minor), 0)
  assert.equal((await db.query(`select * from public.robot_payment_audit where target_id=$1 and action='payment_approved_bonus_credited'`, [ticket])).rows.length, 1)
  await rejected(`select public.review_robot_activation_request($1,'rejected','Different decision',$2,2)`, [ticket, admin], '40001')
})
test('payment reviews reject unauthorized actors, missing proof and stale decisions', async () => {
  await paymentQuote()
  await role('service_role')
  for (const actor of [member, banned]) await rejected(`select public.review_robot_activation_request($1,'verified','Payment matched',$2,1)`, [ticket, actor], '42501')
  await rejected(`select public.review_robot_activation_request($1,'verified','',$2,1)`, [ticket, admin], '22023')
  await db.query(`select public.review_robot_activation_request($1,'under_review','Checking',$2,1)`, [ticket, admin])
  await rejected(`select public.review_robot_activation_request($1,'verified','Payment matched',$2,1)`, [ticket, admin], '40001')
  await role('postgres')
  await db.query(`delete from public.robot_payment_proofs where request_id=$1`, [ticket])
  await role('service_role')
  await rejected(`select public.review_robot_activation_request($1,'verified','Payment matched',$2,2)`, [ticket, admin], '22023')
  assert.equal((await db.query(`select * from public.system_balance_adjustments`)).rows.length, 0)
})
test('rejection never credits a bonus and a final rejection cannot be approved', async () => {
  await paymentQuote()
  await role('service_role')
  await db.query(`select public.review_robot_activation_request($1,'rejected','Payment not received',$2,1)`, [ticket, admin])
  await rejected(`select public.review_robot_activation_request($1,'verified','Changed decision',$2,2)`, [ticket, admin], '40001')
  assert.equal((await db.query(`select * from public.system_balance_accounts`)).rows.length, 0)
})
test('approval preserves minor-unit precision and rolls back invalid bonuses', async () => {
  await paymentQuote({currency: 'BIF', bonusMinor: -1, bonus: -1, value: 60000})
  await role('service_role')
  await rejected(`select public.review_robot_activation_request($1,'verified','Payment matched',$2,1)`, [ticket, admin], '22023')
  assert.equal((await db.query(`select * from public.system_balance_accounts`)).rows.length, 0)
  await role('postgres')
  await db.query(`insert into public.robot_payment_instructions(country,version,methods,updated_by) values('International',1,'[]',$1)`, [admin])
  await db.query(`update public.robot_activation_requests set country='International' where id=$1`, [ticket])
  await paymentQuote({currency: 'USD', bonusMinor: 12345, bonus: 123.45, value: 30})
  await role('service_role')
  await db.query(`select public.review_robot_activation_request($1,'verified','Payment matched',$2,1)`, [ticket, admin])
  const wallet = (await db.query(`select * from public.system_balance_accounts where user_id=$1`, [member])).rows[0]
  assert.equal(wallet.currency, 'USD'); assert.equal(Number(wallet.bonus_minor), 12345)
})
test('a bonus balance limit failure leaves the payment pending and the ledger unchanged', async () => {
  await paymentQuote()
  await role('service_role')
  await db.query(`select public.adjust_system_balance($1,$2,'Burundi',0,1000000000000,'Test existing bonus balance',0,$3)`, [admin, member, requestId])
  await rejected(`select public.review_robot_activation_request($1,'verified','Payment matched',$2,1)`, [ticket, admin], '22023')
  assert.equal((await db.query(`select status from public.robot_activation_requests where id=$1`, [ticket])).rows[0].status, 'pending_review')
  assert.equal((await db.query(`select * from public.system_balance_adjustments`)).rows.length, 1)
})

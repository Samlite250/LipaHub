import { expect, test } from '@playwright/test'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import type { AddressInfo } from 'node:net'
import { createApp } from '../Backend/src/app'
import { readConfig } from '../Backend/src/config'

test('Rwanda activation blocks private APIs and verifies screenshots and the server-configured amount', async ({request}) => {
  const id = '55555555-5555-4555-8555-555555555555'
  const user = {id,app_metadata:{activation_required:true},user_metadata:{country:'Kenya',paid:true,role:'admin'}} as unknown as User
  let active = false; let uploads = 0; let authCalls = 0
  let receipt: Record<string, unknown> | null = null
  let submitted: Record<string, unknown> | null = null
  const method = {id:'rwanda-1',name:'MTN',enabled:true,recipient:'TEST-NOT-REAL',amountMinor:6500,instructions:'TEST instructions only'}
  const auth = {auth:{getUser:async (token:string) => {authCalls++; return {data:{user: token==='admin-token' ? {...user,app_metadata:{role:'admin',activation_required:true}} : token==='legacy-token' ? {...user,id:'88888888-8888-4888-8888-888888888888',app_metadata:{}} : user},error:null}}}} as unknown as SupabaseClient
  const db = {from:(table:string) => {
    const filters: Record<string,unknown> = {}
    const row = () => table==='rwanda_account_activations' ? (filters.user_id===id ? {activated_at:active?'2026-11-12T10:00:00Z':null}:null) : table==='robot_payment_instructions' ? {country:'Rwanda',version:1,methods:[method]} : table==='robot_activation_requests' ? receipt : null
    const query = {select:()=>query,eq:(key:string,value:unknown)=>{filters[key]=value;return query},order:()=>query,limit:async()=>({data:table==='robot_activation_requests' ? (receipt?[receipt]:[]) : table==='robot_payment_instructions'?[row()]:[],error:null}),maybeSingle:async()=>({data:row(),error:null}),single:async()=>({data:row(),error:null})}
    return query
  },storage:{from:()=>({upload:async()=>{uploads++;return {error:null}},remove:async()=>({error:null})})},rpc:async(_name:string,args:{p_actor:string;p_payload:Record<string,unknown>})=>{submitted=args.p_payload;receipt={...args.p_payload,user_id:args.p_actor,status:'pending_review',review_version:1,robot_payment_proofs:[]};return {error:null}}} as unknown as SupabaseClient
  const server = createApp({...readConfig({}),proofIntake:true},{auth,service:db}).listen(0,'127.0.0.1')
  if(!server.listening) await new Promise<void>(resolve=>server.once('listening',resolve))
  const root=`http://127.0.0.1:${(server.address() as AddressInfo).port}/api`
  const headers={Authorization:'Bearer pending-token'}
  try {
    for(const path of ['/me','/member-content','/member-balances?country=Kenya','/robot-payments/requests']) {
      const denied=await request.get(root+path,{headers});expect(denied.status()).toBe(403);expect((await denied.json()).activationRequired).toBe(true)
    }
    const status=await request.get(root+'/account-activation?userId=another-account',{headers})
    expect(status.status()).toBe(200);expect(await status.json()).toMatchObject({required:true,active:false})
    const body={purpose:'account_activation',country:'Rwanda',planId:'account-activation',methodId:'rwanda-1',instructionVersion:1,fullName:'Ish Example',phone:'+250790000000',quote:{value:1,bonus:999999},files:[] as unknown[]}
    expect((await request.post(root+'/robot-payments/requests',{headers,data:body})).status()).toBe(400);expect(uploads).toBe(0)
    body.files=[{name:'TEST-NOT-PAYMENT.png',type:'image/png',contentBase64:'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aMr8AAAAASUVORK5CYII='}]
    expect((await request.post(root+'/robot-payments/requests',{headers,data:body})).status()).toBe(201)
    expect(submitted).toMatchObject({purpose:'account_activation',quote:{value:6500,valueMinor:6500,bonus:0,bonusMinor:0,currency:'RWF'}})
    expect((await request.get(root+'/member-balances?country=Rwanda',{headers})).status()).toBe(403)
    active=true
    const before=authCalls
    const balance=await request.get(root+'/member-balances?country=Rwanda',{headers})
    expect(balance.status()).toBe(200);expect(authCalls-before).toBe(1)
    expect((await request.get(root+'/account-activation',{headers:{Authorization:'Bearer legacy-token'}})).status()).toBe(200)
    expect((await request.get(root+'/robot-payments/instructions/Rwanda',{headers:{Authorization:'Bearer admin-token'}})).status()).toBe(200)
  } finally {await new Promise<void>(resolve=>{server.close(()=>resolve());server.closeIdleConnections()})}
})

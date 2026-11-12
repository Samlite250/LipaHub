import { expect, test, type Page } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import { defaultSettings } from '../../frontend/src/domain/admin'

function session() {
  const id = '55555555-5555-4555-8555-555555555555'
  const exp = Math.floor(Date.now() / 1000) + 3600
  const access_token = `${Buffer.from(JSON.stringify({alg: 'HS256', typ: 'JWT'})).toString('base64url')}.${Buffer.from(JSON.stringify({sub: id, aud: 'authenticated', role: 'authenticated', exp})).toString('base64url')}.controlled-signature`
  return {access_token, refresh_token: 'controlled-refresh-token', token_type: 'bearer', expires_in: 3600, expires_at: exp,
    user: {id, aud: 'authenticated', role: 'authenticated', email: 'controlled@example.invalid', created_at: new Date().toISOString(), app_metadata: {provider: 'email', providers: ['email'], activation_required: true}, user_metadata: {username: 'Ish', display_name: 'Ish', country: 'Rwanda', phone: '+250790000000'}}}
}
async function harness(page: Page, loggedIn = true) {
  const saved = session()
  const state = {active: false, request: null as Record<string, unknown> | null, submissions: 0, methodVersion: 1}
  if (loggedIn) await page.addInitScript(saved => localStorage.setItem('sb-pzxmfdqfsoltoqgflxcm-auth-token', JSON.stringify(saved)), saved)
  const headers = {'Access-Control-Allow-Origin': 'http://127.0.0.1:5213', 'Access-Control-Allow-Headers': 'authorization,content-type,apikey,x-client-info,x-supabase-api-version', 'Access-Control-Allow-Methods': 'GET,POST,PUT,OPTIONS'}
  await page.route('**/auth/v1/**', async route => {
    if (route.request().method() === 'OPTIONS') { await route.fulfill({status: 204, headers}); return }
    const path = new URL(route.request().url()).pathname
    if (path.endsWith('/signup')) saved.user.user_metadata = {...saved.user.user_metadata, ...route.request().postDataJSON().data}
    if (path.endsWith('/user')) await route.fulfill({json: {...saved.user, app_metadata: {...saved.user.app_metadata, activation_required: !state.active}}, headers})
    else if (path.endsWith('/logout')) await route.fulfill({json: {}, headers})
    else await route.fulfill({json: saved, headers})
  })
  const methods = ['MTN','Airtel'].map((name, index) => ({id: `rwanda-${index+1}`, name, recipient: 'TEST-DO-NOT-PAY', accountName: 'Test recipient', asset: '', network: '', instructions: 'TEST ONLY. Do not send money. Follow the operator instructions here.', enabled: true, amountMinor: 6500}))
  await page.route('**/api/**', async route => {
    if (route.request().method() === 'OPTIONS') { await route.fulfill({status: 204, headers}); return }
    const path = new URL(route.request().url()).pathname
    if (path === '/api/account-activation') { await route.fulfill({headers, json: {required: true, active: state.active, request: state.request, instructions: {country: 'Rwanda',version: state.methodVersion,intakeEnabled: true,methods}}}); return }
    if (path === '/api/robot-payments/requests' && route.request().method() === 'POST') {
      const body = route.request().postDataJSON()
      expect(body.purpose).toBe('account_activation'); expect(body.country).toBe('Rwanda'); expect(body.planId).toBe('account-activation')
      expect(body.fullName).toBe('Ish Example'); expect(body.phone).toBe('+250790000000'); expect(body.files).toHaveLength(1)
      state.submissions++
      state.request = {id: '66666666-6666-4666-8666-666666666666', purpose: 'account_activation', userId: saved.user.id, country: 'Rwanda', planId: 'account-activation',status: 'pending_review',fullName: body.fullName,phone: body.phone,reviewNote:'',quote: {value:6500,valueMinor:6500,bonus:0,bonusMinor:0,currency:'RWF'},paymentMethod:methods[0],files:[{id:'test-file',name:'TEST-NOT-PAYMENT.png'}],submittedAt: new Date().toISOString()}
      await route.fulfill({status: 201, headers, json: state.request}); return
    }
    if (path === '/api/member-balances') { await route.fulfill({headers, json:{userId:saved.user.id,country:'Rwanda',currency:'RWF',availableMinor:0,bonusMinor:0,version:0,updatedAt:null}}); return }
    if (path === '/api/member-content') { await route.fulfill({headers, json:{records:[],settings:defaultSettings}}); return }
    await route.fulfill({status:404, headers, json:{error:'Controlled test endpoint not configured'}})
  })
  return state
}

test('new Rwanda signup opens the payment page and direct dashboard navigation stays blocked', async ({page}, info) => {
  await harness(page, false)
  await page.goto('/register')
  await page.locator('input[name=username]').fill('Ish')
  await page.locator('input[name=phone]').fill('790000000')
  await page.locator('input[name=email]').fill('controlled@example.invalid')
  await page.locator('input[name=password]').fill('test-1234')
  await page.locator('input[name=confirm]').fill('test-1234')
  await page.locator('input[name=terms]').check()
  await page.locator('button.auth-submit').click()
  await expect(page).toHaveURL('/activate-account')
  await expect(page.getByRole('button',{name:'PAY WITH MTN'})).toBeVisible()
  await expect(page.getByRole('button',{name:'PAY WITH AIRTEL'})).toBeVisible()
  await page.goto('/dashboard/profile')
  await expect(page).toHaveURL('/activate-account')
  await expect(page.locator('.dashboard-shell')).toHaveCount(0)
  await expect(page.getByRole('link',{name:'Go to Dashboard'})).toHaveCount(0)
  await mkdir(`artifacts/screenshots/${process.env.LIPAHUB_SCREENSHOT_RUN}`,{recursive:true})
  await page.screenshot({path:`artifacts/screenshots/${process.env.LIPAHUB_SCREENSHOT_RUN}/${info.project.name}-rwanda-activation-options.png`,fullPage:true})
})
test('phone and screenshot submission stay pending until approval unlocks the dashboard', async ({page}, info) => {
  const state = await harness(page)
  await page.goto('/activate-account')
  await page.getByRole('button',{name:'PAY WITH MTN'}).click()
  await expect(page.locator('.activation-amount')).toContainText('6,500')
  await expect(page.locator('.activation-recipient')).toContainText('TEST-DO-NOT-PAY')
  await page.getByLabel('First name',{exact:true}).fill('Ish')
  await page.getByLabel('Last name',{exact:true}).fill('Example')
  await page.getByLabel('Phone number',{exact:true}).fill('+250790000000')
  await expect(page.getByRole('button',{name:'Submit payment proof'})).toBeDisabled()
  const image = await page.screenshot()
  await page.locator('input[type=file]').setInputFiles({name:'TEST-NOT-PAYMENT.png',mimeType:'image/png',buffer:image})
  await page.getByRole('checkbox').check()
  await mkdir(`artifacts/screenshots/${process.env.LIPAHUB_SCREENSHOT_RUN}`,{recursive:true})
  await page.screenshot({path:`artifacts/screenshots/${process.env.LIPAHUB_SCREENSHOT_RUN}/${info.project.name}-rwanda-payment-proof.png`,fullPage:true})
  await page.getByRole('button',{name:'Submit payment proof'}).click()
  await expect(page.getByRole('heading',{name:'Payment proof submitted'})).toBeVisible()
  expect(state.submissions).toBe(1)
  await page.goto('/dashboard')
  await expect(page).toHaveURL('/activate-account')
  await expect(page.getByRole('button',{name:'Check payment status'})).toBeVisible()
  state.active = true
  state.request = {...state.request, status:'verified'}
  await page.getByRole('button',{name:'Check payment status'}).click()
  await expect(page).toHaveURL('/dashboard')
  await expect(page.locator('.dashboard-shell')).toBeVisible()
  await expect(page.locator('.expense-tile')).toContainText('RF 6,500')
})
test('Airtel, language selection and 320px payment layout are usable', async ({page}) => {
  await harness(page)
  await page.goto('/activate-account')
  await page.getByRole('button',{name:'PAY WITH AIRTEL'}).click()
  await expect(page.getByRole('heading',{name:'Rwanda Airtel'})).toBeVisible()
  await page.getByRole('button',{name:'Kinyarwanda',exact:true}).click()
  await expect(page.getByRole('heading',{name:'Fungura konti yawe'})).toBeVisible()
  await page.setViewportSize({width:320,height:740})
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth<=innerWidth)).toBeTruthy()
})

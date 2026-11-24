import { webkit } from 'playwright-core'

const CASE_ID = 'bfdf1952-b20d-4724-8b22-7aae96104c5e'
const browser = await webkit.launch({ headless: true })
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  isMobile: true, hasTouch: true,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
})
const page = await ctx.newPage()
const errors = []
page.on('pageerror', e => errors.push(`PAGEERROR: ${e.message}\n${(e.stack||'').slice(0,500)}`))
page.on('console', m => { if (m.type() === 'error') errors.push(`CONSOLE: ${m.text().slice(0,300)}`) })

await page.goto('http://localhost:3100/login', { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(1000)
await page.fill('input[type="email"], input[name="email"]', 'devin-test@nexus.local')
await page.fill('input[type="password"], input[name="password"]', 'TestPass123!')
await page.click('button[type="submit"], form button')
await page.waitForTimeout(4000)
console.log('logged in:', page.url())

await page.goto(`http://localhost:3100/cases/${CASE_ID}/progress`, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(7000)
console.log('final url:', page.url())
await page.screenshot({ path: 'repro-webkit.png' })
console.log('---BODY---')
console.log((await page.evaluate(() => document.body.innerText.slice(0, 300))))
console.log('---ERRORS---')
errors.forEach(e => console.log(e))
console.log(`(${errors.length} errors)`)
await browser.close()

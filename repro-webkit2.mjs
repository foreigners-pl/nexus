import { webkit } from 'playwright-core'

const browser = await webkit.launch({ headless: true })
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  isMobile: true, hasTouch: true,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
})
const page = await ctx.newPage()
const errors = []
page.on('pageerror', e => errors.push(`PAGEERROR: ${e.message}\n${(e.stack||'').slice(0,600)}`))
page.on('console', m => { if (m.type() === 'error') errors.push(`CONSOLE: ${m.text().slice(0,300)}`) })

await page.goto('http://localhost:3100/login', { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(1000)
await page.fill('input[type="email"], input[name="email"]', 'devin-test@nexus.local')
await page.fill('input[type="password"], input[name="password"]', 'TestPass123!')
await page.click('button[type="submit"], form button')
await page.waitForTimeout(4000)

// Deep link to a later step (?s=) — exercises navTo on mount
await page.goto('http://localhost:3100/cases/bfdf1952-b20d-4724-8b22-7aae96104c5e/progress?s=foo', { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(5000)
console.log('?s= bogus:', page.url(), errors.length, 'errors')
errors.forEach(e => console.log(e))

// real step id
const steps = await page.evaluate(async () => {
  return 'needs-real-id'
})
await page.goto('http://localhost:3100/cases/bfdf1952-b20d-4724-8b22-7aae96104c5e/progress?s=81249ba0-355c-4481-b8f8-718ea527beda', { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(5000)
console.log('?s= step1:', errors.length, 'errors')
errors.forEach(e => console.log(e))

// swipe steps via touch — dispatch real gestures
await page.touchscreen.tap(195, 400)
await page.waitForTimeout(800)
await page.evaluate(() => window.dispatchEvent(new Event('resize')))
await page.waitForTimeout(2000)
console.log('after interactions:', errors.length, 'errors')
errors.forEach(e => console.log(e))
await browser.close()

import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { waitForExploreLoaded } from './helpers'

/**
 * Automated a11y sweep (axe-core) on every top-level page, plus a couple of
 * manual keyboard-navigation checks axe can't cover. Chromium-only — an axe
 * scan of the DOM doesn't meaningfully vary by rendering engine, and running
 * it 6x would just slow the suite down for no extra signal.
 */
test.describe('Accessibility', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'DOM-level a11y scan; no need to repeat per engine')

  const pages: { name: string; path: string; setup?: (page: import('@playwright/test').Page) => Promise<void> }[] = [
    { name: 'Home', path: '/' },
    {
      name: 'Explore',
      path: '/explore',
      setup: async (page) => waitForExploreLoaded(page),
    },
    { name: 'Copilot (empty)', path: '/copilot' },
    { name: 'Shortlist (empty)', path: '/shortlist' },
    { name: 'Compare (empty)', path: '/compare' },
    { name: '404', path: '/no-such-route' },
  ]

  for (const { name, path, setup } of pages) {
    test(`${name} has no serious/critical axe violations`, async ({ page }) => {
      await page.goto(path)
      if (setup) await setup(page)
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa'])
        .analyze()

      const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
      if (serious.length > 0) {
        const summary = serious
          .map((v) => `${v.id} (${v.impact}): ${v.help} — ${v.nodes.length} node(s)`)
          .join('\n')
        expect(serious, `Serious/critical a11y violations on ${name}:\n${summary}`).toEqual([])
      }
    })
  }

  test('property detail page has no serious/critical axe violations', async ({ page }) => {
    await page.goto('/explore')
    await waitForExploreLoaded(page)
    await page.locator('article a').first().click()
    await expect(page).toHaveURL(/\/property\//)
    // Let the page's entrance fade (framer-motion, ~0.4s) settle before
    // scanning — axe reads computed styles mid-transition otherwise, which
    // misreports transiently low contrast that no real user ever sees.
    await page.getByRole('heading', { level: 1 }).waitFor({ state: 'visible' })
    await page.waitForTimeout(600)
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
    const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
    expect(serious, serious.map((v) => v.id).join(', ')).toEqual([])
  })

  test('keyboard: Tab reaches the primary nav and skips nothing invisible', async ({ page }) => {
    await page.goto('/')
    await page.keyboard.press('Tab')
    const first = await page.evaluate(() => document.activeElement?.textContent?.trim())
    expect(first).toBeTruthy()

    // Tab through the header a bunch of times; every focused element should
    // be visible (no focus landing on a hidden/off-screen node).
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press('Tab')
      const visible = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null
        if (!el || el === document.body) return true
        const rect = el.getBoundingClientRect()
        return rect.width > 0 && rect.height > 0
      })
      expect(visible).toBe(true)
    }
  })

  test('interactive icon-only controls have accessible names', async ({ page }) => {
    await page.goto('/explore')
    await waitForExploreLoaded(page)
    const shortlistBtn = page.locator('article').first().getByRole('button', { name: /shortlist/i })
    await expect(shortlistBtn).toBeVisible()
    const themeToggle = page.getByRole('button', { name: /Toggle theme/i })
    await expect(themeToggle).toBeVisible()
  })
})

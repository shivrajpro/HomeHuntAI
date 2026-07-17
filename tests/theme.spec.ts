import { test, expect } from '@playwright/test'

test.describe('Theme', () => {
  test('defaults to dark mode', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('html')).toHaveClass(/dark/)
  })

  test('toggling theme switches the html class and persists across reload', async ({ page }) => {
    await page.goto('/')
    const toggle = page.getByRole('button', { name: /Toggle theme/i })
    await toggle.click()
    await expect(page.locator('html')).not.toHaveClass(/dark/)

    await page.reload()
    await expect(page.locator('html')).not.toHaveClass(/dark/)

    await toggle.click()
    await expect(page.locator('html')).toHaveClass(/dark/)
  })

  test('theme choice is written to localStorage under the expected key', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: /Toggle theme/i }).click()
    const stored = await page.evaluate(() => window.localStorage.getItem('theme'))
    expect(stored).toBe('light')
  })
})

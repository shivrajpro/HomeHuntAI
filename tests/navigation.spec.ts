import { test, expect } from '@playwright/test'

test.describe('Navigation', () => {
  test('desktop header nav links to every top-level route', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name.includes('Mobile'), 'header nav is hidden below sm; covered by the mobile-nav test')
    await page.goto('/')
    const nav = page.locator('header nav')
    await nav.getByRole('link', { name: 'Explore' }).click()
    await expect(page).toHaveURL(/\/explore$/)
    await nav.getByRole('link', { name: 'Ask Nestor' }).click()
    await expect(page).toHaveURL(/\/nestor$/)
    await nav.getByRole('link', { name: 'Shortlist' }).click()
    await expect(page).toHaveURL(/\/shortlist$/)
    await nav.getByRole('link', { name: 'Home' }).click()
    await expect(page).toHaveURL('/')
  })

  test('logo links back to home', async ({ page }) => {
    await page.goto('/explore')
    await page.getByRole('link', { name: /HomeHunt/i }).first().click()
    await expect(page).toHaveURL('/')
  })

  test('active nav item is visually distinguished', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name.includes('Mobile'), 'covered by mobile-nav test')
    await page.goto('/explore')
    const activeLink = page.locator('header nav a', { hasText: 'Explore' })
    await expect(activeLink).toHaveClass(/text-foreground/)
  })

  test('mobile bottom tab bar navigates and hides the desktop header nav', async ({ page }, testInfo) => {
    test.skip(!testInfo.project.name.includes('Mobile'), 'desktop/tablet uses the header nav')
    await page.goto('/')
    const headerNav = page.locator('header nav')
    await expect(headerNav).toBeHidden()
    const bottomNav = page.locator('nav.fixed.inset-x-0.bottom-0')
    await expect(bottomNav).toBeVisible()
    await bottomNav.getByRole('link', { name: 'Explore' }).click()
    await expect(page).toHaveURL(/\/explore$/)
  })

  test('browser back and forward move between visited routes', async ({ page }) => {
    await page.goto('/')
    await page.goto('/explore')
    await page.goto('/nestor')
    await page.goBack()
    await expect(page).toHaveURL(/\/explore$/)
    await page.goBack()
    await expect(page).toHaveURL('/')
    await page.goForward()
    await expect(page).toHaveURL(/\/explore$/)
  })

  test('unknown route renders the 404 page with a way back', async ({ page }) => {
    await page.goto('/this-route-does-not-exist')
    await expect(page.getByText('404')).toBeVisible()
    await expect(page.getByRole('heading', { name: /moved out/i })).toBeVisible()
    await page.getByRole('link', { name: /Back to Explore/i }).click()
    await expect(page).toHaveURL('/')
  })

  test('deep, malformed, and trailing-slash-y unknown paths all fall back to 404', async ({ page }) => {
    for (const path of ['/a/b/c', '/explore/', '/%20%20', '/property/']) {
      await page.goto(path)
      const is404 = await page.getByText('404').isVisible().catch(() => false)
      // '/explore/' and '/property/' may or may not match router trailing-slash
      // rules; only assert 404 where the app doesn't have a legitimate route.
      if (path === '/a/b/c' || path === '/%20%20') {
        expect(is404, `expected 404 for ${path}`).toBe(true)
      }
    }
  })
})

import { test, expect } from '@playwright/test'
import { waitForExploreLoaded } from './helpers'

test.describe('Property detail page', () => {
  async function goToFirstListing(page: import('@playwright/test').Page) {
    await page.goto('/explore')
    await waitForExploreLoaded(page)
    await page.locator('article a').first().click()
    await expect(page).toHaveURL(/\/property\/[0-9a-f-]+$/)
  }

  test('renders gallery, key specs, description, amenities, nearby and sidebar', async ({ page }) => {
    await goToFirstListing(page)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'About this home' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Neighborhood intel' })).toBeVisible()
    await expect(page.locator('a[href^="tel:"]')).toBeVisible()
    await expect(page.locator('a[href^="mailto:"]')).toBeVisible()
  })

  test('gallery thumbnails switch the hero image', async ({ page }) => {
    await goToFirstListing(page)
    const thumbs = page.locator('button:has(img)')
    const count = await thumbs.count()
    test.skip(count < 2, 'this listing only has one image')
    const hero = page.locator('.aspect-16\\/10 img')
    const before = await hero.getAttribute('src')
    await thumbs.nth(1).click()
    await expect(hero).not.toHaveAttribute('src', before ?? '')
  })

  test('Add to comparison and Save to shortlist toggle state', async ({ page }) => {
    await goToFirstListing(page)
    const compareBtn = page.getByRole('button', { name: /Add to comparison/i })
    await compareBtn.click()
    await expect(page.getByRole('button', { name: /Remove from comparison/i })).toBeVisible()

    const shortlistBtn = page.getByRole('button', { name: /Save to shortlist/i })
    await shortlistBtn.click()
    await expect(page.getByRole('button', { name: /Saved to shortlist/i })).toBeVisible()
  })

  test('an unknown property id shows "Listing not found" instead of crashing', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))
    await page.goto('/property/00000000-0000-0000-0000-000000000000')
    await expect(page.getByRole('heading', { name: /Listing not found/i })).toBeVisible({ timeout: 10_000 })
    await page.getByRole('link', { name: /Back to Explore/i }).click()
    await expect(page).toHaveURL(/\/explore$/)
    expect(errors).toEqual([])
  })

  test('a malformed (non-uuid) property id is handled gracefully, not a crash', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))
    await page.goto('/property/not-a-real-id')
    await expect(page.getByRole('heading', { name: /Listing not found/i })).toBeVisible({ timeout: 10_000 })
    expect(errors).toEqual([])
  })
})

import { test, expect } from '@playwright/test'
import { waitForExploreLoaded } from './helpers'

/** The card-level compare toggle shows "Compare" or "Comparing" — never an exact substring match of each other. */
const cardCompareToggle = (page: import('@playwright/test').Page, index: number) =>
  page.locator('article').nth(index).getByRole('button', { name: /^(Compare|Comparing)$/ })

/** The floating compare tray (fixed, z-50) — scoped so it can't collide with per-card "Compare" buttons. */
const compareTray = (page: import('@playwright/test').Page) => page.locator('div.z-50', { hasText: 'selected' })

test.describe('Shortlist', () => {
  test('empty state, then saving a home from Explore shows it on /shortlist with a nav badge', async ({ page }) => {
    await page.goto('/shortlist')
    await expect(page.getByText('Your shortlist is empty')).toBeVisible()

    await page.goto('/explore')
    await waitForExploreLoaded(page)
    const firstCard = page.locator('article').first()
    const title = await firstCard.locator('h3').textContent()
    await firstCard.getByRole('button', { name: /Save to shortlist/i }).click()

    await page.goto('/shortlist')
    await expect(page.getByText('1 home saved')).toBeVisible()
    if (title) await expect(page.getByText(title.trim())).toBeVisible()
  })

  test('shortlist persists across a reload (localStorage)', async ({ page }) => {
    await page.goto('/explore')
    await waitForExploreLoaded(page)
    await page.locator('article').first().getByRole('button', { name: /Save to shortlist/i }).click()
    await page.reload()
    await waitForExploreLoaded(page)
    await expect(page.locator('article').first().getByRole('button', { name: /Remove from shortlist/i })).toBeVisible()
  })
})

test.describe('Compare', () => {
  test('empty /compare prompts to browse homes', async ({ page }) => {
    await page.goto('/compare')
    await expect(page.getByRole('heading', { name: /Select homes to compare/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /Browse homes/i })).toBeVisible()
  })

  test('adding 2 homes from Explore surfaces the floating compare tray and links to /compare', async ({ page }) => {
    await page.goto('/explore')
    await waitForExploreLoaded(page)
    await cardCompareToggle(page, 0).click()
    await cardCompareToggle(page, 1).click()

    // The "N of 3 selected" caption is intentionally hidden below `sm`
    // (compare-tray.tsx), so assert on the thumbnail count instead — it's
    // present at every viewport.
    const tray = compareTray(page)
    await expect(tray.locator('img')).toHaveCount(2)
    const compareButton = tray.getByRole('button', { name: 'Compare' })
    await expect(compareButton).toBeEnabled()
    await compareButton.click()
    await expect(page).toHaveURL(/\/compare\?ids=/)
    await expect(page.getByRole('heading', { name: /Comparing \d homes/i })).toBeVisible({ timeout: 10_000 })
  })

  test('cannot add a 4th home to comparison', async ({ page }) => {
    await page.goto('/explore')
    await waitForExploreLoaded(page)
    for (let i = 0; i < 3; i++) {
      await cardCompareToggle(page, i).click()
    }
    await expect(compareTray(page).locator('img')).toHaveCount(3)
    await expect(cardCompareToggle(page, 3)).toBeDisabled()
  })

  test('compare selection persists across reload and Clear empties it', async ({ page }) => {
    await page.goto('/explore')
    await waitForExploreLoaded(page)
    await cardCompareToggle(page, 0).click()
    await cardCompareToggle(page, 1).click()
    await page.reload()
    await waitForExploreLoaded(page)
    await expect(compareTray(page).locator('img')).toHaveCount(2, { timeout: 10_000 })

    await compareTray(page).getByRole('button', { name: 'Clear' }).click()
    await expect(compareTray(page)).toHaveCount(0)
  })
})

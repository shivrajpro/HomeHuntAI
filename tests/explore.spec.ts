import { test, expect } from '@playwright/test'
import { waitForExploreLoaded } from './helpers'

test.describe('Explore — search, filter, sort, paging', () => {
  test('loads a grid of cards; the result count appears once a filter is applied', async ({ page }) => {
    await page.goto('/explore')
    await waitForExploreLoaded(page)
    const cards = page.locator('article')
    await expect(cards.first()).toBeVisible()
    // Unfiltered: no count — "1,000 homes" over the whole catalogue is noise.
    await expect(page.getByText(/homes match your search/)).toHaveCount(0)

    await page.getByRole('combobox').nth(1).selectOption('Bangalore')
    await page.waitForTimeout(500)
    await waitForExploreLoaded(page)
    await expect(page.getByText(/homes match your search/)).toBeVisible()
  })

  test('free-text search narrows the result set', async ({ page }) => {
    await page.goto('/explore')
    await waitForExploreLoaded(page)
    await expect(page.locator('article').first()).toBeVisible()
    const before = await page.locator('article').count()

    await page.getByPlaceholder(/Search locality/).fill('Whitefield')
    await page.waitForTimeout(500)
    await waitForExploreLoaded(page)

    const countText = await page.getByText(/homes match your search/).textContent()
    expect(countText).toBeTruthy()
    const after = await page.locator('article').count()
    expect(after).toBeLessThanOrEqual(before)
  })

  test('a nonsense search yields the empty state, not an error', async ({ page }) => {
    await page.goto('/explore')
    await waitForExploreLoaded(page)
    await page.getByPlaceholder(/Search locality/).fill('zzzznoexistentqqqxx123')
    await page.waitForTimeout(500)
    await expect(page.getByText('No homes match those filters')).toBeVisible({ timeout: 10_000 })
  })

  test('Buy/Rent, city, type and BHK filters combine and narrow results', async ({ page }) => {
    await page.goto('/explore')
    await waitForExploreLoaded(page)

    await page.getByRole('combobox').nth(0).selectOption('Rent')
    await page.getByRole('combobox').nth(1).selectOption('Bangalore')
    await page.waitForTimeout(500)
    await waitForExploreLoaded(page)

    const cards = page.locator('article')
    await expect(cards.first()).toBeVisible()
    // The listing-type badge is an exact-text span (distinct from the title,
    // which may itself contain the word "Rent"/"Bangalore").
    await expect(cards.first().locator('span', { hasText: /^Rent$/ })).toBeVisible()
    await expect(cards.first().locator('p', { hasText: 'Bangalore' })).toBeVisible()
  })

  test('BHK multiselect applies exact-match filters (not "2+")', async ({ page }) => {
    await page.goto('/explore')
    await waitForExploreLoaded(page)

    // Pick exactly 2 and 3 BHK from the multiselect.
    await page.getByRole('button', { name: 'BHK' }).click()
    await page.getByRole('option', { name: '2 BHK' }).click()
    await page.getByRole('option', { name: '3 BHK' }).click()
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)
    await waitForExploreLoaded(page)

    await expect(page).toHaveURL(/bhk=2(%2C|,)3/)

    // Every rendered card is exactly 2 or 3 BHK — never 1 or 4+ ("2+" would leak 4s).
    const cards = page.locator('article')
    const n = await cards.count()
    expect(n).toBeGreaterThan(0)
    for (let i = 0; i < n; i++) {
      const text = (await cards.nth(i).textContent()) ?? ''
      expect(text).toMatch(/[23] BHK/)
      expect(text).not.toMatch(/[1456789] BHK/)
    }
  })

  test('Clear button appears once a filter is active and resets the form', async ({ page }) => {
    await page.goto('/explore')
    await waitForExploreLoaded(page)
    await expect(page.getByRole('button', { name: 'Clear' })).toHaveCount(0)

    await page.getByRole('combobox').nth(1).selectOption('Pune')
    await expect(page.getByRole('button', { name: 'Clear' })).toBeVisible()

    await page.getByRole('button', { name: 'Clear' }).click()
    await expect(page.getByRole('button', { name: 'Clear' })).toHaveCount(0)
    await expect(page.getByRole('combobox').nth(1)).toHaveValue('')
  })

  test('filters sync to the URL and survive a refresh', async ({ page }) => {
    await page.goto('/explore')
    await waitForExploreLoaded(page)
    await page.getByRole('combobox').nth(1).selectOption('Hyderabad')
    await page.waitForTimeout(500)
    await expect(page).toHaveURL(/region=Hyderabad/)

    await page.reload()
    await waitForExploreLoaded(page)
    await expect(page.getByRole('combobox').nth(1)).toHaveValue('Hyderabad')
  })

  test('"Load more" appends another page of cards', async ({ page }) => {
    await page.goto('/explore')
    await waitForExploreLoaded(page)
    const initial = await page.locator('article').count()
    const loadMore = page.getByRole('button', { name: /Load more homes/i })
    test.skip(!(await loadMore.isVisible().catch(() => false)), 'fewer than one page of results, nothing to load')
    await loadMore.click()
    await expect(page.locator('article')).toHaveCount(initial + 24, { timeout: 10_000 })
  })

  test('a Supabase fetch failure shows the error state, not a blank page or crash', async ({ page }) => {
    test.setTimeout(45_000)
    await page.route('**/rest/v1/properties**', (route) => route.abort('failed'))
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))
    await page.goto('/explore')
    await expect(page.getByText(/Something went wrong loading listings/i)).toBeVisible({ timeout: 30_000 })
    expect(errors).toEqual([])
  })
})

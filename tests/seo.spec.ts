import { test, expect } from '@playwright/test'
import { waitForExploreLoaded } from './helpers'

test.describe('SEO metadata', () => {
  test('every top-level route has a distinct, descriptive document title', async ({ page }) => {
    const titles = new Map<string, string>()

    for (const path of ['/', '/explore', '/copilot', '/shortlist', '/compare']) {
      await page.goto(path)
      if (path === '/explore') await waitForExploreLoaded(page)
      // Routes are lazy-loaded (code-split) — wait for the chunk to mount and
      // its useDocumentTitle effect to fire, rather than racing page.goto's
      // "load" event (which only covers the initial shell, not the route
      // chunk + Suspense boundary). Every route's real title differs from
      // the bare index.html default, so that's a reliable readiness signal.
      await expect.poll(() => page.title()).not.toBe('HomeHunt AI')
      const title = await page.title()
      expect(title, `${path} should have a non-empty title`).toBeTruthy()
      titles.set(path, title)
    }

    const unique = new Set(titles.values())
    expect(unique.size, `Expected distinct titles per route, got: ${JSON.stringify([...titles])}`).toBe(titles.size)
  })

  test('a property detail page title includes the listing name', async ({ page }) => {
    await page.goto('/explore')
    await waitForExploreLoaded(page)
    const cardTitle = (await page.locator('article h3').first().textContent())?.trim()
    await page.locator('article a').first().click()
    await expect(page).toHaveURL(/\/property\//)
    await page.waitForTimeout(500)
    const pageTitle = await page.title()
    expect(cardTitle && pageTitle.includes(cardTitle), `document title "${pageTitle}" should include the listing name "${cardTitle}"`).toBeTruthy()
  })

  test('the 404 page has its own title rather than reusing the app shell title', async ({ page }) => {
    await page.goto('/this-route-does-not-exist')
    const title = await page.title()
    expect(title.toLowerCase()).toContain('not found')
  })

  test('has a meta description', async ({ page }) => {
    await page.goto('/')
    const description = await page.locator('meta[name="description"]').getAttribute('content')
    expect(description).toBeTruthy()
  })
})

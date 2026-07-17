import { test, expect } from '@playwright/test'
import { submitCopilotBrief } from './helpers'

test.describe('Resilience — network failures', () => {
  test('Copilot falls back to the local parser when the Gemini edge function is unreachable', async ({ page }) => {
    await page.route('**/functions/v1/copilot-intent', (route) => route.abort('failed'))
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))

    await page.goto('/copilot')
    await submitCopilotBrief(page, 'Family with two kids, buying a 3 BHK in Bangalore under 1.5 Cr.')

    // The deterministic downstream ranking still runs off the regex-parsed
    // intent, so picks should still appear even with Gemini fully down.
    await expect(page.getByText(/% fit/).first()).toBeVisible({ timeout: 20_000 })
    expect(errors).toEqual([])
  })

  test('Copilot degrades gracefully when the edge function returns an error response', async ({ page }) => {
    await page.route('**/functions/v1/copilot-intent', (route) =>
      route.fulfill({ status: 500, body: JSON.stringify({ error: 'boom' }) }),
    )
    await page.goto('/copilot')
    await submitCopilotBrief(page, 'Young couple renting in Hyderabad, budget 45k.')
    await expect(page.getByText(/% fit/).first()).toBeVisible({ timeout: 20_000 })
  })

  test('a slow Gemini response still resolves and shows a thinking indicator meanwhile', async ({ page }) => {
    await page.route('**/functions/v1/copilot-intent', async (route) => {
      await new Promise((r) => setTimeout(r, 2000))
      await route.continue()
    })
    await page.goto('/copilot')
    const textarea = page.getByPlaceholder(/BHK to buy in Bangalore/)
    await textarea.fill('3 BHK to buy in Bangalore under 1 Cr')
    await textarea.press('Enter')

    // Input is disabled while thinking.
    await expect(page.getByRole('button', { name: 'Send' })).toBeDisabled()
    await expect(page.getByText(/% fit/).first()).toBeVisible({ timeout: 20_000 })
  })

  test('Explore recovers once Supabase comes back after a transient failure', async ({ page }) => {
    // A hard network abort forces the underlying fetch through its full
    // retry/backoff cycle before TanStack Query settles into the error
    // state — empirically up to ~20s, so this needs a generous budget.
    test.setTimeout(60_000)
    let fail = true
    await page.route('**/rest/v1/properties**', (route) => {
      if (fail) return route.abort('failed')
      return route.continue()
    })
    await page.goto('/explore')
    await expect(page.getByText(/Something went wrong loading listings/i)).toBeVisible({ timeout: 30_000 })

    fail = false
    await page.reload()
    await expect(page.locator('article').first()).toBeVisible({ timeout: 15_000 })
  })

  test('property detail page shows a not-found state when Supabase errors out', async ({ page }) => {
    test.setTimeout(45_000)
    await page.route('**/rest/v1/properties**', (route) => route.abort('failed'))
    await page.goto('/property/2edfefe8-0668-4acd-8b88-ef052884ba95')
    await expect(page.getByRole('heading', { name: /Listing not found/i })).toBeVisible({ timeout: 30_000 })
  })
})

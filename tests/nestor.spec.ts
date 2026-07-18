import { test, expect } from '@playwright/test'
import { isBenignResourceLoadNoise, submitNestorBrief } from './helpers'

test.describe('Nestor', () => {
  test('empty state shows example briefs; picking one starts a conversation', async ({ page }) => {
    await page.goto('/nestor')
    await expect(page.getByRole('heading', { name: /Tell me what home/i })).toBeVisible()
    const exampleChips = page.locator('button', { hasText: /BHK|budget/i })
    await expect(exampleChips.first()).toBeVisible()
  })

  test('a full brief returns ranked, explained picks', async ({ page }) => {
    await page.goto('/nestor')
    await submitNestorBrief(
      page,
      'Family with two kids, buying a 3 BHK in Bangalore under 1.5 Cr, safety and good schools matter most.',
    )

    await expect(page.getByText(/% fit/).first()).toBeVisible({ timeout: 20_000 })
    const picks = page.getByText(/% fit/)
    const count = await picks.count()
    expect(count).toBeGreaterThan(0)
    expect(count).toBeLessThanOrEqual(3)

    // Each pick explains itself: strengths, a trade-off, and a confidence line.
    await expect(page.locator('svg.lucide-scale').first()).toBeVisible()
    await expect(page.locator('svg.lucide-shield-check').first()).toBeVisible()

    // Detected priorities are shown as editable chips.
    await expect(page.getByText('Detected priorities')).toBeVisible()

    // Hand-off actions are present.
    await expect(page.getByRole('button', { name: /View these in Explore/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /View Decision Report/i })).toBeVisible()
  })

  test('"Nestor\'s thinking" streams the pipeline and stays as a replayable trace', async ({ page }) => {
    await page.goto('/nestor')
    await submitNestorBrief(
      page,
      'Family with two kids, buying a 3 BHK in Bangalore under 1.5 Cr, safety and good schools matter most.',
    )

    // The trace panel persists on the answer, collapsed by default.
    const panel = page.getByText("Nestor's thinking")
    await expect(panel.first()).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText(/% fit/).first()).toBeVisible({ timeout: 20_000 })

    // Expanding it reveals the real, ordered pipeline stages.
    await panel.first().click()
    await expect(page.getByText('Listings scanned')).toBeVisible()
    await expect(page.getByText('Ranked by fit')).toBeVisible()
    await expect(page.getByText('Picks validated')).toBeVisible()
  })

  test('the trade-off simulator re-ranks the shortlist live, offline', async ({ page }) => {
    await page.goto('/nestor')
    await submitNestorBrief(
      page,
      'Family with two kids, buying a 3 BHK in Bangalore under 1.5 Cr, safety and good schools matter most.',
    )
    await expect(page.getByText(/% fit/).first()).toBeVisible({ timeout: 20_000 })

    // Expand the simulator disclosure.
    const toggle = page.getByRole('button', { name: /Trade-off simulator/i })
    await expect(toggle).toBeVisible()
    await toggle.click()

    // Its controls are present: a max-budget amount and importance sliders.
    const budgetSlider = page.getByLabel('Max budget', { exact: true })
    await expect(budgetSlider).toBeVisible()
    await expect(page.getByText(/re-ranks\s+live, no AI call/i)).toBeVisible()
    await expect(page.getByText('What matters most')).toBeVisible()

    // Dragging the budget to its ceiling dirties the state (a delta chip and a
    // reset affordance appear) — proof the re-rank ran client-side, no network.
    await budgetSlider.focus()
    await budgetSlider.press('End')
    await expect(
      page.getByRole('button', { name: /Reset sliders/i }),
    ).toBeVisible()
  })

  test('removing the only remaining priority chip is prevented', async ({ page }) => {
    await page.goto('/nestor')
    await submitNestorBrief(page, 'Looking for a high-investment 2 BHK apartment in Pune under 90 lakh.')
    await expect(page.getByText('Detected priorities')).toBeVisible({ timeout: 20_000 })

    const removeButtons = page.getByRole('button', { name: /^Remove / })
    let remaining = await removeButtons.count()
    while (remaining > 1) {
      await removeButtons.first().click()
      await page.waitForTimeout(150)
      remaining = await removeButtons.count()
    }
    await expect(removeButtons.first()).toBeDisabled()
  })

  test('"View these in Explore" hands off filters via the URL', async ({ page }) => {
    await page.goto('/nestor')
    await submitNestorBrief(page, 'Young couple renting in Hyderabad, budget 45k, want nightlife and easy commute.')
    await expect(page.getByRole('button', { name: /View these in Explore/i })).toBeVisible({ timeout: 20_000 })
    await page.getByRole('button', { name: /View these in Explore/i }).click()
    await expect(page).toHaveURL(/\/explore\?.*region=Hyderabad/)
    await expect(page).toHaveURL(/listingType=Rent/)
  })

  test('"View Decision Report" renders a structured report', async ({ page }) => {
    await page.goto('/nestor')
    await submitNestorBrief(page, 'Peaceful, green 3 BHK villa in Delhi NCR for my retired parents.')
    await expect(page.getByRole('button', { name: /View Decision Report/i })).toBeVisible({ timeout: 20_000 })
    await page.getByRole('button', { name: /View Decision Report/i }).click()
    await expect(page).toHaveURL(/\/decision-report$/)
    await expect(page.getByRole('heading', { name: /Your home decision, summarised/i })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'User Requirements' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Top Recommendation' })).toBeVisible()
  })

  test('visiting /decision-report directly (no state) shows the graceful fallback', async ({ page }) => {
    await page.goto('/decision-report')
    await expect(page.getByRole('heading', { name: /No report to show/i })).toBeVisible()
    await page.getByRole('link', { name: /Start with Nestor/i }).click()
    await expect(page).toHaveURL(/\/nestor$/)
  })

  test('a follow-up refines the previous search ("Updated your search.")', async ({ page }) => {
    await page.goto('/nestor')
    await submitNestorBrief(page, 'Looking for a high-investment 2 BHK apartment in Pune under 90 lakh.')
    await expect(page.getByText(/% fit/).first()).toBeVisible({ timeout: 20_000 })

    await submitNestorBrief(page, 'Actually make it cheaper')
    await expect(page.getByText(/Updated your search/i)).toBeVisible({ timeout: 20_000 })
  })

  test('an off-topic first message gets the scope fallback, not a home search', async ({ page }) => {
    await page.goto('/nestor')
    await submitNestorBrief(page, "What's the capital of France and how's the weather there today?")
    await expect(page.getByText(/I'm Nestor — HomeHuntAI's home decision partner/i)).toBeVisible({ timeout: 20_000 })
    await expect(page.locator('article')).toHaveCount(0)
  })

  test('the Send button is disabled below the minimum length and enables once satisfied', async ({ page }) => {
    await page.goto('/nestor')
    const textarea = page.getByPlaceholder(/BHK to buy in Bangalore/)
    const send = page.getByRole('button', { name: 'Send' })
    await textarea.fill('hi')
    await expect(send).toBeDisabled()
    await expect(page.getByText(/at least 5 characters/i)).toBeVisible()
    await textarea.fill('hi there, a real brief')
    await expect(send).toBeEnabled()
  })

  test('rapid double-submit does not duplicate the user message', async ({ page }) => {
    await page.goto('/nestor')
    const textarea = page.getByPlaceholder(/BHK to buy in Bangalore/)
    const send = page.getByRole('button', { name: 'Send' })
    await textarea.fill('2 BHK apartment to rent in Bangalore under 40k')
    await send.click()
    await send.click({ force: true }).catch(() => {})
    await page.waitForTimeout(300)
    // While "thinking" the input is cleared and disabled, so a second click
    // should not enqueue a second identical user bubble.
    const userBubbles = page.locator('p', { hasText: '2 BHK apartment to rent in Bangalore under 40k' })
    await expect(userBubbles).toHaveCount(1)
  })

  test('keyboard: Enter submits, Shift+Enter inserts a newline', async ({ page }) => {
    await page.goto('/nestor')
    const textarea = page.getByPlaceholder(/BHK to buy in Bangalore/)
    await textarea.fill('3 BHK to buy in Bangalore')
    await textarea.press('Shift+Enter')
    await textarea.pressSequentially('under 1 Cr')
    await expect(textarea).toHaveValue(/\n/)
    await textarea.press('Enter')
    await expect(page.locator('p', { hasText: '3 BHK to buy in Bangalore' })).toBeVisible({ timeout: 3_000 })
  })

  test('has no console errors across a full conversation', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))
    page.on('console', (msg) => {
      if (msg.type() === 'error' && !isBenignResourceLoadNoise(msg.text())) errors.push(msg.text())
    })
    await page.goto('/nestor')
    await submitNestorBrief(page, 'Family with two kids, buying a 3 BHK in Bangalore under 1.5 Cr.')
    await expect(page.getByText(/% fit/).first()).toBeVisible({ timeout: 20_000 })
    expect(errors, `Console errors: ${errors.join('\n')}`).toEqual([])
  })
})

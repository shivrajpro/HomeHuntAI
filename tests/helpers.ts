import { type Page, expect } from '@playwright/test'

/** Wait for the Explore grid to finish its first load (skeletons gone, cards or empty-state present). */
export async function waitForExploreLoaded(page: Page) {
  await expect(page.getByText('Loading listings…')).toHaveCount(0, { timeout: 15_000 })
}

/** Submit a Copilot brief and wait for the assistant's reply to land. */
export async function submitCopilotBrief(page: Page, brief: string) {
  const textarea = page.getByPlaceholder(/BHK to buy in Bangalore/)
  await textarea.fill(brief)
  await textarea.press('Enter')
  // The typing indicator (three pulsing dots) is only present while "thinking".
  await expect(page.locator('.animate-pulse, [class*="pulse"]').first()).toBeVisible({
    timeout: 5_000,
  }).catch(() => {})
  await expect(page.getByRole('textbox')).toBeEnabled({ timeout: 20_000 })
  await page.waitForTimeout(300)
}

/** First N property ids currently rendered as cards on Explore (from their detail links). */
export async function firstCardHref(page: Page): Promise<string | null> {
  const link = page.locator('a[href^="/property/"]').first()
  return link.getAttribute('href')
}

/**
 * Chromium logs a "Failed to load resource: the server responded with a
 * status of ___" console error for every non-2xx HTTP response — including
 * ones the app already handles (e.g. the Copilot edge function's 429 rate
 * limit, which falls back to the local parser by design). That's expected
 * network noise, not an application bug, so console-error assertions should
 * ignore it and only fail on genuine JS/React errors.
 */
export function isBenignResourceLoadNoise(text: string): boolean {
  return /Failed to load resource: the server responded with a status of \d+/.test(text)
}

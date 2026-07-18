import { test, expect } from '@playwright/test'

import { isBenignResourceLoadNoise } from './helpers'

/**
 * Voice-first Nestor is a progressive enhancement over the Web Speech APIs.
 * These smoke tests confirm the controls surface (when the browser exposes the
 * APIs) and that wiring them in doesn't break the page or the typed flow — the
 * APIs themselves need a mic/audio device and a user gesture, so their runtime
 * behaviour can't be driven headlessly.
 */
test.describe('Voice-first Nestor', () => {
  test('exposes voice controls and mounts cleanly', async ({ page }) => {
    const errors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error' && !isBenignResourceLoadNoise(msg.text())) {
        errors.push(msg.text())
      }
    })

    await page.goto('/nestor')
    await expect(page.getByPlaceholder(/BHK to buy in Bangalore/)).toBeVisible()

    // SpeechSynthesis exists in Chromium, so the voice-reply toggle must render
    // and persist its state across a toggle.
    const synthSupported = await page.evaluate(
      () => 'speechSynthesis' in window,
    )
    if (synthSupported) {
      const toggle = page.getByRole('button', { name: /voice replies/i })
      await expect(toggle).toBeVisible()
      await toggle.click()
      await expect(
        page.getByRole('button', {
          name: /Nestor reads answers aloud/i,
        }),
      ).toBeVisible()
    }

    // Mic (SpeechRecognition) is optional; when present it should render.
    const recognitionSupported = await page.evaluate(
      () =>
        'SpeechRecognition' in window || 'webkitSpeechRecognition' in window,
    )
    if (recognitionSupported) {
      await expect(
        page.getByRole('button', { name: /speak your brief/i }),
      ).toBeVisible()
    }

    expect(errors).toEqual([])
  })
})

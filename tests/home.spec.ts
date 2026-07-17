import { test, expect } from '@playwright/test'
import { isBenignResourceLoadNoise } from './helpers'

test.describe('Home page', () => {
  test('renders hero, headline and both primary CTAs', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/HomeHunt AI/)
    await expect(page.getByRole('heading', { level: 1 })).toContainText('fits your life')
    await expect(page.getByRole('link', { name: /Start with Nestor/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /Browse homes/i })).toBeVisible()
  })

  test('renders the three feature cards', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Smart matching' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Neighborhood intel' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Ask Nestor' })).toBeVisible()
  })

  test('"Start with Nestor" navigates to /nestor', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('link', { name: /Start with Nestor/i }).click()
    await expect(page).toHaveURL(/\/nestor$/)
  })

  test('"Browse homes" navigates to /explore', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('link', { name: /Browse homes/i }).click()
    await expect(page).toHaveURL(/\/explore$/)
  })

  test('has no console errors on load', async ({ page }) => {
    const errors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error' && !isBenignResourceLoadNoise(msg.text())) errors.push(msg.text())
    })
    page.on('pageerror', (err) => errors.push(err.message))
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    expect(errors, `Console errors: ${errors.join('\n')}`).toEqual([])
  })
})

import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

import { completeAstraInOauth } from '../../../scripts/e2e/regression/astraInOauth'
import {
  captureAstraInAuthorizationUrl,
  sendAstraInCallbackToOwnedApp
} from '../../../scripts/e2e/regression/debugBridge'
import type { RegressionApp } from './RegressionApp'
import { openSettingsSection } from './settings'

export async function ensureAstraInSignedIn(app: RegressionApp, page: Page): Promise<void> {
  await openSettingsSection(page, 'Model Provider')
  await page.getByTestId('provider-list-item-astrain').click()
  const authorize = page.getByRole('button', { name: 'Authorize with AstraIN', exact: true })
  const logout = page.getByRole('button', { name: 'Logout', exact: true })
  await expect(authorize.or(logout).first()).toBeVisible({ timeout: 60_000 })
  if (await authorize.isVisible().catch(() => false)) {
    const authorizationUrl = await captureAstraInAuthorizationUrl(app.record, () => authorize.click())
    const callback = await completeAstraInOauth(authorizationUrl, {
      account: app.config.astraIn.account,
      password: app.config.astraIn.password
    })
    await sendAstraInCallbackToOwnedApp(app.record, callback)
    await expect
      .poll(
        () =>
          page.evaluate(async () => {
            const response = await window.api.dataApi.request({
              id: `regression-astrain-${Date.now()}`,
              method: 'GET',
              path: '/providers/astrain/api-keys'
            })
            const data = response.data as { keys?: Array<{ label?: string }> } | undefined
            return data?.keys?.some((key) => key.label === 'OAuth') ?? false
          }),
        { timeout: 60_000 }
      )
      .toBe(true)
    await openSettingsSection(page, 'Model Provider')
    const astraIn = page.getByTestId('provider-list-item-astrain')
    await astraIn.click()
    await expect(astraIn).toHaveAttribute('data-selected', 'true')
  }
  await expect(logout).toBeVisible({ timeout: 3 * 60_000 })
}

export async function addAstraInModel(page: Page, model: string, tab?: string): Promise<void> {
  if (
    await page
      .getByText(model, { exact: true })
      .isVisible()
      .catch(() => false)
  )
    return
  await page.getByRole('button', { name: 'Sync models', exact: true }).click()
  const drawer = page.locator('[data-slot="page-side-panel"][role="dialog"]:visible').first()
  await expect(drawer).toBeVisible()
  if (tab) {
    const tabLocator = drawer.getByRole('tab', { name: new RegExp(tab, 'i') })
    if (await tabLocator.isVisible().catch(() => false)) await tabLocator.click()
  }
  const search = drawer.getByPlaceholder('Search models')
  await expect(search).toBeEnabled()
  await search.fill(model)
  await expect(drawer.getByText(model, { exact: true })).toBeVisible()
  const add = drawer.getByRole('button', { name: 'Add', exact: true }).first()
  if (await add.isVisible().catch(() => false)) await add.click()
  await drawer.getByRole('button', { name: 'Close', exact: true }).click()
  await expect(drawer).toBeHidden()
}

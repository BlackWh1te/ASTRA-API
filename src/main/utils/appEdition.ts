import { readFileSync } from 'node:fs'

import { app } from 'electron'

import { application } from '@application'
import type { AppEdition } from '@shared/types/appEdition'

const APPLICATION_IDS = {
  global: 'com.kangfenmao.AstraAPI',
  cn: 'com.astra-api.astra-api.cn'
} as const satisfies Record<AppEdition, string>

function parseAppEdition(value: unknown): AppEdition {
  if (value === undefined || value === 'global') {
    return 'global'
  }
  if (value === 'cn') {
    return 'cn'
  }
  throw new Error(`Unsupported application edition: ${String(value)}`)
}

function resolveAppEdition(): AppEdition {
  const developmentEdition = process.env.ASTRA_EDITION?.trim().toLowerCase()
  if (!app.isPackaged && developmentEdition) {
    return parseAppEdition(developmentEdition)
  }

  const packageMetadata = JSON.parse(readFileSync(application.getPath('app.root', 'package.json'), 'utf8')) as {
    astraEdition?: unknown
  }

  return parseAppEdition(packageMetadata.astraEdition)
}

let cachedAppEdition: AppEdition | undefined

export function getAppEdition(): AppEdition {
  cachedAppEdition ??= resolveAppEdition()
  return cachedAppEdition
}

export function getApplicationId(): string {
  return APPLICATION_IDS[getAppEdition()]
}

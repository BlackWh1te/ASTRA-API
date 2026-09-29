import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, it, vi } from 'vitest'

import artifactBuildCompleted, { normalizeArtifactFilePath } from '../artifact-build-completed'

const PRODUCT_NAME = 'ASTRA API'
const VERSION = '2.0.9'

const temporaryDirectories: string[] = []

function temporaryDirectory(): string {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'astra-artifact-name-'))
  temporaryDirectories.push(directory)
  return directory
}

afterEach(() => {
  vi.restoreAllMocks()
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true })
  }
})

describe('normalizeArtifactFilePath', () => {
  it.each([
    ['windows', 'ASTRA API-2.0.9-x64-setup.exe', 'Astra-api-2.0.9-win-x64-setup.exe'],
    ['windows', 'ASTRA API-2.0.9-arm64-portable.exe', 'Astra-api-2.0.9-win-arm64-portable.exe'],
    ['mac', 'ASTRA API-2.0.9-x64.dmg', 'Astra-api-2.0.9-mac-x64.dmg'],
    ['mac', 'ASTRA API-2.0.9-arm64.zip.blockmap', 'Astra-api-2.0.9-mac-arm64.zip.blockmap'],
    ['linux', 'ASTRA API-2.0.9-x86_64.AppImage', 'Astra-api-2.0.9-linux-x64.AppImage'],
    ['linux', 'ASTRA API-2.0.9-amd64.deb', 'Astra-api-2.0.9-linux-x64.deb'],
    ['linux', 'ASTRA API-2.0.9-aarch64.rpm', 'Astra-api-2.0.9-linux-arm64.rpm']
  ])('normalizes the %s release asset %s', (platform, source, expected) => {
    expect(normalizeArtifactFilePath(path.join('dist', source), PRODUCT_NAME, VERSION, platform)).toBe(
      path.join('dist', expected)
    )
  })

  it('is idempotent for an already normalized asset', () => {
    const file = path.join('dist', 'Astra-api-2.0.9-linux-x64.AppImage')
    expect(normalizeArtifactFilePath(file, PRODUCT_NAME, VERSION, 'linux')).toBe(file)
  })

  it('uses the public CN prefix for a China edition artifact', () => {
    expect(
      normalizeArtifactFilePath(
        path.join('dist', 'ASTRA API-2.0.9-x64.dmg'),
        PRODUCT_NAME,
        VERSION,
        'mac',
        'ASTRA API CN'
      )
    ).toBe(path.join('dist', 'Astra-api-CN-2.0.9-mac-x64.dmg'))
  })

  it.each(['latest.yml', 'latest-linux.yml', 'release-history.json', 'other-product-2.0.9-x64.zip'])(
    'does not add a platform prefix to %s',
    (fileName) => {
      const file = path.join('dist', fileName)
      expect(normalizeArtifactFilePath(file, PRODUCT_NAME, VERSION, 'linux')).toBe(file)
    }
  )
})

describe('artifactBuildCompleted', () => {
  it('renames the file and exposes its final path to later publisher hooks', () => {
    const directory = temporaryDirectory()
    const source = path.join(directory, 'ASTRA API-2.0.9-x86_64.AppImage')
    const expected = path.join(directory, 'Astra-api-2.0.9-linux-x64.AppImage')
    fs.writeFileSync(source, 'artifact')
    const buildResult = {
      file: source,
      safeArtifactName: 'Astra-api-2.0.9-x86_64.AppImage',
      packager: {
        appInfo: { productName: PRODUCT_NAME, version: VERSION },
        config: {},
        platform: { name: 'linux' }
      }
    }

    artifactBuildCompleted(buildResult)

    expect(buildResult.file).toBe(expected)
    expect(buildResult.safeArtifactName).toBe('Astra-api-2.0.9-linux-x64.AppImage')
    expect(fs.existsSync(source)).toBe(false)
    expect(fs.readFileSync(expected, 'utf8')).toBe('artifact')
  })

  it('propagates rename failures so packaging cannot continue with a stale path', () => {
    const source = path.join(temporaryDirectory(), 'ASTRA API-2.0.9-x86_64.AppImage')
    const buildResult = {
      file: source,
      safeArtifactName: 'Astra-api-2.0.9-x86_64.AppImage',
      packager: {
        appInfo: { productName: PRODUCT_NAME, version: VERSION },
        config: {},
        platform: { name: 'linux' }
      }
    }

    expect(() => artifactBuildCompleted(buildResult)).toThrow()
    expect(buildResult.file).toBe(source)
  })
})

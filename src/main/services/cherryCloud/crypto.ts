import { createHash, createPrivateKey, generateKeyPairSync, randomBytes, randomUUID, sign } from 'node:crypto'

function toBase64Url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64url')
}

export function createAuthorizationSecrets(): { state: string; codeVerifier: string; codeChallenge: string } {
  const state = toBase64Url(randomBytes(32))
  const codeVerifier = toBase64Url(randomBytes(32))
  const codeChallenge = createHash('sha256').update(codeVerifier, 'ascii').digest('base64url')
  return { state, codeVerifier, codeChallenge }
}

export function createDeviceKeyPair(): { publicKey: string; privateKey: string } {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519')
  const publicDer = publicKey.export({ format: 'der', type: 'spki' })
  const privateDer = privateKey.export({ format: 'der', type: 'pkcs8' })

  return {
    publicKey: Buffer.from(publicDer).subarray(-32).toString('base64url'),
    privateKey: Buffer.from(privateDer).toString('base64')
  }
}

export function createIdempotencyKey(): string {
  return toBase64Url(randomBytes(32))
}

export function createDeviceSignature(input: {
  privateKey: string
  machineCode: string
  method: string
  requestTarget: string
  body: Uint8Array
  idempotencyKey?: string
  now?: Date
  requestId?: string
}): Record<string, string> {
  const timestamp = Math.floor((input.now ?? new Date()).getTime() / 1000).toString()
  const requestId = input.requestId ?? randomUUID()
  const bodyHash = createHash('sha256').update(input.body).digest('hex')
  const canonical = [
    'astra-device-signature-v2',
    input.method.toUpperCase(),
    input.requestTarget,
    timestamp,
    requestId,
    bodyHash,
    input.idempotencyKey ?? '',
    input.machineCode
  ].join('\n')
  const privateKey = createPrivateKey({
    key: Buffer.from(input.privateKey, 'base64'),
    format: 'der',
    type: 'pkcs8'
  })

  return {
    'Astra-Request-ID': requestId,
    'Astra-Timestamp': timestamp,
    'Astra-Body-SHA256': bodyHash,
    'Astra-Signature-Version': '2',
    'Astra-Machine-Code': input.machineCode,
    'Astra-Signature': sign(null, Buffer.from(canonical, 'utf8'), privateKey).toString('base64url')
  }
}

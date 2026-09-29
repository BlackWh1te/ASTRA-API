import { application } from '@application'
import { OAuthSignInCancelledError } from '@main/services/oauth/errors'
import type { AstraInOAuthContext, AstraInSignInResult } from '@main/services/oauth/runtime/providers/astrain'
import type { OAuthAccount, OAuthRuntimeProviderContext } from '@main/services/oauth/runtime/types'
import { IpcError } from '@shared/ipc/errors/IpcError'
import { oauthErrorCodes } from '@shared/ipc/errors/oauth'
import type { WindowId } from '@shared/ipc/types'
import type { SystemProviderIds } from '@shared/utils/systemProviderId'

export async function mapOAuthSignInCancellation<T>(request: Promise<T>): Promise<T> {
  try {
    return await request
  } catch (error) {
    if (error instanceof OAuthSignInCancelledError) {
      throw new IpcError(oauthErrorCodes.SIGN_IN_CANCELLED, error.message)
    }
    throw error
  }
}

export function runOAuthSignIn(
  senderId: WindowId | null,
  providerId: typeof SystemProviderIds.astrain,
  requestId: string,
  context?: AstraInOAuthContext
): Promise<AstraInSignInResult>
export function runOAuthSignIn(
  senderId: WindowId | null,
  providerId: string,
  requestId: string,
  context?: OAuthRuntimeProviderContext
): Promise<OAuthAccount>
export async function runOAuthSignIn(
  senderId: WindowId | null,
  providerId: string,
  requestId: string,
  context: OAuthRuntimeProviderContext = {}
): Promise<OAuthAccount> {
  const result = await mapOAuthSignInCancellation(
    application.get('OAuthRuntimeService').signIn(senderId, providerId, requestId, context)
  )

  if (senderId) {
    application.get('MainWindowService').showMainWindow()
  }
  return result
}

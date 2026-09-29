import * as z from 'zod'

import { defineRoute } from '../define'

/**
 * AstraIN IPC schemas — provider-specific sign-in, balance and logout operations.
 *
 * The OAuth engine is shared with Codex and Grok, while the renderer-facing
 * contract stays here because AstraIN supplies hosts and receives API keys.
 */

/** The AstraIN account profile, or null when the profile endpoint has nothing. */
const astraInProfileSchema = z.object({
  displayName: z.string().nullable(),
  username: z.string().nullable(),
  email: z.string().nullable(),
  group: z.string().nullable()
})

/** Balance plus optional profile, returned to the settings panel. */
const astraInBalanceSchema = z.object({
  balance: z.number(),
  profile: astraInProfileSchema.nullable()
})

export type AstraInProfile = z.infer<typeof astraInProfileSchema>
export type AstraInBalance = z.infer<typeof astraInBalanceSchema>

const apiHostInput = z.object({ apiHost: z.string() })

export const astrainRequestSchemas = {
  'astrain.sign_in': defineRoute({
    input: z.object({ requestId: z.string().min(1), oauthServer: z.string(), apiHost: z.string().optional() }),
    output: z.object({ apiKeys: z.string().min(1) })
  }),
  'astrain.get_balance': defineRoute({ input: apiHostInput, output: astraInBalanceSchema }),
  'astrain.logout': defineRoute({ input: apiHostInput, output: z.void() })
}

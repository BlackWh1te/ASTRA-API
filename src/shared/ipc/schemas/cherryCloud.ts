import * as z from 'zod'

import { UniqueModelIdSchema } from '@shared/data/types/model'

import { defineRoute } from '../define'

export const astraCloudStatusSchema = z.strictObject({
  phase: z.enum(['signed-out', 'authorizing', 'signed-in']),
  displayName: z.string().nullable()
})

export type AstraCloudStatus = z.infer<typeof astraCloudStatusSchema>

const astraCloudModelSyncResultSchema = z.strictObject({
  entitledModelIds: z.array(UniqueModelIdSchema),
  quotaExhaustedModelIds: z.array(UniqueModelIdSchema)
})

export type AstraCloudModelSyncResult = z.infer<typeof astraCloudModelSyncResultSchema>

export const astraCloudRequestSchemas = {
  'astra_cloud.status.get': defineRoute({ input: z.void(), output: astraCloudStatusSchema }),
  'astra_cloud.login.start': defineRoute({ input: z.void(), output: astraCloudStatusSchema }),
  'astra_cloud.login.cancel': defineRoute({ input: z.void(), output: astraCloudStatusSchema }),
  'astra_cloud.session.revoke': defineRoute({ input: z.void(), output: astraCloudStatusSchema }),
  'astra_cloud.models.sync': defineRoute({
    input: z.void(),
    output: astraCloudModelSyncResultSchema
  })
}

export type AstraCloudEventSchemas = {
  'astra_cloud.status_changed': AstraCloudStatus
}

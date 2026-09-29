/**
 * In-memory binary media served to renderers over the `astra-media://` scheme.
 * This barrel is the module's only public door.
 */
export { MediaProtocolService } from './MediaProtocolService'
export { ASTRA_MEDIA_SCHEME_DECLARATION } from './registerSchemes'
export { ASTRA_MEDIA_SCHEME, MediaKind } from './types'

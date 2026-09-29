import { Avatar, AvatarFallback } from '@astra-api/ui/components/primitives/avatar'
import { cn } from '@astra-api/ui/lib/utils'

import { type IconAvatarProps } from '../../types'
import { ComposioDark } from './dark'
import { ComposioLight } from './light'

export function ComposioAvatar({ size = 32, shape = 'circle', className }: Omit<IconAvatarProps, 'icon'>) {
  return (
    <Avatar
      className={cn('overflow-hidden', shape === 'circle' ? 'rounded-full' : 'rounded-[20%]', className)}
      style={{ width: size, height: size }}>
      <AvatarFallback className="text-foreground bg-background">
        <ComposioLight className="dark:hidden" style={{ width: size, height: size }} />
        <ComposioDark className="hidden dark:block" style={{ width: size, height: size }} />
      </AvatarFallback>
    </Avatar>
  )
}

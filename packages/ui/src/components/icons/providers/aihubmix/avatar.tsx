import { Avatar, AvatarFallback } from '@astra-api/ui/components/primitives/avatar'
import { cn } from '@astra-api/ui/lib/utils'

import { type IconAvatarProps } from '../../types'
import { AihubmixLight } from './light'

export function AihubmixAvatar({ size = 32, shape = 'circle', className }: Omit<IconAvatarProps, 'icon'>) {
  return (
    <Avatar
      className={cn('overflow-hidden', shape === 'circle' ? 'rounded-full' : 'rounded-[20%]', className)}
      style={{ width: size, height: size }}>
      <AvatarFallback className="text-foreground">
        <AihubmixLight style={{ width: size, height: size }} />
      </AvatarFallback>
    </Avatar>
  )
}

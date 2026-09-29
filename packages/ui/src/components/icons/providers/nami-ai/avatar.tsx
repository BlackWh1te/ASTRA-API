import { Avatar, AvatarFallback } from '@astra-api/ui/components/primitives/avatar'
import { cn } from '@astra-api/ui/lib/utils'

import { type IconAvatarProps } from '../../types'
import { NamiAiDark } from './dark'
import { NamiAiLight } from './light'

export function NamiAiAvatar({ size = 32, shape = 'circle', className }: Omit<IconAvatarProps, 'icon'>) {
  return (
    <Avatar
      className={cn('overflow-hidden', shape === 'circle' ? 'rounded-full' : 'rounded-[20%]', className)}
      style={{ width: size, height: size }}>
      <AvatarFallback className="text-foreground bg-background">
        <NamiAiLight className="dark:hidden" style={{ width: size, height: size }} />
        <NamiAiDark className="hidden dark:block" style={{ width: size, height: size }} />
      </AvatarFallback>
    </Avatar>
  )
}

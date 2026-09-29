import type { CompoundIcon, CompoundIconProps } from '../../types'
import { AstrainAvatar } from './avatar'
import { AstrainLight } from './light'

const Astrain = ({ variant, className, ...props }: CompoundIconProps) => {
  if (variant === 'light') return <AstrainLight {...props} className={className} />
  return <AstrainLight {...props} className={className} />
}

export const AstrainIcon: CompoundIcon = /*#__PURE__*/ Object.assign(Astrain, {
  Avatar: AstrainAvatar,
  colorPrimary: '#FF5F5F'
})

export default AstrainIcon

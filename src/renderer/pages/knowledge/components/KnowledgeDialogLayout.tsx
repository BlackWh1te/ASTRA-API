import type { ComponentProps, ReactNode } from 'react'

import { DialogFooter, DialogHeader, DialogTitle } from '@astra-api/ui'
import { cn } from '@astra-api/ui/lib/utils'

export const KnowledgeDialogHeader = ({ children, className }: { children: ReactNode; className?: string }) => {
  return (
    <DialogHeader className={cn('pr-8 text-left', className)}>
      <DialogTitle>{children}</DialogTitle>
    </DialogHeader>
  )
}

export const KnowledgeDialogBody = ({ className, ...props }: ComponentProps<'div'>) => {
  return <div className={cn('space-y-3', className)} {...props} />
}

export const KnowledgeDialogField = ({ className, ...props }: ComponentProps<'div'>) => {
  return <div className={cn('space-y-1.5', className)} {...props} />
}

export const KnowledgeDialogFooter = ({ className, ...props }: ComponentProps<typeof DialogFooter>) => {
  return <DialogFooter className={className} {...props} />
}

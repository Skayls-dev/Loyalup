import type { HTMLAttributes, ReactNode } from 'react'

type BadgeVariant = 'default' | 'success' | 'warning' | 'info'

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant
  dot?: boolean
  children: ReactNode
}

const variantClasses: Record<BadgeVariant, string> = {
  default: 'bg-primary-light text-primary border border-primary/20',
  success: 'bg-accent-green/15 text-accent-green border border-accent-green/35',
  warning: 'bg-accent-yellow/30 text-dark border border-accent-yellow/60',
  info: 'bg-sky-100 text-sky-700 border border-sky-200',
}

const dotClasses: Record<BadgeVariant, string> = {
  default: 'bg-primary',
  success: 'bg-accent-green',
  warning: 'bg-accent-yellow',
  info: 'bg-sky-500',
}

export function Badge({ variant = 'default', dot = false, className = '', children, ...rest }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-body font-medium ${variantClasses[variant]} ${className}`}
      {...rest}
    >
      {dot ? <span className={`h-1.5 w-1.5 animate-pulse rounded-full ${dotClasses[variant]}`} aria-hidden="true" /> : null}
      <span>{children}</span>
    </span>
  )
}

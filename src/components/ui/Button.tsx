import type { ButtonHTMLAttributes, MouseEventHandler, ReactNode } from 'react'

type ButtonVariant = 'primary' | 'ghost' | 'outline-white' | 'white' | 'soft'
type ButtonSize = 'sm' | 'md' | 'lg'

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  onClick?: MouseEventHandler<HTMLButtonElement>
  className?: string
  children: ReactNode
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-primary text-white border border-primary shadow-primary-glow hover:brightness-105 disabled:hover:brightness-100',
  ghost: 'bg-transparent text-gray-800 border border-transparent hover:bg-gray-100',
  'outline-white': 'bg-transparent text-white border border-white/80 hover:bg-white/12',
  white: 'bg-white text-dark border border-white shadow-floating hover:bg-gray-50',
  soft: 'border border-slate-200 bg-slate-50 text-slate-800 shadow-sm hover:bg-slate-100',
}

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-9 px-3 text-sm',
  md: 'h-11 px-4 text-sm',
  lg: 'h-12 px-5 text-base',
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  onClick,
  className = '',
  children,
  ...rest
}: ButtonProps) {
  const isDisabled = disabled || loading

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isDisabled}
      className={`inline-flex items-center justify-center gap-2 rounded-md font-body font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 disabled:cursor-not-allowed disabled:opacity-60 ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      {...rest}
    >
      {loading ? (
        <span
          className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
          aria-hidden="true"
        />
      ) : null}
      <span>{children}</span>
    </button>
  )
}

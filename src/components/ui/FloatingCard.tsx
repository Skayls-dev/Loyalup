import type { HTMLAttributes, ReactNode } from 'react'

export interface FloatingCardProps extends HTMLAttributes<HTMLDivElement> {
  icon?: ReactNode
  title: string
  subtitle?: string
}

export function FloatingCard({ icon, title, subtitle, className = '', ...rest }: FloatingCardProps) {
  return (
    <article
      className={`animate-float-card rounded-xl border border-gray-200 bg-white p-4 shadow-floating ${className}`}
      {...rest}
    >
      <div className="flex items-start gap-3">
        {icon ? (
          <div className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-md bg-primary-light text-primary">
            {icon}
          </div>
        ) : null}

        <div className="min-w-0">
          <p className="font-display text-base font-bold text-dark">{title}</p>
          {subtitle ? <p className="mt-1 font-body text-sm text-gray-600">{subtitle}</p> : null}
        </div>
      </div>
    </article>
  )
}

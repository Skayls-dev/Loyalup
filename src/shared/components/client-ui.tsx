import type { ReactNode } from 'react'

type PageHeaderProps = {
  title: string
  subtitle?: string
  rightActions?: ReactNode
}

export function PageHeader({ title, subtitle, rightActions }: PageHeaderProps) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
      </div>
      {rightActions ? <div className="flex items-center gap-2">{rightActions}</div> : null}
    </div>
  )
}

export function SectionCard({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-slate-200/60 bg-white/80 p-4 shadow-sm shadow-slate-900/5 backdrop-blur-xl ${className}`}>
      {children}
    </section>
  )
}

export function StatCard({
  label,
  value,
  helper,
  icon,
}: {
  label: string
  value: string
  helper?: string
  icon?: ReactNode
}) {
  return (
    <div className="rounded-xl border border-slate-200/60 bg-white/80 p-4 shadow-sm shadow-slate-900/5 backdrop-blur-xl">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
        {icon ? <span className="text-slate-400">{icon}</span> : null}
      </div>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
      {helper ? <p className="mt-1 text-xs text-slate-500">{helper}</p> : null}
    </div>
  )
}

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string
  description: string
  action?: ReactNode
  icon?: ReactNode
}) {
  return (
    <div className="rounded-2xl border border-slate-200/60 bg-white/80 p-8 text-center shadow-sm shadow-slate-900/5 backdrop-blur-xl">
      {icon ? <div className="mx-auto mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-500">{icon}</div> : null}
      <p className="text-base font-semibold text-slate-900">{title}</p>
      <p className="mt-1 text-sm text-slate-500">{description}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  )
}

const buttonBase =
  'inline-flex h-10 items-center justify-center rounded-lg px-4 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50 disabled:cursor-not-allowed disabled:opacity-60'

export function PrimaryButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { className = '', ...rest } = props
  return <button className={`${buttonBase} bg-indigo-600 text-white hover:bg-indigo-700 ${className}`} {...rest} />
}

export function SecondaryButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { className = '', ...rest } = props
  return (
    <button
      className={`${buttonBase} border border-slate-200/80 bg-white/90 text-slate-700 hover:bg-slate-50 ${className}`}
      {...rest}
    />
  )
}

export function DangerButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { className = '', ...rest } = props
  return (
    <button
      className={`${buttonBase} border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 ${className}`}
      {...rest}
    />
  )
}

export function Badge({
  children,
  variant = 'neutral',
}: {
  children: ReactNode
  variant?: 'neutral' | 'primary' | 'success' | 'warn'
}) {
  const classes: Record<typeof variant, string> = {
    neutral: 'border-slate-200 bg-slate-100 text-slate-600',
    primary: 'border-indigo-200 bg-indigo-50 text-indigo-700',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    warn: 'border-amber-200 bg-amber-50 text-amber-700',
  }

  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${classes[variant]}`}>{children}</span>
}

export function ProgressBar({
  value,
  max,
  variant = 'primary',
}: {
  value: number
  max: number
  variant?: 'primary' | 'success' | 'warn'
}) {
  const ratio = Math.min(100, Math.max(0, max > 0 ? (value / max) * 100 : 0))
  const track = 'h-2 rounded-full bg-slate-200/80'
  const fill =
    variant === 'success'
      ? 'bg-emerald-600'
      : variant === 'warn'
        ? 'bg-amber-500'
        : 'bg-indigo-600'

  return (
    <div className={track}>
      <div className={`h-2 rounded-full transition-all ${fill}`} style={{ width: `${ratio}%` }} />
    </div>
  )
}

export function SwitchRow({
  label,
  description,
  checked,
  onToggle,
  disabled = false,
}: {
  label: string
  description?: string
  checked: boolean
  onToggle: () => void
  disabled?: boolean
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-slate-200/70 py-3 last:border-b-0">
      <div>
        <p className="text-sm font-semibold text-slate-900">{label}</p>
        {description ? <p className="mt-0.5 text-xs text-slate-500">{description}</p> : null}
      </div>

      <button
        type="button"
        onClick={onToggle}
        disabled={disabled}
        className={`relative h-6 w-11 rounded-full transition ${checked ? 'bg-indigo-600' : 'bg-slate-300'} ${disabled ? 'opacity-60' : ''}`}
      >
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${checked ? 'left-[22px]' : 'left-0.5'}`} />
      </button>
    </div>
  )
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-slate-200/80 ${className}`} />
}

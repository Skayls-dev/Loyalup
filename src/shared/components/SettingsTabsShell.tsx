import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

type SettingsTabDefinition<TTab extends string> = {
  id: TTab
  label: string
  description: string
  icon: LucideIcon
}

type SettingsTabsTheme = 'merchant' | 'client'

type SettingsTabsShellProps<TTab extends string> = {
  sidebarEyebrow: string
  sidebarTitle: string
  sidebarHint: string
  navAriaLabel: string
  tabs: Array<SettingsTabDefinition<TTab>>
  activeTab: TTab
  onSelectTab: (tab: TTab) => void
  theme: SettingsTabsTheme
  sidebarFooter?: ReactNode
  activeSectionClassName: string
  activeEyebrow?: string
  activeTitle: string
  activeDescription: string
  activeBadge?: ReactNode
  children: ReactNode
}

export function SettingsTabsShell<TTab extends string>({
  sidebarEyebrow,
  sidebarTitle,
  sidebarHint,
  navAriaLabel,
  tabs,
  activeTab,
  onSelectTab,
  theme,
  sidebarFooter,
  activeSectionClassName,
  activeEyebrow = 'Onglet actif',
  activeTitle,
  activeDescription,
  activeBadge,
  children,
}: SettingsTabsShellProps<TTab>) {
  const themeClasses = {
    merchant: {
      sidebar: 'rounded-[28px] border border-gray-200 bg-[#FCFBF9] p-3 shadow-[0_22px_60px_-46px_rgba(17,24,39,0.28)] xl:sticky xl:top-6 xl:self-start',
      activeButton: 'border-[#E8D4C8] bg-[#F3EEE9] shadow-[0_14px_30px_-28px_rgba(107,65,41,0.38)] hover:border-[#E8D4C8] hover:bg-[#F3EEE9]',
      inactiveButton: 'border-transparent bg-transparent hover:border-[#EFE4DB] hover:bg-white',
      activeIcon: 'border-[#E8D4C8] bg-white text-[#9E4F2C]',
    },
    client: {
      sidebar: 'rounded-[28px] border border-gray-200 bg-[#FBFCFF] p-3 shadow-[0_22px_60px_-46px_rgba(17,24,39,0.28)] xl:sticky xl:top-6 xl:self-start',
      activeButton: 'border-sky-100 bg-sky-50 shadow-[0_14px_30px_-28px_rgba(14,116,144,0.4)] hover:border-sky-100 hover:bg-sky-50',
      inactiveButton: 'border-transparent bg-transparent hover:border-slate-200 hover:bg-white',
      activeIcon: 'border-sky-100 bg-white text-sky-600',
    },
  } as const

  const classes = themeClasses[theme]

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[260px_minmax(0,1fr)]">
      <aside className={classes.sidebar}>
        <div className="px-3 pb-3 pt-2">
          <p className="font-body text-[11px] uppercase tracking-[0.18em] text-gray-400">{sidebarEyebrow}</p>
          <h2 className="mt-2 font-display text-[2rem] font-semibold leading-none text-dark">{sidebarTitle}</h2>
          <p className="mt-3 text-sm text-gray-600">{sidebarHint}</p>
        </div>

        <nav className="space-y-1" aria-label={navAriaLabel}>
          {tabs.map((tab) => {
            const Icon = tab.icon
            const isActive = tab.id === activeTab

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onSelectTab(tab.id)}
                className={[
                  'w-full rounded-[18px] border px-4 py-3 text-left transition',
                  isActive ? classes.activeButton : classes.inactiveButton,
                ].join(' ')}
              >
                <div className="flex items-start gap-3">
                  <span
                    className={[
                      'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border',
                      isActive ? classes.activeIcon : 'border-gray-200 bg-white text-gray-500',
                    ].join(' ')}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block font-body text-sm font-semibold text-dark">{tab.label}</span>
                    <span className="mt-1 block text-xs leading-5 text-gray-500">{tab.description}</span>
                  </span>
                </div>
              </button>
            )
          })}
        </nav>

        {sidebarFooter}
      </aside>

      <div key={activeTab} className="space-y-4 fade-switch">
        <section className={activeSectionClassName}>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="font-body text-xs uppercase tracking-[0.16em] text-gray-500">{activeEyebrow}</p>
              <h2 className="mt-2 font-display text-2xl font-semibold text-dark">{activeTitle}</h2>
              <p className="mt-1 text-sm text-gray-600">{activeDescription}</p>
            </div>
            {activeBadge}
          </div>
        </section>

        {children}
      </div>
    </div>
  )
}

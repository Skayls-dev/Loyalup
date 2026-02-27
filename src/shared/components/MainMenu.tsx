import { Menu } from 'lucide-react'
import { NavLink } from 'react-router-dom'

type MainMenuItem = {
  to: string
  label: string
}

type MainMenuProps = {
  items: MainMenuItem[]
}

export function MainMenu({ items }: MainMenuProps) {
  return (
    <details className="relative">
      <summary className="btn-ghost glass-panel flex cursor-pointer list-none items-center gap-2">
        <Menu className="h-4 w-4" />
        Menu
      </summary>

      <div className="glass-panel-strong absolute right-0 z-40 mt-2 w-56 rounded-xl p-2">
        <nav className="flex flex-col gap-1">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `rounded-lg px-3 py-2 text-xs font-medium transition ${
                  isActive
                    ? 'bg-[#106EBE]/30 text-[#D7ECFF]'
                    : 'text-slate-100 hover:bg-[#106EBE]/15 hover:text-white'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </div>
    </details>
  )
}
import { NavLink } from 'react-router-dom'
import {
  IconHome2,
  IconHome2Filled,
  IconStethoscope,
  IconClipboardText,
  IconClipboardTextFilled,
  IconPill,
  IconPillFilled,
  IconSettings2,
} from '@tabler/icons-react'

function cx(...parts) {
  return parts.filter(Boolean).join(' ')
}

function ItemIcon({ kind, active }) {
  const cls = cx(active ? 'text-lavender' : 'text-text-light')
  const stroke = 2
  const props = {
    size: 24,
    stroke,
    className: cx(cls, 'block shrink-0'),
    'aria-hidden': true,
  }

  if (kind === 'home') {
    return active ? <IconHome2Filled {...props} /> : <IconHome2 {...props} />
  }

  if (kind === 'symptoms') {
    // No filled variant available — keep consistent in all states.
    return <IconStethoscope {...props} />
  }

  if (kind === 'records') {
    return active ? <IconClipboardTextFilled {...props} /> : <IconClipboardText {...props} />
  }

  if (kind === 'medicine') {
    return active ? <IconPillFilled {...props} /> : <IconPill {...props} />
  }

  // settings / profile
  return <IconSettings2 {...props} />
}

function NavItem({ to, label, kind }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cx(
          'group flex min-w-0 flex-col items-center justify-center gap-y-1 rounded-2xl px-2 py-2 transition-colors sm:px-3',
          isActive
            ? 'bg-lavender-light text-lavender'
            : 'text-text-mid hover:bg-lavender-light/70 hover:text-text-dark',
        )
      }
      end={to === '/'}
    >
      {({ isActive }) => (
        <>
          <span className="flex h-6 w-full shrink-0 items-center justify-center">
            <ItemIcon kind={kind} active={isActive} />
          </span>
          <span className="flex w-full min-w-0 justify-center">
            <span
              className={cx(
                'max-w-full whitespace-nowrap text-center text-[11px] font-semibold leading-tight tracking-tight',
                isActive ? 'text-lavender' : 'text-text-mid group-hover:text-text-dark',
              )}
            >
              {label}
            </span>
          </span>
        </>
      )}
    </NavLink>
  )
}

export function BottomNav() {
  return (
    <nav
      className="pointer-events-none fixed inset-x-0 bottom-6 z-40 flex justify-center px-4"
      aria-label="Primary navigation"
    >
      <div className="w-full max-w-md">
        <div className="pointer-events-auto rounded-[28px] border border-lavender-mid/30 bg-warm-white shadow-[0_-12px_40px_-8px_rgba(132,118,98,0.14),0_-4px_16px_-4px_rgba(132,118,98,0.08)]">
          <div className="grid grid-cols-5 gap-1 p-2">
            <NavItem to="/" label="Home" kind="home" />
            <NavItem to="/symptoms" label="Symptoms" kind="symptoms" />
            <NavItem to="/records" label="Records" kind="records" />
            <NavItem to="/prescriptions" label="Medicine" kind="medicine" />
            <NavItem to="/settings" label="Settings" kind="settings" />
          </div>
        </div>
      </div>
    </nav>
  )
}


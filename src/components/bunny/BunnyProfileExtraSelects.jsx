import {
  BUNNY_FAVORITE_HANGOUTS,
  BUNNY_FAVORITE_SNACKS,
  BUNNY_PROFILE_SELECT_CLASS,
  BUNNY_PROFILE_SELECT_STYLE,
  FAVORITE_SNACK_SELECT_OTHER,
} from '../../lib/bunnyProfileExtras'
import { Input } from '../ui/Input'

function SelectShell({ id, label, hint, value, onChange, children }) {
  return (
    <div>
      <div className="text-sm font-medium text-text-dark">{label}</div>
      {hint ? <p className="mt-1 text-xs text-text-mid">{hint}</p> : null}
      <div className="mt-2">
        <select
          id={id}
          className={BUNNY_PROFILE_SELECT_CLASS}
          style={BUNNY_PROFILE_SELECT_STYLE}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        >
          {children}
        </select>
      </div>
    </div>
  )
}

export function FavoriteSnackSelect({
  id = 'favorite_snack',
  value,
  onChange,
  customValue = '',
  onCustomChange,
  otherError = '',
}) {
  return (
    <div className="space-y-6">
      <SelectShell
        id={id}
        label="Favorite snack"
        hint="Pick something your bunny goes bonkers for — treats are tiny; hay & greens stay first."
        value={value}
        onChange={onChange}
      >
        <option value="">Not sure yet / skip</option>
        {BUNNY_FAVORITE_SNACKS.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
        <option value={FAVORITE_SNACK_SELECT_OTHER}>Other (custom treat)</option>
      </SelectShell>

      {value === FAVORITE_SNACK_SELECT_OTHER ? (
        <div>
          <label htmlFor={`${id}_custom`} className="text-sm font-medium text-text-dark">
            Describe their treat
          </label>
          <div className="mt-2">
            <Input
              id={`${id}_custom`}
              value={customValue}
              onChange={(e) => onCustomChange?.(e.target.value)}
              placeholder="e.g. forage mix, dried chamomile, rose petals…"
              autoComplete="off"
            />
          </div>
          {otherError ? <div className="mt-2 text-sm text-red-700">{otherError}</div> : null}
        </div>
      ) : null}
    </div>
  )
}

export function FavoriteHangoutSelect({ id = 'favorite_hangout', value, onChange }) {
  return (
    <SelectShell
      id={id}
      label="Favorite hangout"
      hint="Where they loaf, zoomie, or demand head rubs."
      value={value}
      onChange={onChange}
    >
      <option value="">Not sure yet / skip</option>
      {BUNNY_FAVORITE_HANGOUTS.map((o) => (
        <option key={o.id} value={o.id}>
          {o.label}
        </option>
      ))}
    </SelectShell>
  )
}

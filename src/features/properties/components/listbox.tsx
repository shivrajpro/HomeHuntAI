import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'

import { cn } from '@/lib/utils'

/**
 * The shared anatomy of the filter bar's custom dropdowns — a popover rather
 * than a native `<select>`, so the option menu carries the same rounded rows,
 * hover states, theme colors and checkmarks in every picker (native
 * `<option>` menus can't be styled). `SelectMenu` (single) and
 * `BhkMultiSelect` (multi) compose these pieces.
 */

/** Field styling shared by the search input and every dropdown trigger. */
export const selectClass = cn(
  'h-10 rounded-md border border-input bg-background px-3 text-sm outline-none',
  'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
)

/** The floating option panel. */
export const listboxPanelClass =
  'absolute z-20 mt-1 min-w-40 rounded-md border border-border/60 bg-popover p-1 shadow-md'

/**
 * Popover open state that closes on outside click or Escape, so the panel
 * behaves like a native menu. Attach `ref` to the wrapper that contains both
 * the trigger and the panel.
 */
export function useDismissablePopover() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onPointerDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return { open, setOpen, ref }
}

/** The dropdown's trigger button: current label + chevron, muted when empty. */
export function ListboxTrigger({
  ariaLabel,
  open,
  onToggle,
  muted,
  label,
}: {
  ariaLabel: string
  open: boolean
  onToggle: () => void
  /** Render the label in placeholder styling (nothing selected yet). */
  muted: boolean
  label: string
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      aria-haspopup="listbox"
      aria-expanded={open}
      onClick={onToggle}
      className={cn(selectClass, 'flex w-full items-center justify-between gap-2')}
    >
      <span className={cn('truncate', muted && 'text-muted-foreground')}>
        {label}
      </span>
      <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
    </button>
  )
}

/** One option row — checkmarked when selected. */
export function ListboxOption({
  label,
  selected,
  onSelect,
}: {
  label: string
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      onClick={onSelect}
      className="flex w-full items-center justify-between gap-3 rounded px-2 py-1.5 text-left text-sm hover:bg-accent"
    >
      <span>{label}</span>
      {selected && <Check className="size-4 text-primary" />}
    </button>
  )
}

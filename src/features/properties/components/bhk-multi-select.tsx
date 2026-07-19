import { BHK_OPTIONS } from '@/features/properties/filter-form'

import {
  ListboxOption,
  ListboxTrigger,
  listboxPanelClass,
  useDismissablePopover,
} from './listbox'

/** Exact-match, multiselect BHK picker — "2 BHK" means exactly 2, not "2 or more". */
export function BhkMultiSelect({
  selected,
  onChange,
}: {
  selected: number[]
  onChange: (next: number[]) => void
}) {
  const { open, setOpen, ref } = useDismissablePopover()

  function toggle(bhk: number) {
    onChange(
      selected.includes(bhk)
        ? selected.filter((b) => b !== bhk)
        : [...selected, bhk].sort((a, b) => a - b),
    )
  }

  const label =
    selected.length === 0
      ? 'Any BHK'
      : `${[...selected].sort((a, b) => a - b).join(', ')} BHK`

  return (
    <div ref={ref} className="relative">
      <ListboxTrigger
        ariaLabel="BHK"
        open={open}
        onToggle={() => setOpen((o) => !o)}
        muted={selected.length === 0}
        label={label}
      />

      {open && (
        <div role="listbox" aria-multiselectable className={listboxPanelClass}>
          {BHK_OPTIONS.map((b) => (
            <ListboxOption
              key={b}
              label={`${b} BHK`}
              selected={selected.includes(b)}
              onSelect={() => toggle(b)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

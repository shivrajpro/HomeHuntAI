import {
  ListboxOption,
  ListboxTrigger,
  listboxPanelClass,
  useDismissablePopover,
} from './listbox'

export interface SelectOption {
  value: string
  label: string
}

/**
 * Single-select dropdown styled to match {@link BhkMultiSelect} — a custom
 * popover rather than a native `<select>`, so the option menu carries the same
 * rounded rows, hover states, theme colors, and checkmark as the BHK picker
 * (native `<option>` menus can't be styled). An option whose `value` is ''
 * acts as the "any"/placeholder and shows muted trigger text when active.
 */
export function SelectMenu({
  value,
  options,
  onChange,
  ariaLabel,
}: {
  value: string
  options: SelectOption[]
  onChange: (value: string) => void
  ariaLabel: string
}) {
  const { open, setOpen, ref } = useDismissablePopover()

  const isPlaceholder = value === ''
  const label = options.find((o) => o.value === value)?.label ?? options[0]?.label

  return (
    <div ref={ref} className="relative">
      <ListboxTrigger
        ariaLabel={ariaLabel}
        open={open}
        onToggle={() => setOpen((o) => !o)}
        muted={isPlaceholder}
        label={label}
      />

      {open && (
        <div role="listbox" className={listboxPanelClass}>
          {options.map((o) => (
            <ListboxOption
              key={o.value}
              label={o.label}
              selected={o.value === value}
              onSelect={() => {
                onChange(o.value)
                setOpen(false)
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}

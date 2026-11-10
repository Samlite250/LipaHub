import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, Globe2 } from 'lucide-react'
import countryData from '../../shared/countries.json' with { type: 'json' }
import 'intl-tel-input/styles'

const options = [
  ...countryData.map(country => ({ ...country, display: country.name.replace(/^St\./, 'Saint') }))
    .sort((a, b) => a.display.localeCompare(b.display, 'en')),
  { name: 'International', display: 'International / Other countries', iso2: '', dialCode: '' },
]

function Flag({ iso2, dialCode }: { iso2: string; dialCode: string }) {
  return dialCode ? <span className={`iti__flag iti__${iso2}`} aria-hidden="true" /> : <Globe2 size={20} aria-hidden="true" />
}

export function CountrySelect({ value, onChange, label, required = false }: {
  value: string; onChange: (value: string) => void; label: string; required?: boolean
}) {
  const id = useId()
  const trigger = useRef<HTMLInputElement>(null)
  const popup = useRef<HTMLDivElement>(null)
  const list = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const selected = options.find(country => country.name === value) || options[options.length - 1]

  function show() {
    setActive(Math.max(0, options.findIndex(country => country.name === value)))
    setOpen(true)
  }
  function close(restoreFocus = false) {
    setOpen(false)
    if (restoreFocus) trigger.current?.focus({ preventScroll: true })
  }
  function choose(index: number) {
    if (!options[index]) return
    onChange(options[index].name)
    close(true)
  }
  function keyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === 'Escape') { event.preventDefault(); close(true) }
    if (event.key === 'Tab') close(true)
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      setActive(index => Math.max(0, Math.min(options.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1))))
    }
    if (event.key === 'Home') { event.preventDefault(); setActive(0) }
    if (event.key === 'End') { event.preventDefault(); setActive(options.length - 1) }
    if (event.key === 'Enter') { event.preventDefault(); choose(active) }
  }

  useLayoutEffect(() => {
    if (!open) return
    function position() {
      const box = trigger.current?.getBoundingClientRect()
      if (!box || !popup.current) return
      const width = Math.min(box.width, window.innerWidth - 32)
      const below = window.innerHeight - box.bottom - 16
      const above = box.top - 16
      const upward = below < 200 && above > below
      popup.current.style.width = `${width}px`
      popup.current.style.left = `${Math.max(16, Math.min(box.left, window.innerWidth - width - 16))}px`
      popup.current.style.top = upward ? 'auto' : `${box.bottom + 3}px`
      popup.current.style.bottom = upward ? `${window.innerHeight - box.top + 3}px` : 'auto'
      if (list.current) list.current.style.maxHeight = `${Math.max(64, Math.min(200, (upward ? above : below) - 2))}px`
    }
    position()
    list.current?.focus({ preventScroll: true })
    window.addEventListener('resize', position)
    window.addEventListener('scroll', position, true)
    return () => {
      window.removeEventListener('resize', position)
      window.removeEventListener('scroll', position, true)
    }
  }, [open])

  useLayoutEffect(() => {
    if (!open) return
    const option = list.current?.children[active] as HTMLElement | undefined
    if (option && list.current && option.getAttribute('aria-label') === trigger.current?.value) {
      list.current.scrollTop = option.offsetTop - list.current.offsetTop - 64
    } else option?.scrollIntoView({ block: 'nearest' })
  }, [open, active])

  useEffect(() => {
    if (!open) return
    function outside(event: PointerEvent) {
      if (event.target instanceof Node && !popup.current?.contains(event.target) && event.target !== trigger.current) setOpen(false)
    }
    document.addEventListener('pointerdown', outside)
    return () => document.removeEventListener('pointerdown', outside)
  }, [open])

  return <div className="country-select">
    <label htmlFor={`${id}-trigger`}>{label}{required && <em> *</em>}</label>
    <div className="country-select-field">
      <span className="country-select-flag"><Flag {...selected} /></span>
      <input ref={trigger} id={`${id}-trigger`} name="country" value={value} readOnly required={required}
        role="combobox" aria-expanded={open} aria-haspopup="listbox" aria-controls={open ? `${id}-list` : undefined}
        onClick={() => open ? close() : show()} onKeyDown={event => {
          if (open) keyDown(event)
          else if (['Enter', ' ', 'ArrowDown', 'ArrowUp'].includes(event.key)) { event.preventDefault(); show() }
        }} />
      <ChevronDown className="country-select-arrow" size={16} aria-hidden="true" />
    </div>
    {open && createPortal(<div className="country-select-popup" ref={popup}>
      <div ref={list} id={`${id}-list`} className="country-select-list" role="listbox" aria-label="Countries" tabIndex={-1} onKeyDown={keyDown}
        aria-activedescendant={`${id}-option-${options[active].iso2 || 'international'}`}>
        {options.map((country, index) => <div key={country.name} id={`${id}-option-${country.iso2 || 'international'}`}
          className={`country-select-option${index === active ? ' is-active' : ''}`} role="option" aria-label={country.name}
          aria-selected={country.name === value} onPointerMove={() => setActive(index)} onMouseDown={event => event.preventDefault()} onClick={() => choose(index)}>
          <Flag {...country} /><span>{country.display}</span>{country.dialCode && <span className="country-select-code">{country.dialCode}</span>}
        </div>)}
      </div>
    </div>, document.body)}
  </div>
}

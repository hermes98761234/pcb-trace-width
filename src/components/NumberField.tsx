import { useState } from 'react'

interface Props {
  label: string
  /** Value in base units. */
  value: number
  /** Base units per displayed unit. */
  factor?: number
  unit?: string
  step?: number
  onChange: (v: number) => void
}

const show = (v: number) => String(Number(v.toPrecision(6)))

export default function NumberField({ label, value, factor = 1, unit, step, onChange }: Props) {
  const [text, setText] = useState(show(value / factor))
  // Re-sync the text when the value changes from outside (presets, unit switch), not from typing.
  const [prev, setPrev] = useState({ value, factor })
  if (prev.value !== value || prev.factor !== factor) {
    setPrev({ value, factor })
    if (Math.abs(Number(text) * factor - value) > 1e-9 * Math.max(1, Math.abs(value))) setText(show(value / factor))
  }
  const n = Number(text)
  const bad = text.trim() === '' || !Number.isFinite(n) || n <= 0
  return (
    <div className="field">
      <label>
        {label}
        {unit ? ` (${unit})` : ''}
      </label>
      <input
        type="number"
        inputMode="decimal"
        step={step ?? 'any'}
        className={bad ? 'bad' : ''}
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          const v = Number(e.target.value)
          if (e.target.value.trim() !== '' && Number.isFinite(v) && v > 0) onChange(v * factor)
        }}
      />
    </div>
  )
}

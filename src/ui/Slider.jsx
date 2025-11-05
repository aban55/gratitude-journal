export function Slider({ min=1, max=10, step=1, value, onChange }) {
  const v = Array.isArray(value) ? value[0] : value
  return (
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={v}
      onChange={(e) => onChange([Number(e.target.value)])}
      className="w-full accent-green-600"
    />
  )
}

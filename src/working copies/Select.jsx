export function Select({ value, onChange, options=[], placeholder='Select...' }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-xl border border-gray-300 p-2 bg-white focus:outline-none focus:ring-2 focus:ring-green-500"
    >
      <option value="" disabled>{placeholder}</option>
      {options.map((opt) => (
        <option key={opt} value={opt}>{opt}</option>
      ))}
    </select>
  )
}

export function Textarea({ value, onChange, placeholder='' }) {
  return (
    <textarea
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className="w-full min-h-[120px] rounded-xl border border-gray-300 p-3 focus:outline-none focus:ring-2 focus:ring-green-500"
    />
  )
}

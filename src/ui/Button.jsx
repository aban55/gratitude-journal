export function Button({ children, onClick, variant='default', className='' }) {
  const base = 'px-4 py-2 rounded-xl text-sm font-medium transition active:scale-[.99]'
  const styles = variant === 'outline'
    ? 'border border-gray-300 bg-white hover:bg-gray-50'
    : 'bg-green-600 text-white hover:bg-green-700'
  return <button onClick={onClick} className={`${base} ${styles} ${className}`}>{children}</button>
}

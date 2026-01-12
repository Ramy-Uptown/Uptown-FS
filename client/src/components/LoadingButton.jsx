import React from 'react'

/**
 * LoadingButton
 * - Shows a subtle loading state and disables while loading.
 * - Variants: 'default' and 'primary' to match existing style tokens.
 */
export default function LoadingButton({
  loading = false,
  disabled = false,
  children,
  onClick,
  variant = 'default',
  className = '',
  style,
  ...rest
}) {
  const baseClasses = "px-3 py-2 rounded-lg border text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
  
  const variantClasses = variant === 'primary' 
    ? "px-3.5 py-2.5 rounded-xl border-blue-600 bg-blue-600 text-white hover:bg-blue-700 font-semibold" 
    : "border-slate-300 bg-white text-slate-900 hover:bg-slate-50"

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className={`${baseClasses} ${variantClasses} ${className}`}
      style={style}
      {...rest}
    >
      {loading ? (
        <>
          <svg className="animate-spin h-4 w-4 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          {typeof children === 'string' ? children.replace(/\.\.\.$/, '') : children}
        </>
      ) : (
        children
      )}
    </button>
  )
}
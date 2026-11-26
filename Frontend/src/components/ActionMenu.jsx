import { useEffect, useRef, useState } from 'react'

export default function ActionMenu({ label, title = label, className = '', triggerClassName, menuClassName, trigger, children }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)
  const triggerRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined

    function handlePointerDown(event) {
      if (!rootRef.current?.contains(event.target)) setOpen(false)
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setOpen(false)
        triggerRef.current?.focus()
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  return (
    <div ref={rootRef} className={`${className}${open ? ' is-open' : ''}`}>
      <button
        ref={triggerRef}
        type="button"
        className={triggerClassName}
        aria-label={label}
        title={title}
        aria-expanded={open}
        onClick={() => setOpen((currentlyOpen) => !currentlyOpen)}
      >
        {trigger}
      </button>
      {open && <div className={menuClassName} onClick={() => setOpen(false)}>{children}</div>}
    </div>
  )
}

"use client"

import { useRef, useState } from "react"

import { cn } from "@/lib/utils"

export type SwipeAction = {
  label: string
  icon?: React.ReactNode
  onClick: () => void
  className?: string
  disabled?: boolean
}

type SwipeableActionCardProps = {
  actions: SwipeAction[]
  children: React.ReactNode
  className?: string
  /** Width in px for each action button. Default: 72 */
  actionItemWidth?: number
}

export function SwipeableActionCard({
  actions,
  children,
  className,
  actionItemWidth = 72,
}: SwipeableActionCardProps) {
  const panelWidth = actions.length * actionItemWidth
  const [translateX, setTranslateX] = useState(0)
  const [transitioning, setTransitioning] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const startXRef = useRef(0)
  const startTranslateRef = useRef(0)
  const dragging = useRef(false)

  const snapTo = (target: number) => {
    setTransitioning(true)
    setTranslateX(target)
    setIsOpen(target !== 0)
  }

  const close = () => snapTo(0)

  const onTouchStart = (e: React.TouchEvent) => {
    startXRef.current = e.touches[0].clientX
    startTranslateRef.current = translateX
    dragging.current = true
    setTransitioning(false)
  }

  const onTouchMove = (e: React.TouchEvent) => {
    if (!dragging.current) return
    const delta = e.touches[0].clientX - startXRef.current
    const next = Math.min(0, Math.max(-panelWidth, startTranslateRef.current + delta))
    setTranslateX(next)
  }

  const onTouchEnd = () => {
    dragging.current = false
    if (-translateX > panelWidth * 0.35) {
      snapTo(-panelWidth)
    } else {
      snapTo(0)
    }
  }

  if (actions.length === 0) {
    return <div className={className}>{children}</div>
  }

  return (
    <div className={cn("relative overflow-hidden rounded-lg", className)}>
      {/* Action panel — sits behind the sliding card content */}
      <div
        aria-hidden="true"
        className="absolute inset-y-0 right-0 flex"
        style={{ width: panelWidth }}
      >
        {actions.map((action, i) => (
          <button
            className={cn(
              "flex flex-1 flex-col items-center justify-center gap-1.5 px-1 py-2 text-xs font-semibold text-white active:opacity-80",
              action.disabled && "pointer-events-none opacity-40",
              action.className,
            )}
            disabled={action.disabled}
            key={i}
            onClick={() => {
              close()
              action.onClick()
            }}
            type="button"
          >
            {action.icon}
            <span className="text-center leading-tight">{action.label}</span>
          </button>
        ))}
      </div>

      {/* Card content — slides left on swipe */}
      <div
        className={cn(
          "relative z-10 touch-pan-y select-none",
          transitioning && "transition-transform duration-200 ease-out",
        )}
        onTouchEnd={onTouchEnd}
        onTouchMove={onTouchMove}
        onTouchStart={onTouchStart}
        style={{ transform: `translateX(${translateX}px)` }}
      >
        {children}
      </div>

      {/* Invisible overlay to close on tap when open */}
      {isOpen && (
        <button
          aria-label="Close actions"
          className="absolute inset-0 z-20 cursor-default"
          onClick={close}
          type="button"
        />
      )}
    </div>
  )
}

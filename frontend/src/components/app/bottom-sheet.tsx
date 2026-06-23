"use client"

/**
 * BottomSheet — mobile-optimized sheet that slides up from the bottom.
 *
 * Features:
 *  - Drag handle pill with swipe-down-to-close gesture
 *  - Three size variants: auto (85dvh) | lg (95dvh) | full (100dvh)
 *  - Sticky header + sticky safe-area-aware footer
 *  - Scrollable body between header and footer
 *  - Drop-in replacement for Dialog on mobile
 *
 * Usage:
 *
 *   <BottomSheet open={open} onOpenChange={setOpen}>
 *     <BottomSheetTrigger render={<Button />}>Open</BottomSheetTrigger>
 *     <BottomSheetContent size="auto">
 *       <BottomSheetHeader>
 *         <BottomSheetTitle>Title</BottomSheetTitle>
 *         <BottomSheetDescription>Optional description</BottomSheetDescription>
 *       </BottomSheetHeader>
 *       <BottomSheetBody>
 *         {children}
 *       </BottomSheetBody>
 *       <BottomSheetFooter>
 *         <BottomSheetClose render={<Button variant="outline" />}>Cancel</BottomSheetClose>
 *         <Button onClick={handleSave}>Save</Button>
 *       </BottomSheetFooter>
 *     </BottomSheetContent>
 *   </BottomSheet>
 *
 * Mobile + Desktop pattern (bottom sheet on mobile, dialog on desktop):
 *
 *   // Use sm:hidden / hidden sm:block to show the right one per breakpoint.
 *   // BottomSheet is always rendered but only visible on mobile.
 */

import * as React from "react"

import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { cn } from "@/lib/utils"

// ---------------------------------------------------------------------------
// Context — passes the close callback down to the drag handle
// ---------------------------------------------------------------------------

interface BottomSheetContextValue {
  close: () => void
}

const BottomSheetContext = React.createContext<BottomSheetContextValue>({
  close: () => {},
})

// ---------------------------------------------------------------------------
// Root
// ---------------------------------------------------------------------------

function BottomSheet({
  onOpenChange,
  children,
  ...props
}: React.ComponentProps<typeof Sheet>) {
  const close = React.useCallback(() => {
    // Base UI's onOpenChange signature includes an event arg; cast for programmatic close
    if (onOpenChange) (onOpenChange as (open: boolean) => void)(false)
  }, [onOpenChange])

  return (
    <BottomSheetContext.Provider value={{ close }}>
      <Sheet onOpenChange={onOpenChange} {...props}>
        {children}
      </Sheet>
    </BottomSheetContext.Provider>
  )
}

// ---------------------------------------------------------------------------
// Internal drag handle — swiping down > 60px closes the sheet
// ---------------------------------------------------------------------------

function BottomSheetHandle() {
  const { close } = React.useContext(BottomSheetContext)
  const startY = React.useRef(0)
  const didDrag = React.useRef(false)

  return (
    <div
      aria-hidden
      className="flex shrink-0 touch-none select-none justify-center py-3"
      onTouchEnd={(e) => {
        if (!didDrag.current) return
        const dy = e.changedTouches[0].clientY - startY.current
        if (dy > 60) close()
        didDrag.current = false
      }}
      onTouchMove={(e) => {
        if (e.touches[0].clientY - startY.current > 10) didDrag.current = true
      }}
      onTouchStart={(e) => {
        startY.current = e.touches[0].clientY
        didDrag.current = false
      }}
    >
      <div className="h-1.5 w-12 rounded-full bg-muted-foreground/20 transition-colors active:bg-muted-foreground/40" />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Content
// ---------------------------------------------------------------------------

type BottomSheetSize = "auto" | "lg" | "full"

function BottomSheetContent({
  className,
  children,
  size = "auto",
  ...props
}: Omit<React.ComponentProps<typeof SheetContent>, "side" | "showCloseButton"> & {
  size?: BottomSheetSize
}) {
  return (
    <SheetContent
      side="bottom"
      showCloseButton={false}
      className={cn(
        "gap-0 overflow-y-auto overscroll-contain p-0",
        size === "auto" && "max-h-[85dvh] rounded-t-2xl",
        size === "lg" && "max-h-[95dvh] rounded-t-2xl",
        size === "full" && "h-dvh max-h-none rounded-t-2xl",
        className
      )}
      {...props}
    >
      <BottomSheetHandle />
      {children}
    </SheetContent>
  )
}

// ---------------------------------------------------------------------------
// Header — sticky at the top of the scroll container
// ---------------------------------------------------------------------------

function BottomSheetHeader({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="bottom-sheet-header"
      className={cn(
        "sticky top-0 z-10 flex flex-col gap-1 border-b bg-popover px-4 pb-4 pt-1",
        className
      )}
      {...props}
    />
  )
}

// ---------------------------------------------------------------------------
// Title & Description
// ---------------------------------------------------------------------------

function BottomSheetTitle({
  className,
  ...props
}: React.ComponentProps<typeof SheetTitle>) {
  return (
    <SheetTitle
      className={cn("font-heading text-base font-semibold leading-snug", className)}
      {...props}
    />
  )
}

function BottomSheetDescription({
  className,
  ...props
}: React.ComponentProps<typeof SheetDescription>) {
  return (
    <SheetDescription
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

// ---------------------------------------------------------------------------
// Body — main scrollable content area between header and footer
// ---------------------------------------------------------------------------

function BottomSheetBody({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="bottom-sheet-body"
      className={cn("flex flex-col gap-4 px-4 py-4", className)}
      {...props}
    />
  )
}

// ---------------------------------------------------------------------------
// Footer — sticky at the bottom, respects iOS safe area
// ---------------------------------------------------------------------------

function BottomSheetFooter({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="bottom-sheet-footer"
      className={cn(
        "sticky bottom-0 z-10 flex flex-col gap-2 border-t bg-popover px-4 pt-3",
        "pb-[max(16px,env(safe-area-inset-bottom))]",
        className
      )}
      {...props}
    />
  )
}

// ---------------------------------------------------------------------------
// Trigger & Close (pass-through re-exports)
// ---------------------------------------------------------------------------

const BottomSheetTrigger = SheetTrigger
const BottomSheetClose = SheetClose

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export {
  BottomSheet,
  BottomSheetBody,
  BottomSheetClose,
  BottomSheetContent,
  BottomSheetDescription,
  BottomSheetFooter,
  BottomSheetHeader,
  BottomSheetTitle,
  BottomSheetTrigger,
}

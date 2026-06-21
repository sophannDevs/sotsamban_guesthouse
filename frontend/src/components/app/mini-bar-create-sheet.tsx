"use client"

import { useEffect, useMemo, useState } from "react"
import {
  AlertCircleIcon,
  CreditCardIcon,
  MartiniIcon,
  SaveIcon,
  UserIcon,
  XIcon,
} from "lucide-react"
import { useTranslations } from "next-intl"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { bookingService, type Booking } from "@/lib/bookings"
import { guesthouseStoreLinkService, type StoreLink } from "@/lib/guesthouse-store-link"
import {
  getMiniBarErrorMessage,
  miniBarConsumptionService,
  type MiniBarConsumption,
  type MiniBarProduct,
} from "@/lib/mini-bar-consumption"

type CartItem = {
  product: MiniBarProduct
  quantity: number
}

type MiniBarCreateSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (consumption: MiniBarConsumption) => void
  /**
   * When provided, the booking picker is skipped and the sheet creates
   * consumption entries for this booking only (e.g. from the booking detail
   * view, where the booking is already known).
   */
  lockedBooking?: Booking
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value)
}

export function MiniBarCreateSheet({
  open,
  onOpenChange,
  onCreated,
  lockedBooking,
}: MiniBarCreateSheetProps) {
  const t = useTranslations()

  const [loadingFormData, setLoadingFormData] = useState(false)
  const [eligibleBookings, setEligibleBookings] = useState<Booking[]>([])
  const [storeLink, setStoreLink] = useState<StoreLink | null>(null)
  const [selectedBookingId, setSelectedBookingId] = useState("")
  const [eligibleProducts, setEligibleProducts] = useState<MiniBarProduct[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [selectedProductId, setSelectedProductId] = useState("")
  const [quantity, setQuantity] = useState(1)
  const [createError, setCreateError] = useState<string | null>(null)
  const [isSavingDraft, setIsSavingDraft] = useState(false)
  const [isChargingNow, setIsChargingNow] = useState(false)

  const selectedBooking = useMemo(
    () =>
      lockedBooking ?? eligibleBookings.find((b) => b.id === selectedBookingId) ?? null,
    [lockedBooking, eligibleBookings, selectedBookingId],
  )

  const selectedProduct = useMemo(
    () => eligibleProducts.find((p) => p.id === selectedProductId) ?? null,
    [eligibleProducts, selectedProductId],
  )

  const cartTotal = useMemo(
    () => cart.reduce((sum, item) => sum + item.product.sellingPrice * item.quantity, 0),
    [cart],
  )

  const quantityWarning = useMemo(() => {
    if (!selectedProduct) return null
    const inCart = cart.find((c) => c.product.id === selectedProductId)
    const alreadyInCart = inCart ? inCart.quantity : 0
    if (alreadyInCart + quantity > selectedProduct.stockQuantity) {
      return t("miniBar.notEnoughStock", {
        stock: Math.max(selectedProduct.stockQuantity - alreadyInCart, 0),
      })
    }
    return null
  }, [selectedProduct, quantity, cart, selectedProductId, t])

  const bookingId = lockedBooking?.id ?? selectedBookingId

  // Reload booking/product/store-link data every time the sheet opens. The
  // `open` prop is controlled by the parent (no SheetTrigger is used here),
  // so this must react to the prop itself rather than Sheet's onOpenChange,
  // which only fires for the component's own internal interactions.
  useEffect(() => {
    if (!open) return

    let ignore = false

    async function load() {
      setCart([])
      setSelectedBookingId("")
      setSelectedProductId("")
      setQuantity(1)
      setCreateError(null)
      setLoadingFormData(true)

      try {
        const [bookings, link] = await Promise.all([
          lockedBooking ? Promise.resolve([]) : bookingService.list(),
          guesthouseStoreLinkService.getLink(),
        ])
        if (ignore) return

        setEligibleBookings(
          bookings.filter((b) => b.status === "CHECKED_IN" || b.status === "CHECKED_OUT"),
        )
        setStoreLink(link)

        if (link) {
          const products = await miniBarConsumptionService.listEligibleProducts()
          if (!ignore) setEligibleProducts(products)
        } else {
          setEligibleProducts([])
        }
      } catch (error) {
        if (!ignore) setCreateError(getMiniBarErrorMessage(error))
      } finally {
        if (!ignore) setLoadingFormData(false)
      }
    }

    void load()

    return () => {
      ignore = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  function handleAddToCart() {
    if (!selectedProduct || quantity < 1 || quantityWarning) return

    setCart((prev) => {
      const existing = prev.find((c) => c.product.id === selectedProductId)
      if (existing) {
        return prev.map((c) =>
          c.product.id === selectedProductId
            ? { ...c, quantity: c.quantity + quantity }
            : c,
        )
      }
      return [...prev, { product: selectedProduct, quantity }]
    })

    setSelectedProductId("")
    setQuantity(1)
  }

  function removeFromCart(productId: string) {
    setCart((prev) => prev.filter((c) => c.product.id !== productId))
  }

  function updateCartQty(productId: string, newQty: number) {
    if (newQty < 1) return
    setCart((prev) =>
      prev.map((c) => (c.product.id === productId ? { ...c, quantity: newQty } : c)),
    )
  }

  async function handleSaveDraft() {
    if (!bookingId || cart.length === 0) return
    setCreateError(null)
    setIsSavingDraft(true)

    try {
      const created = await miniBarConsumptionService.create({
        bookingId,
        items: cart.map((c) => ({ productId: c.product.id, quantity: c.quantity })),
      })
      onCreated(created)
      onOpenChange(false)
    } catch (error) {
      setCreateError(getMiniBarErrorMessage(error))
    } finally {
      setIsSavingDraft(false)
    }
  }

  async function handleChargeNow() {
    if (!bookingId || cart.length === 0) return
    setCreateError(null)
    setIsChargingNow(true)

    try {
      const created = await miniBarConsumptionService.create({
        bookingId,
        items: cart.map((c) => ({ productId: c.product.id, quantity: c.quantity })),
      })

      try {
        const charged = await miniBarConsumptionService.charge(created.id)
        onCreated(charged)
        onOpenChange(false)
      } catch (chargeError) {
        setCreateError(getMiniBarErrorMessage(chargeError))
        onCreated(created)
      }
    } catch (error) {
      setCreateError(getMiniBarErrorMessage(error))
    } finally {
      setIsChargingNow(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-lg" side="right">
        <SheetHeader className="border-b px-5 py-4">
          <SheetTitle className="flex items-center gap-2">
            <MartiniIcon className="size-5" />
            {t("miniBar.newConsumption")}
          </SheetTitle>
          <SheetDescription>{t("miniBar.newConsumptionDescription")}</SheetDescription>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-0 overflow-hidden">
          <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
            {createError ? (
              <Alert variant="destructive">
                <AlertCircleIcon />
                <AlertTitle>{t("miniBar.consumptionCouldNotBeCreated")}</AlertTitle>
                <AlertDescription>{createError}</AlertDescription>
              </Alert>
            ) : null}

            {loadingFormData ? (
              <p className="text-sm text-muted-foreground">{t("miniBar.loadingFormData")}</p>
            ) : (
              <>
                {/* Booking picker (hidden when locked to a known booking) */}
                <div className="flex flex-col gap-2">
                  <Label htmlFor="bookingSelect">{t("miniBar.selectBooking")}</Label>
                  {lockedBooking ? null : eligibleBookings.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      {t("miniBar.noEligibleBookings")}
                    </p>
                  ) : (
                    <Select
                      items={eligibleBookings.map((b) => ({
                        value: b.id,
                        label: `${b.guest.fullName} — ${t("miniBar.roomLabel", { roomNumber: b.room.roomNumber })}`,
                      }))}
                      value={selectedBookingId}
                      onValueChange={(v) => setSelectedBookingId(v ?? "")}
                    >
                      <SelectTrigger id="bookingSelect" className="w-full">
                        <SelectValue placeholder={t("miniBar.selectBookingPlaceholder")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {eligibleBookings.map((b) => (
                            <SelectItem key={b.id} value={b.id}>
                              <span className="font-medium">{b.guest.fullName}</span>
                              <span className="ml-1 text-xs text-muted-foreground">
                                {t("miniBar.roomLabel", { roomNumber: b.room.roomNumber })}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  )}
                  {selectedBooking ? (
                    <div className="flex items-center gap-3 rounded-md border bg-muted/30 p-3 text-sm">
                      <UserIcon className="size-4 shrink-0 text-muted-foreground" />
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate font-medium">
                          {selectedBooking.guest.fullName}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {t("miniBar.roomLabel", { roomNumber: selectedBooking.room.roomNumber })}
                        </span>
                      </div>
                    </div>
                  ) : null}
                </div>

                <Separator />

                {!storeLink ? (
                  <Alert variant="destructive">
                    <AlertCircleIcon />
                    <AlertTitle>{t("miniBar.noStoreLinkedTitle")}</AlertTitle>
                    <AlertDescription>{t("miniBar.noStoreLinkedDescription")}</AlertDescription>
                  </Alert>
                ) : (
                  <div className="flex flex-col gap-3">
                    <p className="text-sm font-medium">{t("miniBar.addItems")}</p>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <div className="flex-1">
                        <Label htmlFor="productSelect" className="sr-only">
                          {t("store.product")}
                        </Label>
                        <Select
                          items={eligibleProducts.map((p) => ({
                            value: p.id,
                            label: `${p.name} — ${p.sku} (${t("store.stockLabel", { n: p.stockQuantity })})`,
                          }))}
                          value={selectedProductId}
                          onValueChange={(v) => {
                            setSelectedProductId(v ?? "")
                            setQuantity(1)
                          }}
                        >
                          <SelectTrigger id="productSelect" className="w-full">
                            <SelectValue placeholder={t("miniBar.selectProductPlaceholder")} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectGroup>
                              {eligibleProducts.map((p) => (
                                <SelectItem key={p.id} value={p.id}>
                                  <span className="font-medium">{p.name}</span>
                                  <span className="ml-1 text-xs text-muted-foreground">
                                    {p.sku} · {formatCurrency(p.sellingPrice)} ·{" "}
                                    {t("store.stockLabel", { n: p.stockQuantity })}
                                  </span>
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex gap-2">
                        <Input
                          aria-label={t("miniBar.quantity")}
                          className="w-20"
                          min={1}
                          max={selectedProduct?.stockQuantity ?? 999}
                          type="number"
                          value={quantity}
                          onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
                        />
                        <Button
                          disabled={!selectedProduct || Boolean(quantityWarning)}
                          onClick={handleAddToCart}
                          type="button"
                        >
                          {t("miniBar.addItem")}
                        </Button>
                      </div>
                    </div>
                    {quantityWarning ? (
                      <p className="text-sm text-destructive">{quantityWarning}</p>
                    ) : null}
                    {eligibleProducts.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        {t("miniBar.noEligibleProducts")}
                      </p>
                    ) : null}

                    {cart.length === 0 ? (
                      <div className="flex flex-col items-center justify-center gap-2 py-8 text-muted-foreground">
                        <MartiniIcon className="size-10 opacity-30" />
                        <p className="text-sm">{t("miniBar.cartEmpty")}</p>
                      </div>
                    ) : (
                      <div className="flex flex-col rounded-lg border">
                        {cart.map((item, index) => (
                          <div
                            key={item.product.id}
                            className={`flex items-center gap-3 p-3 ${index > 0 ? "border-t" : ""}`}
                          >
                            <div className="flex min-w-0 flex-1 flex-col">
                              <span className="truncate font-medium">{item.product.name}</span>
                              <span className="text-xs text-muted-foreground">
                                {formatCurrency(item.product.sellingPrice)} {t("store.each")}
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Button
                                aria-label={t("miniBar.decreaseQuantity")}
                                className="size-7"
                                onClick={() => updateCartQty(item.product.id, item.quantity - 1)}
                                size="icon-sm"
                                type="button"
                                variant="outline"
                              >
                                −
                              </Button>
                              <span className="w-8 text-center text-sm font-medium">
                                {item.quantity}
                              </span>
                              <Button
                                aria-label={t("miniBar.increaseQuantity")}
                                className="size-7"
                                onClick={() => updateCartQty(item.product.id, item.quantity + 1)}
                                size="icon-sm"
                                type="button"
                                variant="outline"
                              >
                                +
                              </Button>
                            </div>
                            <span className="w-20 text-right font-mono text-sm">
                              {formatCurrency(item.product.sellingPrice * item.quantity)}
                            </span>
                            <Button
                              aria-label={t("miniBar.removeItem")}
                              onClick={() => removeFromCart(item.product.id)}
                              size="icon-sm"
                              type="button"
                              variant="ghost"
                            >
                              <XIcon />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Sticky footer: total + Save Draft + Charge Now */}
          <div className="sticky bottom-0 border-t bg-muted/30 p-4 pb-[max(16px,env(safe-area-inset-bottom))]">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-medium">{t("store.total")}</span>
              <span className="font-mono text-xl font-semibold">{formatCurrency(cartTotal)}</span>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                className="flex-1"
                disabled={!storeLink || !bookingId || cart.length === 0 || isSavingDraft || isChargingNow}
                onClick={() => void handleSaveDraft()}
                type="button"
                variant="outline"
              >
                <SaveIcon data-icon="inline-start" />
                {isSavingDraft ? t("miniBar.saving") : t("miniBar.saveDraft")}
              </Button>
              <Button
                className="flex-1"
                disabled={!storeLink || !bookingId || cart.length === 0 || isSavingDraft || isChargingNow}
                onClick={() => void handleChargeNow()}
                type="button"
              >
                <CreditCardIcon data-icon="inline-start" />
                {isChargingNow ? t("miniBar.charging") : t("miniBar.chargeNow")}
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

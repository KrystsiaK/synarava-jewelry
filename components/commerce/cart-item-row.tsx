"use client";

import Image from "next/image";
import Link from "next/link";

import {
  decreaseCartItemAction,
  increaseCartItemAction,
  removeCartItemAction,
} from "@/app/cart/actions";
import { useTranslations } from "@/lib/i18n/context";

type CartItemRowProps = {
  item: {
    id: string;
    slug: string;
    title: string;
    imageUrl: string;
    materialLine: string;
    quantity: number;
    maxQuantity?: number | null;
    price: string;
    total: string;
  };
};

export function CartItemRow({ item }: CartItemRowProps) {
  const { t } = useTranslations();
  const isAtStockLimit =
    item.maxQuantity != null && item.quantity >= item.maxQuantity;
  const stockTooltipId = `stock-limit-${item.id}`;

  return (
    <article className="grid gap-5 border-t border-stroke py-6 md:grid-cols-[8rem_minmax(0,1fr)_auto]">
      <Link href={`/products/${item.slug}`} className="relative aspect-[4/5] overflow-hidden bg-stone-beige">
        <Image
          alt={item.title}
          src={item.imageUrl}
          fill
          sizes="8rem"
          className="object-cover"
        />
      </Link>

      <div className="space-y-3">
        <div>
          <p className="font-serif text-[1.5rem]">{item.title}</p>
          <p className="mt-1 text-sm leading-6 text-foreground/60">{item.materialLine}</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <form action={decreaseCartItemAction}>
            <input type="hidden" name="itemId" value={item.id} />
            <input type="hidden" name="quantity" value={item.quantity} />
            <button
              type="submit"
              aria-label={t("cart.decrease")}
              className="min-h-11 min-w-11 border border-stroke px-3 py-2 text-sm transition-colors hover:border-accent hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              <span aria-hidden="true">−</span>
            </button>
          </form>

          <span className="label-caps min-w-8 text-center text-muted">{item.quantity}</span>

          {isAtStockLimit ? (
            <div className="group/stock relative">
              <button
                type="button"
                aria-label={t("cart.increase")}
                aria-disabled="true"
                aria-describedby={stockTooltipId}
                className="min-h-11 min-w-11 cursor-not-allowed border border-stroke px-3 py-2 text-sm text-foreground/35 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                <span aria-hidden="true">+</span>
              </button>
              <span
                id={stockTooltipId}
                role="tooltip"
                className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-3 w-max max-w-52 -translate-x-1/2 bg-foreground px-3 py-2 text-center text-xs font-medium leading-5 text-background opacity-0 transition-[opacity,transform] duration-150 ease-out group-hover/stock:-translate-y-1 group-hover/stock:opacity-100 group-focus-within/stock:-translate-y-1 group-focus-within/stock:opacity-100 motion-reduce:transition-none"
              >
                {t("cart.stockLimit")}
              </span>
            </div>
          ) : (
            <form action={increaseCartItemAction}>
              <input type="hidden" name="itemId" value={item.id} />
              <input type="hidden" name="quantity" value={item.quantity} />
              <button
                type="submit"
                aria-label={t("cart.increase")}
                className="min-h-11 min-w-11 border border-stroke px-3 py-2 text-sm transition-colors hover:border-accent hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                <span aria-hidden="true">+</span>
              </button>
            </form>
          )}

          <form action={removeCartItemAction} className="ml-2">
            <input type="hidden" name="itemId" value={item.id} />
            <button type="submit" className="label-caps text-muted transition-colors hover:text-accent">
              {t("cart.remove")}
            </button>
          </form>
        </div>
      </div>

      <div className="space-y-1 text-left md:text-right">
        <p className="label-caps text-muted">{item.price} {t("cart.each")}</p>
        <p className="font-sans text-sm uppercase tracking-[0.14em]">{item.total}</p>
      </div>
    </article>
  );
}

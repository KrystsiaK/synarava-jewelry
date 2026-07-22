import Image from "next/image";
import Link from "next/link";

import {
  decreaseCartItemAction,
  increaseCartItemAction,
  removeCartItemAction,
} from "@/app/cart/actions";

type CartItemRowProps = {
  item: {
    id: string;
    slug: string;
    title: string;
    imageUrl: string;
    materialLine: string;
    quantity: number;
    price: string;
    total: string;
  };
};

export function CartItemRow({ item }: CartItemRowProps) {
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
            <button type="submit" className="border border-stroke px-3 py-2 text-sm transition-colors hover:border-accent hover:text-accent">
              -
            </button>
          </form>

          <span className="label-caps min-w-8 text-center text-muted">{item.quantity}</span>

          <form action={increaseCartItemAction}>
            <input type="hidden" name="itemId" value={item.id} />
            <input type="hidden" name="quantity" value={item.quantity} />
            <button type="submit" className="border border-stroke px-3 py-2 text-sm transition-colors hover:border-accent hover:text-accent">
              +
            </button>
          </form>

          <form action={removeCartItemAction} className="ml-2">
            <input type="hidden" name="itemId" value={item.id} />
            <button type="submit" className="label-caps text-muted transition-colors hover:text-accent">
              Remove
            </button>
          </form>
        </div>
      </div>

      <div className="space-y-1 text-left md:text-right">
        <p className="label-caps text-muted">{item.price} each</p>
        <p className="font-sans text-sm uppercase tracking-[0.14em]">{item.total}</p>
      </div>
    </article>
  );
}

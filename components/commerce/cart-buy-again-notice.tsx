import type { BuyAgainNotice } from "@/lib/commerce/buy-again-notice";
import { getServerTranslations } from "@/lib/i18n/server";

export async function CartBuyAgainNotice({ notice }: { notice: BuyAgainNotice | null }) {
  if (!notice) return null;
  const { t, plural } = await getServerTranslations();

  const isError =
    notice.outcome === "rejected" || notice.outcome === "failed";
  const role = isError ? "alert" : "status";

  let message: string;
  switch (notice.outcome) {
    case "completed":
      message = plural("cart.buyAgain.completed", notice.added);
      break;
    case "partial":
      message = t("cart.buyAgain.partial", {
        added: notice.added,
        skipped: notice.skipped,
      });
      break;
    case "adjusted":
      message = t("cart.buyAgain.adjusted", { count: notice.added });
      break;
    case "replayed":
      message = t("cart.buyAgain.replayed");
      break;
    case "failed":
      message = t("cart.buyAgain.failed");
      break;
    case "rejected":
    default:
      message = t("cart.buyAgain.rejected");
      break;
  }

  return (
    <div
      role={role}
      className={
        isError
          ? "mb-6 border border-couture-red/40 bg-couture-red/5 px-4 py-3 text-sm text-foreground"
          : "mb-6 border border-foreground/15 bg-foreground/[0.03] px-4 py-3 text-sm text-foreground/80"
      }
    >
      {message}
    </div>
  );
}

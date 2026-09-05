// Paste this file into Shopify Admin -> Settings -> Customer events -> Add custom pixel.
// Configure the pixel to require Analytics consent. Do not enable Marketing consent
// unless the same pixel later starts sending advertising data.

const GTM_CONTAINER_ID = "GTM-PT33DSG5";

window.dataLayer = window.dataLayer || [];
function gtag() {
  window.dataLayer.push(arguments);
}

gtag("consent", "default", {
  analytics_storage: "denied",
  ad_storage: "denied",
  ad_user_data: "denied",
  ad_personalization: "denied",
});

let analyticsAllowed = init.customerPrivacy.analyticsProcessingAllowed === true;

function loadGtm() {
  if (!analyticsAllowed || document.querySelector("script[data-synarava-gtm]")) return;

  gtag("consent", "update", {
    analytics_storage: "granted",
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
  });

  window.dataLayer.push({ "gtm.start": Date.now(), event: "gtm.js" });
  const script = document.createElement("script");
  script.async = true;
  script.dataset.synaravaGtm = "true";
  script.src = `https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(GTM_CONTAINER_ID)}`;
  document.head.appendChild(script);
}

customerPrivacy.subscribe("visitorConsentCollected", (event) => {
  analyticsAllowed = event.customerPrivacy.analyticsProcessingAllowed === true;
  loadGtm();
});

loadGtm();

analytics.subscribe("checkout_completed", (event) => {
  if (!analyticsAllowed) return;

  const checkout = event.data.checkout;
  const transactionId = checkout.order?.id || checkout.token;
  const currency = checkout.currencyCode || checkout.totalPrice?.currencyCode;
  if (!transactionId || !currency || !checkout.lineItems?.length) return;

  const items = checkout.lineItems.map((line) => {
    const quantity = line.quantity || 1;
    let unitPrice = Number(line.variant?.price?.amount || 0);
    if (line.finalLinePrice?.amount != null) {
      unitPrice = Number(line.finalLinePrice.amount) / quantity;
    }
    const discount = (line.discountAllocations || []).reduce(
      (sum, allocation) => sum + Number(allocation.amount?.amount || allocation.amount || 0),
      0,
    );

    return {
      item_id: line.variant?.sku || line.variant?.id || line.variant?.product?.id || line.id,
      item_name: line.title || line.variant?.product?.title || "Shopify item",
      item_brand: line.variant?.product?.vendor || undefined,
      item_category: line.variant?.product?.type || undefined,
      item_variant: line.variant?.title || undefined,
      price: unitPrice,
      quantity,
      discount,
    };
  });

  const coupon = (checkout.discountApplications || [])
    .filter((discount) => discount.type === "DISCOUNT_CODE")
    .map((discount) => discount.title)
    .filter(Boolean)
    .join(",") || undefined;

  window.dataLayer.push({ ecommerce: null });
  window.dataLayer.push({
    event: "purchase",
    ecommerce: {
      transaction_id: transactionId,
      value: Number(checkout.subtotalPrice?.amount || checkout.totalPrice?.amount || 0),
      tax: Number(checkout.totalTax?.amount || 0),
      shipping: Number(checkout.shippingLine?.price?.amount || 0),
      currency,
      coupon,
      items,
    },
    shopify_event_id: event.id,
  });
});

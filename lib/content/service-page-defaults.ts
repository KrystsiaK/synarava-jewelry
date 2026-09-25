import type { Locale } from "@/lib/i18n/locales";
import type { LegalSectionDefault, LegalSectionMeta } from "./legal-sections";

// Verbatim extraction of the hardcoded copy that shipped on /care, /faq,
// /returns, /shipping before those pages became admin-editable — these are
// the fallback values when a field has never been touched in Admin, not
// placeholder text.

export type ServicePageSlug = "care" | "faq" | "returns" | "shipping" | "dispute-resolution";

export type ServicePageIntroDefaults = { eyebrow: string; intro: string };

export const SERVICE_SECTIONS: Record<ServicePageSlug, LegalSectionMeta[]> = {
  care: [
    { id: "jewelry", label: "Jewelry" },
    { id: "pets", label: "Pet accessories" },
    { id: "kids", label: "Kids' products" },
    { id: "tools", label: "Tools and materials" },
  ],
  faq: [
    { id: "maker", label: "Is everything made by Synarava?" },
    { id: "availability", label: "How do I know an option is available?" },
    { id: "payment", label: "Where do I pay?" },
    { id: "question", label: "Can I ask about a product first?" },
  ],
  returns: [
    { id: "start", label: "Start a request" },
    { id: "condition", label: "Condition" },
    { id: "personalised", label: "Personalised goods" },
    { id: "damage", label: "Damage or an incorrect item" },
  ],
  shipping: [
    { id: "options", label: "Delivery options" },
    { id: "preparing", label: "Preparing your order" },
    { id: "tracking", label: "Tracking" },
    { id: "duties", label: "Duties and taxes" },
  ],
  "dispute-resolution": [
    { id: "ral", label: "Alternative dispute resolution" },
    { id: "livro", label: "Livro de Reclamações" },
  ],
};

const servicePageTitleDefaultsEn: Record<ServicePageSlug, string> = {
  care: "Keep it well",
  faq: "Before you choose",
  returns: "A considered return",
  shipping: "From us to you",
  "dispute-resolution": "Consumer dispute resolution",
};

const servicePageTitleDefaultsPt: Record<ServicePageSlug, string> = {
  care: "Cuide bem",
  faq: "Antes de escolher",
  returns: "Uma devolução ponderada",
  shipping: "De nós até si",
  "dispute-resolution": "Resolução de litígios de consumo",
};

const servicePageIntroDefaultsEn: Record<ServicePageSlug, ServicePageIntroDefaults> = {
  care: {
    eyebrow: "Service / Care & Safety",
    intro: "Care depends on material and intended use. Always follow the product-specific details first; the guidance below is a general starting point.",
  },
  faq: {
    eyebrow: "Service / FAQ",
    intro: "Short answers to the practical questions that tend to come up before and after an order.",
  },
  returns: {
    eyebrow: "Service / Returns",
    intro: "If something is not right, contact us before sending an item back so we can confirm the correct route for your order.",
  },
  shipping: {
    eyebrow: "Service / Shipping",
    intro: "Available delivery methods, costs, and the final estimate are shown at checkout for your destination.",
  },
  "dispute-resolution": {
    eyebrow: "Service / Consumer rights",
    intro: "If we cannot resolve a complaint directly, you may have access to alternative consumer dispute resolution services.",
  },
};

const servicePageIntroDefaultsPt: Record<ServicePageSlug, ServicePageIntroDefaults> = {
  care: {
    eyebrow: "Serviço / Cuidados e segurança",
    intro: "Os cuidados dependem do material e da utilização. Siga primeiro os detalhes específicos do produto; as orientações abaixo são um ponto de partida geral.",
  },
  faq: {
    eyebrow: "Serviço / Perguntas frequentes",
    intro: "Respostas breves às questões práticas que surgem antes e depois de uma encomenda.",
  },
  returns: {
    eyebrow: "Serviço / Devoluções",
    intro: "Se algo não estiver correto, contacte-nos antes de devolver o produto para confirmarmos o procedimento adequado.",
  },
  shipping: {
    eyebrow: "Serviço / Envios",
    intro: "Os métodos disponíveis, os custos e a estimativa final são apresentados no checkout para o seu destino.",
  },
  "dispute-resolution": {
    eyebrow: "Serviço / Direitos do consumidor",
    intro: "Se não conseguirmos resolver uma reclamação diretamente, poderá ter acesso a serviços alternativos de resolução de litígios de consumo.",
  },
};

const serviceSectionDefaultsEn: Record<ServicePageSlug, Record<string, LegalSectionDefault>> = {
  care: {
    jewelry: {
      title: "Jewelry",
      body: "Keep away from perfume, household chemicals, and prolonged moisture. Store products separately and wipe gently with a soft, dry cloth after wear.",
    },
    pets: {
      title: "Pet accessories",
      body: "Inspect fittings and surfaces regularly. Stop use if any part becomes loose, cracked, or damaged. Choose products appropriate for the animal's size and supervise where stated.",
    },
    kids: {
      title: "Kids' products",
      body: "Follow the age guidance and adult-supervision notes on the product page and packaging. Keep small parts away from children below the stated age.",
    },
    tools: {
      title: "Tools and materials",
      body: "Use protective equipment where appropriate and follow the manufacturer's instructions. Store sharp tools, small parts, and consumables out of children's reach.",
    },
  },
  faq: {
    maker: {
      title: "Is everything made by Synarava?",
      body: "No. Synarava is a curated jewelry shop. Product pages identify the maker or vendor and describe the materials and origin when that information is available.",
    },
    availability: {
      title: "How do I know an option is available?",
      body: "Choose the required size, colour, or other option on the product page. Only combinations currently in stock can be added to the cart.",
    },
    payment: {
      title: "Where do I pay?",
      body: "The final payment step is handled by the secure checkout connected to the shop. Review the store name, items, total, and delivery address before completing payment.",
    },
    question: {
      title: "Can I ask about a product first?",
      body: "Yes. Email synarava.shop@gmail.com with the product name or link. For fit, materials, compatibility, or safety questions, ask before ordering.",
    },
  },
  returns: {
    start: {
      title: "Start a request",
      body: "Email synarava.shop@gmail.com with your order number, the product name, and the reason for the request. We will reply with the applicable return instructions.",
    },
    condition: {
      title: "Condition",
      body: "Keep the product unused, complete, and in its original packaging while the request is reviewed. Items showing wear or missing components may not be eligible.",
    },
    personalised: {
      title: "Personalised goods",
      body: "Custom, personalised, and made-to-order products may have different return conditions. These are confirmed before the order is produced.",
    },
    damage: {
      title: "Damage or an incorrect item",
      body: "Contact us promptly with clear photos of the product and packaging. Do not discard the parcel until we confirm the next step.",
    },
  },
  shipping: {
    options: {
      title: "Delivery options",
      body: "Enter your delivery address at checkout to see the methods currently available for your order. The final price is confirmed before payment.",
    },
    preparing: {
      title: "Preparing your order",
      body: "Ready-to-ship and made-to-order products may require different preparation times. Check the product page and order confirmation for the status of each item.",
    },
    tracking: {
      title: "Tracking",
      body: "When tracking is available, the carrier link is sent to the email used at checkout after the parcel has been handed over.",
    },
    duties: {
      title: "Duties and taxes",
      body: "International orders may be subject to local duties or import taxes. Any amount not collected at checkout is determined by the destination country.",
    },
  },
  "dispute-resolution": {
    ral: {
      title: "Alternative dispute resolution (RAL)",
      body: "<p>If a consumer dispute cannot be resolved directly with us, you may contact the Centro de Arbitragem de Conflitos de Consumo de Lisboa (CACCL), an authorised consumer dispute resolution entity.</p><p>Rua dos Douradores, 116, 2.º<br>1100-207 Lisboa, Portugal<br>Tel: +351 218 807 030<br>Email: <a href=\"mailto:juridico@centroarbitragemlisboa.pt\">juridico@centroarbitragemlisboa.pt</a><br><a href=\"https://www.centroarbitragemlisboa.pt\">www.centroarbitragemlisboa.pt</a></p>",
    },
    livro: {
      title: "Livro de Reclamações",
      body: "<p>You can also submit a complaint through the official Portuguese electronic complaints book, Livro de Reclamações Eletrónico.</p><p><a href=\"https://www.livroreclamacoes.pt\">www.livroreclamacoes.pt</a></p>",
    },
  },
};

const serviceSectionDefaultsPt: Record<ServicePageSlug, Record<string, LegalSectionDefault>> = {
  care: {
    jewelry: {
      title: "Joalharia",
      body: "Evite perfume, produtos químicos domésticos e humidade prolongada. Guarde os produtos separadamente e limpe-os suavemente com um pano macio e seco.",
    },
    pets: {
      title: "Acessórios para animais",
      body: "Inspecione regularmente encaixes e superfícies. Interrompa a utilização se alguma peça ficar solta, rachada ou danificada. Escolha produtos adequados ao tamanho do animal e supervisione quando indicado.",
    },
    kids: {
      title: "Produtos para crianças",
      body: "Siga as indicações de idade e supervisão de adultos na página e embalagem do produto. Mantenha peças pequenas longe de crianças abaixo da idade indicada.",
    },
    tools: {
      title: "Ferramentas e materiais",
      body: "Use equipamento de proteção quando adequado e siga as instruções do fabricante. Guarde ferramentas afiadas, peças pequenas e consumíveis fora do alcance das crianças.",
    },
  },
  faq: {
    maker: {
      title: "Tudo é produzido pela Synarava?",
      body: "Não. A Synarava é uma loja com uma seleção cuidada em vários departamentos. As páginas identificam o fabricante ou fornecedor e descrevem materiais e origem quando disponíveis.",
    },
    availability: {
      title: "Como sei se uma opção está disponível?",
      body: "Escolha o tamanho, cor ou outra opção na página do produto. Apenas combinações com stock podem ser adicionadas ao carrinho.",
    },
    payment: {
      title: "Onde é feito o pagamento?",
      body: "O pagamento final é processado pelo checkout seguro da loja. Confirme o nome da loja, os produtos, o total e a morada antes de pagar.",
    },
    question: {
      title: "Posso esclarecer dúvidas antes de comprar?",
      body: "Sim. Envie um email para synarava.shop@gmail.com com o nome ou ligação do produto. Para questões de tamanho, materiais, compatibilidade ou segurança, contacte-nos antes de encomendar.",
    },
  },
  returns: {
    start: {
      title: "Iniciar um pedido",
      body: "Envie um email para synarava.shop@gmail.com com o número da encomenda, o nome do produto e o motivo. Responderemos com as instruções aplicáveis.",
    },
    condition: {
      title: "Estado do produto",
      body: "Mantenha o produto sem uso, completo e na embalagem original enquanto o pedido é analisado. Produtos com sinais de uso ou componentes em falta podem não ser elegíveis.",
    },
    personalised: {
      title: "Produtos personalizados",
      body: "Produtos personalizados e feitos por encomenda podem ter condições de devolução diferentes, confirmadas antes da produção.",
    },
    damage: {
      title: "Produto danificado ou incorreto",
      body: "Contacte-nos rapidamente com fotografias nítidas do produto e da embalagem. Não elimine a encomenda até confirmarmos o próximo passo.",
    },
  },
  shipping: {
    options: {
      title: "Opções de entrega",
      body: "Introduza a morada no checkout para ver os métodos disponíveis para a encomenda. O preço final é confirmado antes do pagamento.",
    },
    preparing: {
      title: "Preparação da encomenda",
      body: "Produtos disponíveis para envio e produtos feitos por encomenda podem ter prazos de preparação diferentes. Consulte a página do produto e a confirmação da encomenda.",
    },
    tracking: {
      title: "Rastreio",
      body: "Quando existir rastreio, a ligação da transportadora é enviada para o email usado no checkout depois de a encomenda ser expedida.",
    },
    duties: {
      title: "Direitos e impostos",
      body: "Encomendas internacionais podem estar sujeitas a direitos ou impostos de importação locais. Qualquer valor não cobrado no checkout é determinado pelo país de destino.",
    },
  },
  "dispute-resolution": {
    ral: {
      title: "Resolução alternativa de litígios (RAL)",
      body: "<p>Se um litígio de consumo não puder ser resolvido diretamente connosco, pode contactar o Centro de Arbitragem de Conflitos de Consumo de Lisboa (CACCL), uma entidade de resolução alternativa de litígios de consumo autorizada.</p><p>Rua dos Douradores, 116, 2.º<br>1100-207 Lisboa, Portugal<br>Tel: +351 218 807 030<br>Email: <a href=\"mailto:juridico@centroarbitragemlisboa.pt\">juridico@centroarbitragemlisboa.pt</a><br><a href=\"https://www.centroarbitragemlisboa.pt\">www.centroarbitragemlisboa.pt</a></p>",
    },
    livro: {
      title: "Livro de Reclamações",
      body: "<p>Também pode apresentar uma reclamação através do Livro de Reclamações Eletrónico oficial português.</p><p><a href=\"https://www.livroreclamacoes.pt\">www.livroreclamacoes.pt</a></p>",
    },
  },
};

// Locale-keyed so page components look up `SERVICE_PAGE_TITLE_DEFAULTS[locale]
// ?? SERVICE_PAGE_TITLE_DEFAULTS.en` etc. instead of a `locale === "pt"`
// branch — adding a language here is a new key, not a new conditional.
// Deliberately `Partial`: not every registered locale has real service-copy
// defaults yet (that's a translation/review task, not a code change) — a
// locale with no entry falls back to the English defaults.
export const SERVICE_PAGE_TITLE_DEFAULTS: { en: Record<ServicePageSlug, string> } & Partial<Record<Locale, Record<ServicePageSlug, string>>> = {
  en: servicePageTitleDefaultsEn,
  pt: servicePageTitleDefaultsPt,
};

export const SERVICE_PAGE_INTRO_DEFAULTS: { en: Record<ServicePageSlug, ServicePageIntroDefaults> } & Partial<Record<Locale, Record<ServicePageSlug, ServicePageIntroDefaults>>> = {
  en: servicePageIntroDefaultsEn,
  pt: servicePageIntroDefaultsPt,
};

export const SERVICE_SECTION_DEFAULTS: { en: Record<ServicePageSlug, Record<string, LegalSectionDefault>> } & Partial<Record<Locale, Record<ServicePageSlug, Record<string, LegalSectionDefault>>>> = {
  en: serviceSectionDefaultsEn,
  pt: serviceSectionDefaultsPt,
};

export const SHOP_HERO_DEFAULTS_EN = {
  title: "Curated shop",
  description: "Jewelry, pet accessories, creative products for kids, and tools for making by hand.",
};

export const SHOP_HERO_DEFAULTS_PT = {
  title: "Loja selecionada",
  description: "Joalharia, acessórios para animais, produtos criativos para crianças e ferramentas para criar à mão.",
};

/** Splits a hero title into its plain "lead" run and the styled last word ("accent"). */
export function splitHeroTitleAccent(title: string): { lead: string; accent: string } {
  const words = title.trim().split(/\s+/);
  if (words.length <= 1) return { lead: "", accent: title.trim() };
  return { lead: words.slice(0, -1).join(" "), accent: words[words.length - 1] };
}

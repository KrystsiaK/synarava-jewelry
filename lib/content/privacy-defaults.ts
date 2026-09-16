import type { LegalSectionDefault, LegalSectionMeta } from "./legal-sections";

// Verbatim extraction of the hardcoded copy that shipped on /privacy (EN)
// and the formerly-separate PortuguesePrivacyPolicy component (PT) before
// the page became admin-editable — fallback values, not placeholder text.
// {legalName} / {privacyEmail} / {postalAddressLine} are interpolated at
// render time from env-configured business details.

export const PRIVACY_SECTIONS_EN: LegalSectionMeta[] = [
  { id: "controller", label: "1. Data Controller" },
  { id: "data-collected", label: "2. Data We Collect" },
  { id: "legal-basis", label: "3. Legal Basis" },
  { id: "how-we-use", label: "4. How We Use Your Data" },
  { id: "sharing", label: "5. Data Sharing" },
  { id: "retention", label: "6. Retention" },
  { id: "rights", label: "7. Your Rights" },
  { id: "cookies", label: "8. Cookies" },
  { id: "security", label: "9. Security" },
  { id: "contact", label: "10. Contact" },
];

export const PRIVACY_SECTIONS_PT: LegalSectionMeta[] = [
  { id: "controller", label: "1. Responsável pelo tratamento" },
  { id: "data-collected", label: "2. Dados que recolhemos" },
  { id: "legal-basis", label: "3. Fundamentos jurídicos" },
  { id: "how-we-use", label: "4. Como utilizamos os dados" },
  { id: "sharing", label: "5. Partilha e transferências" },
  { id: "retention", label: "6. Conservação" },
  { id: "rights", label: "7. Os seus direitos" },
  { id: "cookies", label: "8. Cookies" },
  { id: "security", label: "9. Segurança" },
  { id: "contact", label: "10. Contacto" },
];

export const PRIVACY_LAST_UPDATED_DEFAULT = "5 September 2026";

export const PRIVACY_SECTION_DEFAULTS_EN: Record<string, LegalSectionDefault> = {
  controller: {
    title: "Who is responsible for your data",
    body: [
      'The data controller for all personal information processed through this website is **{legalName}** (hereafter "Synarava", "we", "us").',
      "Email: [{privacyEmail}](mailto:{privacyEmail})",
      "{postalAddressLine}",
      "We are committed to protecting your privacy and handling your data in full compliance with the General Data Protection Regulation (GDPR) and applicable national data protection laws.",
    ].join("\n\n"),
  },
  "data-collected": {
    title: "What information we process",
    body: [
      "We collect only the information necessary to provide our services:",
      [
        "- **Account data** — Name, email address, account identifiers, order history, and saved addresses. Customer sign-in uses a one-time code; Synarava does not collect or store a customer password.",
        "- **Order data** — Shipping address, phone number, order contents, payment status — collected at checkout.",
        "- **Payment data** — Payment status and limited transaction details. Card details are entered directly with the checkout or payment provider and are not stored on Synarava servers.",
        "- **Usage data** — Technical information needed to operate and secure the website, such as device, browser, IP address, and request logs. Optional analytics are used only when enabled and permitted by your consent choices.",
        "- **Communication data** — Content of messages you send us directly via email.",
      ].join("\n"),
    ].join("\n\n"),
  },
  "legal-basis": {
    title: "Why we are allowed to process your data",
    body: [
      "We process your data on the following legal bases under Article 6 GDPR:",
      [
        "- **Contractual necessity** — to fulfil your order and provide customer support.",
        "- **Legitimate interests** — to improve the website, prevent fraud, and ensure security.",
        "- **Consent** — for optional analytics cookies and marketing communications, which you may withdraw at any time.",
        "- **Legal obligation** — to comply with applicable tax, accounting, and consumer-protection laws.",
      ].join("\n"),
    ].join("\n\n"),
  },
  "how-we-use": {
    title: "Purposes of processing",
    body: [
      "Your information is used solely for the following purposes:",
      [
        "- Processing and fulfilling your orders",
        "- Managing your account and authentication",
        "- Sending order confirmations and shipping notifications",
        "- Responding to your enquiries and support requests",
        "- Preventing fraudulent transactions and maintaining site security",
        "- Complying with legal and regulatory obligations",
        "- Sending marketing emails only if you have explicitly opted in",
      ].join("\n"),
      "We do not sell, rent, or trade your personal data to third parties for their own marketing purposes.",
    ].join("\n\n"),
  },
  sharing: {
    title: "Third parties we work with",
    body: [
      "We share data only where necessary with trusted service providers bound by data-processing agreements:",
      [
        "| Provider | Role | Details |",
        "| --- | --- | --- |",
        "| Shopify | Commerce, payments, and customer accounts | Shopify group entities, including Shopify International Limited for customers in the EEA, support customer authentication, cart, checkout, payment processing, order processing, and related commerce services. |",
        "| Object storage provider | File and media storage | Product images and uploaded assets are stored using access-controlled object storage. |",
        "| Hosting provider | Infrastructure | Our server infrastructure provider processes operational data as a data processor. |",
      ].join("\n"),
      "If required by law, we may disclose data to competent authorities (courts, law enforcement, tax authorities) without prior notice.",
      "Some providers may process data outside the European Economic Area. Where this happens, we use an applicable transfer mechanism such as an adequacy decision or the European Commission's Standard Contractual Clauses, together with additional safeguards where required. Contact us for information about the safeguards relevant to your data.",
    ].join("\n\n"),
  },
  retention: {
    title: "How long we keep your data",
    body: [
      "We retain personal data only as long as necessary for the purposes it was collected for, or as required by law:",
      [
        "- **Account data** — retained while your account is active and afterward only as needed to close the account, resolve disputes, or meet legal obligations.",
        "- **Order data** — retained for the period required by applicable accounting, tax, consumer-protection, and warranty laws.",
        "- **Technical and analytics data** — retained only as long as needed for security, operation, and the applicable analytics settings.",
        "- **Support communications** — 2 years from last contact.",
      ].join("\n"),
    ].join("\n\n"),
  },
  rights: {
    title: "Rights under GDPR",
    body: [
      "Under the GDPR you have the following rights, which you may exercise free of charge:",
      [
        "| Right | Description |",
        "| --- | --- |",
        "| Access | Request a copy of the personal data we hold about you. |",
        "| Rectification | Ask us to correct inaccurate or incomplete data. |",
        "| Erasure | Request deletion of your data where there is no lawful reason to retain it. |",
        "| Restriction | Ask us to limit processing of your data in certain circumstances. |",
        "| Portability | Receive your data in a structured, machine-readable format. |",
        "| Objection | Object to processing based on legitimate interests or for direct marketing. |",
      ].join("\n"),
      "To exercise any right, contact us at [{privacyEmail}](mailto:{privacyEmail}). We will respond within 30 days. You also have the right to lodge a complaint with your national supervisory authority. In Portugal, this is the [Comissão Nacional de Proteção de Dados (CNPD)](https://www.cnpd.pt/).",
    ].join("\n\n"),
  },
  cookies: {
    title: "How we use cookies",
    body: [
      "Optional storage and destinations remain disabled until you consent. Rejecting them does not prevent you from browsing, creating an account, or completing a purchase.",
      [
        "| Name / provider | Purpose | Category | Duration |",
        "| --- | --- | --- | --- |",
        "| synarava-consent · Synarava | Records your consent choices so the banner does not reappear on every page. | Necessary | 180 days |",
        "| synarava-locale · Synarava | Remembers the language after you choose it. | Preference | 1 year |",
        "| synarava-theme · Synarava | Remembers light, dark, or system appearance after you choose it. | Preference | 1 year |",
        "| Session and cart cookies · Synarava / Shopify | Keeps authentication, security, cart, and checkout working. | Necessary | Session or provider-defined |",
        "| _ga, _gid, _gat and related identifiers · Google | Measures site usage and commerce journeys through the configured Google tag. | Analytics | Up to 2 years |",
        "| _fbp, _fbc and related identifiers · Meta | Measures advertising performance and attribution. | Marketing | Up to 90 days |",
      ].join("\n"),
      "Analytics and marketing rows apply only when those integrations are configured and you enable the corresponding category. You can withdraw consent at any time; the withdrawal applies from that point onward.",
    ].join("\n\n"),
  },
  security: {
    title: "How we protect your data",
    body: [
      "We implement appropriate technical and organisational measures to protect your personal data against unauthorised access, accidental loss, destruction, or damage. These include:",
      [
        "- Encrypted data transmission via HTTPS (TLS 1.2+)",
        "- Passwordless customer sign-in using one-time codes",
        "- Customer passwords are not collected or stored by Synarava",
        "- Payment card details are handled directly by the checkout or payment provider",
        "- Database access restricted to application layer only",
        "- Regular security reviews and dependency updates",
      ].join("\n"),
    ].join("\n\n"),
  },
  contact: {
    title: "Get in touch",
    body: [
      "For any questions about this Privacy Policy or your personal data, please contact us:",
      "**{legalName}**\n\nEmail: [{privacyEmail}](mailto:{privacyEmail})\n\n{postalAddressLine}",
      "We do not make decisions that produce legal or similarly significant effects using solely automated processing. Information required for an order is necessary to enter into and perform the sale; without it, we may be unable to complete the purchase.",
      "We may update this notice when our processing changes. We will identify the update date and provide an appropriate notice for material changes. Where the law requires consent for a new purpose, we will ask for it before that processing begins.",
    ].join("\n\n"),
  },
};

export const PRIVACY_SECTION_DEFAULTS_PT: Record<string, LegalSectionDefault> = {
  controller: {
    title: "Quem é responsável pelos seus dados",
    body: [
      "O responsável pelo tratamento dos dados pessoais processados neste site é **{legalName}**, operador da Synarava.",
      "Email: [{privacyEmail}](mailto:{privacyEmail})",
      "{postalAddressLine}",
      "Tratamos os dados de acordo com o Regulamento Geral sobre a Proteção de Dados (RGPD) e a legislação nacional aplicável.",
    ].join("\n\n"),
  },
  "data-collected": {
    title: "Informação que tratamos",
    body: [
      "- Conta: nome, email, identificadores, histórico de encomendas e moradas guardadas. O acesso Shopify usa código único; a Synarava não guarda a palavra-passe do cliente.",
      "- Encomenda: morada de entrega, telefone, artigos, estado de pagamento e informação necessária ao checkout.",
      "- Pagamento: estado e dados limitados da transação. Os dados completos do cartão são introduzidos diretamente no fornecedor de pagamento.",
      "- Técnicos: dispositivo, navegador, IP e registos necessários para operar e proteger o site; análise opcional apenas com consentimento.",
      "- Comunicações: conteúdo das mensagens enviadas diretamente à Synarava.",
    ].join("\n"),
  },
  "legal-basis": {
    title: "Por que podemos tratar os dados",
    body: [
      "- Execução do contrato — processar a encomenda, entregar produtos e prestar apoio.",
      "- Interesses legítimos — prevenir fraude, proteger o serviço e resolver falhas, ponderando os seus direitos.",
      "- Consentimento — cookies opcionais, análise e marketing; pode retirá-lo a qualquer momento.",
      "- Obrigação legal — cumprir normas fiscais, contabilísticas e de defesa do consumidor.",
    ].join("\n"),
  },
  "how-we-use": {
    title: "Finalidades do tratamento",
    body: [
      [
        "- Processar e entregar encomendas, gerir conta e autenticação.",
        "- Enviar confirmações e informações de envio e responder a pedidos de apoio.",
        "- Prevenir fraude, manter a segurança e cumprir obrigações legais.",
        "- Medir o site ou enviar marketing apenas com consentimento específico.",
      ].join("\n"),
      "Não vendemos nem alugamos os seus dados pessoais a terceiros para marketing próprio.",
    ].join("\n\n"),
  },
  sharing: {
    title: "Fornecedores e destinatários",
    body: [
      "Partilhamos apenas os dados necessários com fornecedores sujeitos a obrigações de proteção: Shopify para comércio, pagamentos, conta e checkout; fornecedor de alojamento; e fornecedor de armazenamento de imagens e ficheiros.",
      "Podemos divulgar dados a autoridades quando a lei o imponha. Para tratamentos fora do Espaço Económico Europeu aplicamos uma decisão de adequação ou Cláusulas Contratuais-Tipo da Comissão Europeia e medidas adicionais quando exigidas. Pode pedir informação sobre as salvaguardas aplicáveis.",
    ].join("\n\n"),
  },
  retention: {
    title: "Durante quanto tempo guardamos os dados",
    body: [
      "- Conta — enquanto estiver ativa e depois apenas para encerramento, litígios ou obrigações legais.",
      "- Encomendas — pelo período exigido pelas normas fiscais, contabilísticas, de garantia e de defesa do consumidor.",
      "- Registos técnicos e análise — apenas pelo período necessário à segurança, operação e configuração do fornecedor.",
      "- Comunicações de apoio — 2 anos após o último contacto, salvo obrigação legal superior.",
    ].join("\n"),
  },
  rights: {
    title: "Direitos ao abrigo do RGPD",
    body: [
      "Pode pedir gratuitamente acesso, retificação, apagamento, limitação, portabilidade e opor-se ao tratamento. Pode retirar o consentimento sem afetar a licitude do tratamento anterior.",
      "Envie o pedido para [{privacyEmail}](mailto:{privacyEmail}). Responderemos, em regra, no prazo de um mês. Pode reclamar junto da [Comissão Nacional de Proteção de Dados (CNPD)](https://www.cnpd.pt/).",
    ].join("\n\n"),
  },
  cookies: {
    title: "Cookies e armazenamento local",
    body: [
      "As finalidades opcionais ficam desativadas até consentir. A recusa não impede navegar, criar conta ou comprar.",
      [
        "| Nome / fornecedor | Finalidade | Categoria | Duração |",
        "| --- | --- | --- | --- |",
        "| synarava-consent · Synarava | Regista as suas escolhas de consentimento. | Necessário | 180 dias |",
        "| synarava-locale · Synarava | Memoriza o idioma depois de o escolher. | Preferência | 1 ano |",
        "| synarava-theme · Synarava | Memoriza o aspeto depois de o escolher. | Preferência | 1 ano |",
        "| Cookies de sessão e carrinho · Synarava / Shopify | Mantêm autenticação, segurança, carrinho e checkout. | Necessário | Sessão ou prazo do fornecedor |",
        "| _ga, _gid, _gat e relacionados · Google | Mede utilização e percursos de compra através da etiqueta Google configurada. | Análise | Até 2 anos |",
        "| _fbp, _fbc e relacionados · Meta | Mede desempenho e atribuição de publicidade. | Marketing | Até 90 dias |",
      ].join("\n"),
      "As linhas de análise e marketing só se aplicam quando a integração está configurada e ativada por si. Pode alterar ou retirar o consentimento aqui:",
    ].join("\n\n"),
  },
  security: {
    title: "Como protegemos os dados",
    body: "Aplicamos medidas técnicas e organizativas adequadas, incluindo transmissão HTTPS, autenticação por códigos únicos, acesso limitado à base de dados e tratamento dos cartões diretamente pelo fornecedor de checkout ou pagamento. Revemos as medidas de acordo com o risco.",
  },
  contact: {
    title: "Fale connosco",
    body: [
      "**{legalName}**\n\nEmail: [{privacyEmail}](mailto:{privacyEmail})\n\n{postalAddressLine}",
      "Não tomamos decisões com efeitos jurídicos ou igualmente significativos baseadas exclusivamente em tratamento automatizado. Os dados pedidos numa encomenda são necessários para celebrar e executar a compra; sem eles poderemos não conseguir concluí-la.",
      "Podemos atualizar este aviso quando o tratamento mudar. Indicaremos a data e comunicaremos alterações materiais. Se uma nova finalidade exigir consentimento, pedi-lo-emos antes de iniciar o tratamento.",
    ].join("\n\n"),
  },
};

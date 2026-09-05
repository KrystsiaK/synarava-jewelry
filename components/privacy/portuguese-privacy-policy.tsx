import Link from "next/link";

import { PrivacySettingsButton } from "@/components/privacy/privacy-settings-button";

const sections = [
  ["controller", "1. Responsável pelo tratamento"],
  ["data-collected", "2. Dados que recolhemos"],
  ["legal-basis", "3. Fundamentos jurídicos"],
  ["how-we-use", "4. Como utilizamos os dados"],
  ["sharing", "5. Partilha e transferências"],
  ["retention", "6. Conservação"],
  ["rights", "7. Os seus direitos"],
  ["cookies", "8. Cookies"],
  ["security", "9. Segurança"],
  ["contact", "10. Contacto"],
] as const;

function Section({ id, number, title, children }: {
  id: string;
  number: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <section id={id} className="scroll-mt-28">
        <p className="label-caps mb-3 text-accent">{number}</p>
        <h2 className="mb-5 font-serif text-[1.8rem] leading-tight md:text-[2.2rem]">{title}</h2>
        <div className="space-y-4 text-base leading-8 text-foreground/75">{children}</div>
      </section>
      {id !== "contact" ? <div className="embroidery-separator" /> : null}
    </>
  );
}

function List({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2 pl-4">
      {items.map((item) => (
        <li key={item} className="flex gap-3">
          <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rotate-45 bg-stroke" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export function PortuguesePrivacyPolicy({ legalName, postalAddress, privacyEmail }: {
  legalName: string;
  postalAddress?: string;
  privacyEmail: string;
}) {
  const cookies = [
    ["synarava-consent · Synarava", "Regista as suas escolhas de consentimento.", "Necessário", "180 dias"],
    ["synarava-locale · Synarava", "Memoriza o idioma depois de o escolher.", "Preferência", "1 ano"],
    ["synarava-theme · Synarava", "Memoriza o aspeto depois de o escolher.", "Preferência", "1 ano"],
    ["Cookies de sessão e carrinho · Synarava / Shopify", "Mantêm autenticação, segurança, carrinho e checkout.", "Necessário", "Sessão ou prazo do fornecedor"],
    ["_ga, _gid, _gat e relacionados · Google", "Mede utilização e percursos de compra através da etiqueta Google configurada.", "Análise", "Até 2 anos"],
    ["_fbp, _fbc e relacionados · Meta", "Mede desempenho e atribuição de publicidade.", "Marketing", "Até 90 dias"],
  ];

  return (
    <main className="artifact-shell min-h-screen pb-20 pt-24 md:pb-32 md:pt-28">
      <header className="site-shell border-b border-stroke pb-10 md:pb-14">
        <p className="label-mono mb-4 text-accent">Legal</p>
        <h1 className="font-serif text-[2.4rem] leading-tight sm:text-[3.2rem] md:text-[4.5rem]">Política de Privacidade</h1>
        <p className="mt-4 text-base text-foreground/60 md:text-lg">Última atualização: 5 de setembro de 2026</p>
      </header>

      <div className="site-shell mt-10 grid gap-12 md:mt-14 lg:grid-cols-[16rem_minmax(0,1fr)] lg:gap-16 xl:grid-cols-[18rem_minmax(0,1fr)]">
        <aside className="hidden lg:block">
          <div className="sticky top-28 space-y-1">
            <p className="label-caps mb-4 text-muted">Índice</p>
            <nav className="flex flex-col gap-2">
              {sections.map(([id, label]) => <a key={id} href={`#${id}`} className="label-mono text-muted transition-colors hover:text-foreground">{label}</a>)}
            </nav>
          </div>
        </aside>

        <article className="prose-legal space-y-12 md:space-y-14">
          <Section id="controller" number="1. Responsável pelo tratamento" title="Quem é responsável pelos seus dados">
            <p>O responsável pelo tratamento dos dados pessoais processados neste site é <strong className="text-foreground">{legalName}</strong>, operador da Synarava.</p>
            <p>Email: <a href={`mailto:${privacyEmail}`} className="text-accent underline underline-offset-4">{privacyEmail}</a></p>
            {postalAddress ? <p>Morada postal: {postalAddress}</p> : null}
            <p>Tratamos os dados de acordo com o Regulamento Geral sobre a Proteção de Dados (RGPD) e a legislação nacional aplicável.</p>
          </Section>

          <Section id="data-collected" number="2. Dados que recolhemos" title="Informação que tratamos">
            <List items={[
              "Conta: nome, email, identificadores, histórico de encomendas e moradas guardadas. O acesso Shopify usa código único; a Synarava não guarda a palavra-passe do cliente.",
              "Encomenda: morada de entrega, telefone, artigos, estado de pagamento e informação necessária ao checkout.",
              "Pagamento: estado e dados limitados da transação. Os dados completos do cartão são introduzidos diretamente no fornecedor de pagamento.",
              "Técnicos: dispositivo, navegador, IP e registos necessários para operar e proteger o site; análise opcional apenas com consentimento.",
              "Comunicações: conteúdo das mensagens enviadas diretamente à Synarava.",
            ]} />
          </Section>

          <Section id="legal-basis" number="3. Fundamentos jurídicos" title="Por que podemos tratar os dados">
            <List items={[
              "Execução do contrato — processar a encomenda, entregar produtos e prestar apoio.",
              "Interesses legítimos — prevenir fraude, proteger o serviço e resolver falhas, ponderando os seus direitos.",
              "Consentimento — cookies opcionais, análise e marketing; pode retirá-lo a qualquer momento.",
              "Obrigação legal — cumprir normas fiscais, contabilísticas e de defesa do consumidor.",
            ]} />
          </Section>

          <Section id="how-we-use" number="4. Como utilizamos os dados" title="Finalidades do tratamento">
            <List items={[
              "Processar e entregar encomendas, gerir conta e autenticação.",
              "Enviar confirmações e informações de envio e responder a pedidos de apoio.",
              "Prevenir fraude, manter a segurança e cumprir obrigações legais.",
              "Medir o site ou enviar marketing apenas com consentimento específico.",
            ]} />
            <p>Não vendemos nem alugamos os seus dados pessoais a terceiros para marketing próprio.</p>
          </Section>

          <Section id="sharing" number="5. Partilha e transferências" title="Fornecedores e destinatários">
            <p>Partilhamos apenas os dados necessários com fornecedores sujeitos a obrigações de proteção: Shopify para comércio, conta e checkout; Stripe quando o checkout local é usado; fornecedor de alojamento; e fornecedor de armazenamento de imagens e ficheiros.</p>
            <p>Podemos divulgar dados a autoridades quando a lei o imponha. Para tratamentos fora do Espaço Económico Europeu aplicamos uma decisão de adequação ou Cláusulas Contratuais-Tipo da Comissão Europeia e medidas adicionais quando exigidas. Pode pedir informação sobre as salvaguardas aplicáveis.</p>
          </Section>

          <Section id="retention" number="6. Conservação" title="Durante quanto tempo guardamos os dados">
            <List items={[
              "Conta — enquanto estiver ativa e depois apenas para encerramento, litígios ou obrigações legais.",
              "Encomendas — pelo período exigido pelas normas fiscais, contabilísticas, de garantia e de defesa do consumidor.",
              "Registos técnicos e análise — apenas pelo período necessário à segurança, operação e configuração do fornecedor.",
              "Comunicações de apoio — 2 anos após o último contacto, salvo obrigação legal superior.",
            ]} />
          </Section>

          <Section id="rights" number="7. Os seus direitos" title="Direitos ao abrigo do RGPD">
            <p>Pode pedir gratuitamente acesso, retificação, apagamento, limitação, portabilidade e opor-se ao tratamento. Pode retirar o consentimento sem afetar a licitude do tratamento anterior.</p>
            <p>Envie o pedido para <a href={`mailto:${privacyEmail}`} className="text-accent underline underline-offset-4">{privacyEmail}</a>. Responderemos, em regra, no prazo de um mês. Pode reclamar junto da <a href="https://www.cnpd.pt/" rel="noreferrer" target="_blank" className="text-accent underline underline-offset-4">Comissão Nacional de Proteção de Dados (CNPD)</a>.</p>
          </Section>

          <Section id="cookies" number="8. Cookies" title="Cookies e armazenamento local">
            <p>As finalidades opcionais ficam desativadas até consentir. A recusa não impede navegar, criar conta ou comprar.</p>
            <div className="overflow-x-auto border border-stroke">
              <table className="w-full min-w-[46rem] border-collapse text-left text-sm">
                <thead className="bg-foreground/[0.04]"><tr>{["Nome / fornecedor", "Finalidade", "Categoria", "Duração"].map((heading) => <th key={heading} scope="col" className="label-caps border-b border-stroke p-4 text-foreground">{heading}</th>)}</tr></thead>
                <tbody>{cookies.map(([name, purpose, category, duration]) => (
                  <tr key={name} className="border-b border-stroke last:border-0"><th scope="row" className="p-4 align-top font-medium text-foreground">{name}</th><td className="p-4 align-top text-foreground/70">{purpose}</td><td className="p-4 align-top text-foreground/70">{category}</td><td className="p-4 align-top text-foreground/70">{duration}</td></tr>
                ))}</tbody>
              </table>
            </div>
            <p>As linhas de análise e marketing só se aplicam quando a integração está configurada e ativada por si. Pode alterar ou retirar o consentimento aqui:</p>
            <div className="inline-flex border border-stroke px-4 py-3"><PrivacySettingsButton /></div>
          </Section>

          <Section id="security" number="9. Segurança" title="Como protegemos os dados">
            <p>Aplicamos medidas técnicas e organizativas adequadas, incluindo transmissão HTTPS, autenticação por códigos únicos, acesso limitado à base de dados e tratamento dos cartões diretamente pelo fornecedor de checkout ou pagamento. Revemos as medidas de acordo com o risco.</p>
          </Section>

          <Section id="contact" number="10. Contacto" title="Fale connosco">
            <div className="panel p-6 md:p-8"><p className="label-caps mb-4 text-foreground">{legalName}</p><p>Email: <a href={`mailto:${privacyEmail}`} className="text-accent underline underline-offset-4">{privacyEmail}</a></p>{postalAddress ? <p>Morada postal: {postalAddress}</p> : null}</div>
            <p>Não tomamos decisões com efeitos jurídicos ou igualmente significativos baseadas exclusivamente em tratamento automatizado. Os dados pedidos numa encomenda são necessários para celebrar e executar a compra; sem eles poderemos não conseguir concluí-la.</p>
            <p className="text-sm text-foreground/55">Podemos atualizar este aviso quando o tratamento mudar. Indicaremos a data e comunicaremos alterações materiais. Se uma nova finalidade exigir consentimento, pedi-lo-emos antes de iniciar o tratamento.</p>
          </Section>

          <div className="flex flex-wrap gap-4 border-t border-stroke pt-10"><Link href="/" className="label-caps text-muted transition-colors hover:text-foreground">← Voltar à loja</Link><Link href="/offer" className="label-caps text-muted transition-colors hover:text-foreground">Condições gerais de venda →</Link></div>
        </article>
      </div>
    </main>
  );
}

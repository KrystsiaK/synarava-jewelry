const CLAIM_TERMS = [
  "925",
  "sterling",
  "silver",
  "prata",
  "серебро",
  "серебра",
  "gold",
  "ouro",
  "золото",
  "золота",
  "hypoallergenic",
  "hipoalergénic",
  "hipoalergenic",
  "гипоаллерген",
  "waterproof",
  "certified",
  "certificado",
  "сертифиц",
  "gemstone",
  "gemstones",
  "diamond",
  "diamante",
  "бриллиант",
  "pearl",
  "pérola",
  "жемчуг",
];

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function present(haystack, term) {
  const escaped = escapeRegExp(term.toLowerCase());
  return new RegExp(`(?<![\\p{L}\\p{N}_-])${escaped}(?![\\p{L}\\p{N}_-])`, "iu").test(
    haystack,
  );
}

export function factsCorpus(facts) {
  return JSON.stringify(facts).toLowerCase();
}

export function countClaimWarnings(json, facts) {
  const corpus = factsCorpus(facts);
  const locales = json?.locales ?? {};
  let warnings = 0;
  for (const locale of Object.keys(locales)) {
    const fields = locales[locale] ?? {};
    const blob = Object.values(fields).filter((v) => typeof v === "string").join("\n");
    for (const term of CLAIM_TERMS) {
      if (present(blob, term) && !present(corpus, term)) warnings += 1;
    }
  }
  return warnings;
}

export function schemaValid(json) {
  if (!json || typeof json !== "object" || Array.isArray(json)) return false;
  if (!json.locales || typeof json.locales !== "object") return false;
  if (json.locales.en && typeof json.locales.en.title === "string" && json.locales.en.title.trim()) {
    return false;
  }
  return true;
}

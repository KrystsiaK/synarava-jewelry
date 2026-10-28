# Для владельца — фаза 3: скорость, SEO и доступность витрины

**Дата:** 28 октября 2026 (Europe/Lisbon)  
**Технический отчёт:** [2026-10-28-storefront-perf.md](2026-10-28-storefront-perf.md)  
**Измерения:** Lighthouse по staging `https://synarava-shop-app-staging.up.railway.app` (EN+PT, mobile+desktop). Staging намеренно с `noindex` — SEO staging ≠ production.

## Что мы нашли

1. **PERF-ADV-001** — на мобиле LCP часто ≥5 с; страница товара хуже остальных.
2. **PERF-ADV-002** — на главной ~100+ KiB неиспользуемого JS.
3. **A11Y-ADV-001** — контраст логотипа/wordmark в футере очень слабый (≈1.1:1).
4. **SEO-ADV-001** — у home нет meta description (измерено на EN).
5. **SEO-ADV-002** — PT home title / og:title остаются на английском.
6. **SEO-ADV-003** — staging закрыт от индексации (ожидаемо; проверить, что **prod** открыт).

## Что это значит для бизнеса

- Медленный LCP = хуже конверсия и рекламный Quality; особенно на карточке товара.
- Слабый контраст = часть людей плохо видит бренд в подвале; формальный a11y риск.
- Title/description на PT и meta — видимость в поиске (на **production**, не на staging).

## Что делать дальше

1. Ускорить LCP PDP/home (изображения, приоритет hero) — главный выигрыш.
2. Поправить контраст футера (маленький CSS).
3. Meta description + PT title.
4. Убрать лишний JS.
5. После деплоя на prod — один прогон Lighthouse/robots уже по боевому URL.

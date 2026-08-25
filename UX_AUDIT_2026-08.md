# UX-аудит публичного магазина Synarava

**Дата:** 25 августа 2026
**Контекст:** Synarava оценивается как будущий мультикатегорийный curated shop: украшения, товары для питомцев, творческие товары для детей и инструменты/материалы для ручной работы.
**Метод:** dual-agent — независимая дизайнерская оценка и независимая техническая проверка storefront-кода, accessibility и браузерных сценариев.
**Охват:** Home, Shop, фильтры и поиск, Collections, карточка товара, add-to-cart, Cart, Checkout, About, мобильная навигация, темы, локализация, пустые и ошибочные состояния. Админка не оценивалась как пользовательский интерфейс магазина.

## Статус выполнения — 25 августа 2026

Первый структурный этап реализован:

- header, footer и metadata переведены на umbrella-позиционирование `Synarava / Curated Goods`;
- четыре отдела вынесены в desktop navigation, mobile drawer и первый экран Shop;
- для старых ювелирных товаров без department добавлена совместимая классификация; явное значение из CMS всегда имеет приоритет;
- на PDP реализован реальный выбор Shopify-варианта с merchandise ID, ценой, остатком и блокировкой недоступных вариантов;
- добавлены Shipping, Returns, Care & Safety и FAQ, ссылки выведены в оба footer;
- checkout-терминология упрощена до Delivery / Payment / Confirmed, техническая Stripe-ошибка больше не раскрывает конфигурацию;
- добавлены skip link, focus trap / Escape / focus restore для mobile drawer и общего modal primitive, reduced-motion для smooth scroll;
- обновлены тесты и добавлены тесты variant purchase panel.

Остаётся внешним P0: заменить `My Store`, отключить `Test Payment Gateway`, проверить production payment methods, policies и branding в Shopify Admin. В коде это исправить нельзя.

## Итог

Synarava уже имеет сильную визуальную идентичность и рабочую коммерческую основу. Сайт не выглядит шаблонным: фотография, типографика, асимметричная сетка, polygonal crops и couture-red создают узнаваемый характер. URL-фильтры, восстановление фильтров по согласию, guest checkout, сохранение корзины, понятный empty state и confirmation после добавления товара — хорошая продуктовая база.

Но сейчас посетитель видит прежде всего **ювелирный бренд-архив**, а не магазин четырёх направлений. Мультикатегорийность существует в модели данных и внутри фильтра Department, но почти не существует в Home, header, mobile menu, Collections, About, товарном языке и checkout. Это не косметическая проблема: новая аудитория может не понять, что нужная категория вообще есть.

Главный блокер запуска — финальный Shopify checkout: в проверенном сценарии он показывал название **My Store** и **Test Payment Gateway**. В момент максимального риска пользователь теряет Synarava branding и получает признаки тестового магазина.

**UX health score: 23/40 — приемлемая основа, но структурные исправления обязательны до мультикатегорийного запуска.**

## Готовность по направлениям

| Направление | Оценка | Вывод |
|---|---:|---|
| Визуальная идентичность | 8/10 | Сильная, последовательная и запоминающаяся; требует редакторского сокращения декоративной «архивной» грамматики. |
| Поиск и каталог | 6/10 | Функционально зрелая основа, но Department спрятан, фильтров слишком много одновременно, быстрых входов в категории нет. |
| Карточка товара | 5/10 | Сильная презентация и ясный CTA, но шаблон остаётся jewelry-first и не решает варианты, безопасность и category-specific guidance. |
| Корзина | 7/10 | Понятная, гостевой сценарий объяснён, feedback хороший; не хватает доставки, возвратов и undo для удаления. |
| Checkout и доверие | 3/10 | Самый слабый участок: чужой Shopify branding, test gateway, поздняя информация о доставке и нестандартная терминология. |
| Mobile UX | 6/10 | Интерфейс не разваливается, но hero и длинные сцены задерживают путь к товарам; категории отсутствуют в drawer. |
| Accessibility | 5/10 | Семантическая база неплохая, но есть проблемы focus management, reduced motion, skip-link, aria-live и touch targets. |
| Локализация | 4/10 | Переключатель работает, но перевод затрагивает только часть оболочки; commerce flow остаётся смешанным EN/PT. |
| Multi-category readiness | 4/10 | Taxonomy уже есть, но бренд, IA, PDP и сервисная информация пока не масштабированы на Pets, Kids и Making. |

## Nielsen: 10 эвристик

| # | Эвристика | Балл | Главная проблема |
|---|---|---:|---|
| 1 | Видимость состояния системы | 3/4 | Хорошие loading/success/filter states; доставка и часть checkout-состояний появляются слишком поздно. |
| 2 | Соответствие реальному миру | 2/4 | `archive`, `artifact`, `piece`, `acquisition` заменяют стандартный язык покупки. |
| 3 | Контроль и свобода пользователя | 3/4 | Фильтры легко снять, guest checkout есть; удаление из корзины без undo, drawer недостаточно управляет фокусом. |
| 4 | Согласованность и стандарты | 2/4 | Storefront цельный, но Shopify checkout, смешанные языки и jewelry-only branding ломают систему. |
| 5 | Предотвращение ошибок | 2/4 | Есть stock/loading guards, но варианты товара, доставка, safety и production checkout недостаточно защищены. |
| 6 | Узнавание вместо запоминания | 2/4 | Состояние фильтров видно, но departments скрыты, а отношения Department/Category/Collection/Tag не объяснены. |
| 7 | Гибкость и эффективность | 2/4 | Есть search и filters, но нет быстрых department entry points, сортировки и короткого mobile shopping path. |
| 8 | Эстетика и минимализм | 3/4 | Выразительно и чисто, но commerce-функции уступают full-screen heroes, кодам, ghost text и декоративным labels. |
| 9 | Диагностика и восстановление ошибок | 3/4 | Empty state и add-to-cart recovery хороши; ошибки shipping/payment недостаточно локальны и доступны. |
| 10 | Помощь и документация | 1/4 | Shipping, Returns, Care, FAQ и category-specific safety/help фактически отсутствуют. |
| **Итого** |  | **23/40** | **Нужна структурная работа перед масштабированием каталога.** |

## Что уже продумано хорошо

### 1. Фильтрация имеет зрелую техническую основу

- состояние фильтров отражается в URL;
- back/forward и deep links сохраняют контекст;
- active chips можно снимать по одному;
- есть Clear all и полезный no-results state;
- прошлые фильтры не применяются тайно — пользователь сам подтверждает восстановление.

Эту систему не нужно переписывать. Её нужно перестроить вокруг Department и показывать меньше измерений одновременно.

### 2. Add-to-cart и корзина дают качественный feedback

- кнопка показывает `Adding…` и блокируется на время запроса;
- cart badge обновляется;
- confirmation использует `aria-live`, предлагает View cart и Checkout;
- Cart объясняет guest checkout и сохранение корзины;
- empty cart предлагает понятный выход обратно в каталог.

### 3. Визуальный язык действительно отличим

Система выглядит авторской, а не generic marketplace. Это важный актив. Рекомендация — не убирать editorial identity, а ограничить её страницами и моментами, где она усиливает смысл: Home, campaign collections, maker stories и provenance.

## Главные проблемы

### [P0] Checkout выглядит тестовым и теряет доверие

**Что обнаружено:** переход в Shopify показывал `My Store`, визуально чужую среду и `Test Payment Gateway` с тестовыми инструкциями.

**Почему это критично:** пользователь принимает решение о передаче платёжных и персональных данных. Любое несоответствие бренда или намёк на тестовый режим выглядит как риск мошенничества и приводит к отказу.

**Что сделать:**

1. Настроить production payment gateway.
2. Заменить `My Store` на Synarava и настроить checkout branding/domain.
3. Проверить locale, currency и возврат назад в storefront.
4. Убрать технические сообщения о Stripe/keys из пользовательских ошибок.
5. Провести отдельный E2E smoke test реального checkout без списания денег.

**Suggested command:** `$impeccable harden checkout`.

### [P1] Мультикатегорийность не отражена в IA

**Что обнаружено:** Header предлагает Home / Shop / Collections / About. Jewelry, Pets, Kids и Making появляются только в Shop → Filters → Department, ниже почти полноэкранного hero. Header и footer продолжают называться `SYNARAVA JEWELRY`; Home, Collections и About также jewelry-first.

**Почему это важно:** посетитель из Pets или Kids не получает подтверждения релевантности в первые секунды и может уйти, не открыв фильтры.

**Что сделать:**

- добавить department-first вход: All / Jewelry / Pets / Kids / Making;
- вывести четыре направления на Home и в mobile drawer;
- решить бренд-архитектуру: umbrella Synarava или Synarava Jewelry как один department;
- определить Collections как cross-category editorial curation, seasonal drops или occasions — но не использовать её вместо категорий;
- скрывать пустые departments до наполнения или показывать осмысленный Coming soon.

**Suggested command:** `$impeccable shape storefront information architecture`.

### [P1] Карточка товара не готова к разным типам товаров и вариантам

**Что обнаружено:** единый PDP использует jewelry language и блоки symbolism/material story для всех departments. Внутренние данные (`My Store`, `Shopify category`, barcode, shipping weight) попадают в consumer UI. Код отображает количество вариантов, но Add to cart вызывается без выбранного `merchandiseId`; пользовательского variant selector в PDP нет.

**Почему это важно:** размеры ошейников, цвета, комплектации, возрастные группы и варианты creative kits нельзя безопасно свести к «первому доступному варианту». Для Pets и Kids ошибки выбора влияют не только на вкус, но и на применимость/безопасность.

**Что сделать:**

- добавить обязательный variant selector с price/stock change и disabled unavailable combinations;
- создать общую верхнюю часть PDP: title, price, availability, variants, delivery, returns, CTA;
- ниже подключать department-specific modules:
  - Jewelry: materials, dimensions, care, certificates;
  - Pets: size guide, animal/weight range, fastening, wash/care, safety;
  - Kids: age range, supervision, contents, allergens/material safety, certification;
  - Making: tool type, skill level, compatibility, included items, safety;
- убрать platform/vendor taxonomy из публичной карточки;
- оставить editorial story как дополнительный, а не обязательный слой.

**Suggested command:** `$impeccable shape product detail system`.

### [P1] Commerce trust появляется слишком поздно

**Что обнаружено:** рядом с Add to cart нет оценки доставки, возвратов, налогов/duties, гарантии и category-specific safety. Footer-ссылки Shipping и Care Guide ведут на About. About объясняет, «как использовать сайт», но не доказывает критерии отбора, экспертизу и ответственность магазина.

**Почему это важно:** curated shop продаёт доверие к отбору. Родитель и владелец питомца нуждаются в иных доказательствах, чем покупатель украшения.

**Что сделать:**

- создать реальные Shipping, Returns, Care/Safety, Contact и FAQ страницы;
- показать краткие delivery/returns assurances возле CTA и в Cart;
- объяснить критерии отбора, makers, происхождение и контроль качества;
- обновить footer routes и copyright;
- различать legal entity copy и пользовательский brand descriptor.

**Suggested command:** `$impeccable clarify storefront trust and service content`.

### [P1] Accessibility и recovery имеют системные пробелы

**Подтверждённые проблемы:**

- нет skip-link к main content;
- закрытый mobile drawer не `inert`, не trap/restore focus и не закрывается по Escape;
- mobile filter modal также не trap/restore focus;
- на ширине 920–1023 px theme controls могут исчезать из обоих вариантов навигации;
- mobile search focus style слабый/отсутствует;
- часть touch targets меньше 44×44 px;
- payment errors и result updates не всегда имеют `aria-live`/alert;
- shipping validation уводит на отдельную error page и теряет введённые данные;
- checkout progress не имеет list/step semantics;
- ряд Motion-компонентов не уважает reduced motion;
- dark theme не задаёт `color-scheme: dark`;
- global smooth scroll не отключается при reduced motion.

**Что сделать:** провести отдельный keyboard + screen-reader + 200% zoom pass и исправлять shared primitives раньше страниц: drawer, modal, fields, live regions, progress, motion policy.

**Suggested command:** `$impeccable audit storefront accessibility`.

## Проблемы второго уровня

### Каталог перегружает первое решение

Desktop одновременно предлагает Search, Department, Category, Collection, Tag, Material, Finish, Origin и Compliance. Пользователь должен понять taxonomy до знакомства с товарами. На mobile фильтры спрятаны лучше, но путь к ним задерживают hero и restore prompt.

**Решение:** Department — первый шаг; затем 2–3 релевантных фильтра; остальное под More filters. Добавить sorting, availability и при необходимости price range.

### Editorial theatre замедляет shopping intent

Full-viewport heroes, scroll-linked stories, ghost typography, technical codes и длинные product scenes создают атмосферу, но повторяются слишком часто. Возвращающийся покупатель должен быстрее попадать к товарам.

**Решение:** сохранить сильную сцену на Home и campaign pages; на Shop сократить hero, дать department shortcuts и первые товары above/near fold; на PDP держать purchase block раньше истории.

### Локализация остаётся частичной

После переключения Português часть header/footer переводится, но Shop, filters, restore prompt, cart/checkout и accessibility strings остаются English. Возможна строка вида `Carrinho, 1 items`.

**Решение:** вынести весь storefront copy и pluralization в i18n, передавать locale в checkout и тестировать EN/PT route matrix. Пока перевод не полный, лучше честно ограничить язык, чем показывать смешанный интерфейс.

### Profile и account UX требуют отдельного прохода

Tabs хранят состояние только в `useState`, не отражаются в URL и не имеют полной tab semantics. Async feedback в settings недостаточно объявляется assistive technologies.

**Решение:** URL-backed sections, role/aria tab pattern, live regions и единая reduced-motion policy.

## Когнитивная нагрузка

**Результат: 4 из 8 проверок не пройдены — высокая нагрузка в Shop и Checkout.**

| Проверка | Статус | Причина |
|---|---|---|
| Один главный фокус | ❌ | Shop одновременно продаёт историю бренда и предлагает 9 способов уточнить каталог. |
| Chunking ≤4 | ❌ | 8 фильтров + search находятся в одном decision point. |
| Группировка | ✅ | Hero, filters, grid, cart items и summary визуально хорошо разделены. |
| Визуальная иерархия | ⚠️ | Она сильная, но ставит spectacle выше shopping utility. |
| Один шаг за раз | ❌ | Taxonomy раскрыта целиком; checkout объединяет слишком много решений. |
| Минимум вариантов | ❌ | Каталог и compact header превышают комфортные четыре опции. |
| Не заставляет помнить | ✅ | URL state, chips, cart badge и restore снижают memory load. |
| Progressive disclosure | ⚠️ | Mobile лучше desktop, но Department не выделен как первичный шаг. |

## Эмоциональная воронка

1. **Home — пик интереса:** сильная фотография и типографика формируют редкость и характер.
2. **Shop hero — интерес с сомнением:** текст обещает четыре departments, визуальный мир показывает только jewelry.
3. **Filters — долина усилий:** пользователь расшифровывает taxonomy вместо выбора направления.
4. **PDP — уверенность, затем сомнение:** price/availability/CTA ясны, но внутренние Shopify-поля и отсутствие category guidance снижают доверие.
5. **Add to cart — локальный пик:** confirmation и ясные next steps работают хорошо.
6. **Cart — успокоение:** guest checkout и summary понятны, но shipping/returns ещё неизвестны.
7. **Checkout — худший финал:** бренд исчезает, появляется My Store/Test Gateway. По peak-end rule именно этот момент может определить общее впечатление.

## Персоны и риски

### Jordan — впервые в магазине

- не увидит Kids/Pets на Home и в header;
- не поймёт различия Department / Category / Collection / Tag;
- встретит `archive`, `artifact`, `acquisition` вместо знакомого commerce-языка;
- не найдёт реальных Shipping/Returns/Care pages;
- увидит чужой checkout и может отказаться от оплаты.

### Casey — покупает с телефона одной рукой

- пройдёт Shop → длинный hero → Filters → Department вместо прямого входа;
- будет отвлечён restore prompt до просмотра товаров;
- столкнётся с мелкими language/theme/quantity targets;
- при ошибке shipping потеряет введённые данные;
- получит смешанный EN/PT flow при переключении языка.

### Riley — проверяет крайние состояния

- найдёт публичный пустой Pets department;
- заметит конфликт Jewelry branding и four-department promise;
- увидит внутренние поля Shopify/vendor на PDP;
- подтвердит отсутствие variant selection при нескольких variants;
- обнаружит Test Payment Gateway и сервисные ссылки, ведущие на About.

## Anti-pattern verdict

Сайт **не выглядит generic AI-generated**, но переиспользует модную grammar `editorial archive / classified artifact`:

- tiny uppercase tracked labels почти на каждой секции;
- декоративные номера и технические коды без информационной функции;
- giant ghost typography;
- повторяемый шаблон serif hero + eyebrow + red italic fragment;
- archive vocabulary даже в фильтрах, корзине и checkout.

Детерминированный Impeccable detector проверил 82 storefront TSX-файла и вернул **0 автоматических нарушений**. Это означает отсутствие известных формальных anti-pattern matches, но не отменяет ручные UX/accessibility findings. В исходниках отдельно найдено 103 употребления jewelry/piece/archive/acquisition в 27 публичных файлах; часть законна, но глобальная оболочка и commerce copy требуют нейтрализации.

## Рекомендуемая последовательность работ

### Этап 0 — блокеры публичного запуска

1. Production Shopify/Stripe configuration и branded checkout.
2. Variant selection и невозможность добавить неоднозначный вариант.
3. Shipping/Returns/Contact/Care-Safety content и корректные footer routes.
4. Убрать internal Shopify/vendor/category/error details из public UI.

**Критерий готовности:** покупатель может выбрать конкретный вариант, заранее понять доставку/возврат и завершить оплату в однозначно Synarava-branded production flow.

### Этап 1 — мультикатегорийная архитектура

1. Зафиксировать umbrella brand promise и заменить shared `JEWELRY` descriptor там, где он описывает весь магазин.
2. Добавить departments в Home/header/mobile menu.
3. Перестроить Shop: department-first, context-aware filters, More filters.
4. Определить роль Collections и правила публикации пустых departments.
5. Обновить metadata/SEO под category-neutral storefront и department routes.

**Критерий готовности:** пользователь любой из четырёх аудиторий видит свой вход за 5 секунд и не обязан понимать внутреннюю taxonomy.

### Этап 2 — универсальная PDP-система

1. Общий commerce header товара.
2. Department-specific specs, sizing, safety, care и certification.
3. Editorial modules как опциональные блоки.
4. Breadcrumbs Department → Category → Product.
5. Delivery/returns reassurance рядом с CTA.

**Критерий готовности:** один template обслуживает четыре departments, не показывая нерелевантные jewelry-поля.

### Этап 3 — accessibility и resilience

1. Shared drawer/modal focus management и inert background.
2. Skip link, aria-current, step/tab semantics, live regions.
3. Touch target pass и focus-visible pass.
4. Central reduced-motion policy и dark color-scheme.
5. Inline shipping/payment errors с сохранением данных.

**Критерий готовности:** основной путь Shop → Cart → Checkout проходится keyboard-only, при 200% zoom и reduced motion без потери функций.

### Этап 4 — локализация и эффективность

1. Полный EN/PT словарь и pluralization.
2. Locale-aware currency/checkout.
3. Sorting, availability и contextual filters.
4. Сокращённый Shop hero и быстрый returning-user path.
5. URL-backed accessible account tabs.

**Критерий готовности:** один выбранный язык используется во всём commerce flow, а повторный покупатель быстро возвращается к нужному товару.

### Этап 5 — финальная полировка и проверка

1. Mobile/desktop/browser matrix.
2. Empty/long-copy/missing-media/out-of-stock/slow-network scenarios.
3. Реальный screen-reader и keyboard pass.
4. Контраст всех tiny/opacity labels.
5. Conversion analytics: department entry → PDP → add-to-cart → checkout completion.

## Метрики после изменений

- доля переходов в department с Home/header;
- время до первого просмотра релевантного товара;
- filter usage и доля no-results;
- variant-selection errors;
- add-to-cart rate по department;
- cart → checkout и checkout completion;
- обращения по доставке/возвратам/размерам/безопасности;
- abandonment при переходе в Shopify checkout;
- доля mixed-locale sessions;
- accessibility task completion для keyboard/screen-reader сценария.

## Небольшие, но заметные исправления

- обновить copyright `2025`;
- заменить `Show all pieces` на `Show all products` в глобальных состояниях;
- сделать breadcrumb конкретным, а не `Shop / Product`;
- добавить `aria-current` active navigation и checkout step;
- добавить `themeColor` и `color-scheme: dark`;
- убрать `transition-all` в девяти storefront местах;
- отключать global smooth scroll при reduced motion;
- проверить контраст текста размером 0.62–0.72rem с opacity 42–55%;
- исправить два H1 на Home;
- скрыть или объяснить пустые departments до наполнения.

## Вопросы для продуктового решения

1. Synarava — единый umbrella curated shop или Jewelry остаётся главным брендом, а остальные направления становятся отдельными sub-brands?
2. Что должно быть первым входом в каталог: четыре departments или подборки по человеку/поводу (`For kids`, `For pets`, `For makers`, `Gifts`)?
3. Collections должны быть cross-category stories, сезонными drops или оставаться только jewelry-editorial разделом?
4. Какие доказательства отбора и безопасности Synarava готова публиковать для Kids и Pets: сертификаты, age/size guides, maker verification, material restrictions?

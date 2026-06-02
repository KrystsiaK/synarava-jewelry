# Graph Report - synarava-jewelry  (2026-06-02)

## Corpus Check
- 121 files · ~49,943 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 678 nodes · 973 edges · 71 communities (52 shown, 19 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 18 edges (avg confidence: 0.87)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_UI Transition Patterns|UI Transition Patterns]]
- [[_COMMUNITY_TypeScript Compiler Config|TypeScript Compiler Config]]
- [[_COMMUNITY_App Shell & Typography|App Shell & Typography]]
- [[_COMMUNITY_Data Layer & Infrastructure|Data Layer & Infrastructure]]
- [[_COMMUNITY_Runtime Dependencies|Runtime Dependencies]]
- [[_COMMUNITY_Project Build Scripts|Project Build Scripts]]
- [[_COMMUNITY_Dev Toolchain|Dev Toolchain]]
- [[_COMMUNITY_Jewelry Brand Homepage|Jewelry Brand Homepage]]
- [[_COMMUNITY_Skills Registry|Skills Registry]]
- [[_COMMUNITY_Error State Animations|Error State Animations]]
- [[_COMMUNITY_Avatar Group Interaction|Avatar Group Interaction]]
- [[_COMMUNITY_ESLint Configuration|ESLint Configuration]]
- [[_COMMUNITY_Next.js Config|Next.js Config]]
- [[_COMMUNITY_Tailwind CSS Setup|Tailwind CSS Setup]]
- [[_COMMUNITY_PostCSS Config|PostCSS Config]]
- [[_COMMUNITY_Utility Icons|Utility Icons]]
- [[_COMMUNITY_Platform Branding Assets|Platform Branding Assets]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Package Identity|Package Identity]]
- [[_COMMUNITY_Auth Dependency|Auth Dependency]]
- [[_COMMUNITY_React Core|React Core]]
- [[_COMMUNITY_Next Config Root|Next Config Root]]
- [[_COMMUNITY_Browser Window Icon|Browser Window Icon]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 38|Community 38]]
- [[_COMMUNITY_Community 39|Community 39]]
- [[_COMMUNITY_Community 40|Community 40]]
- [[_COMMUNITY_Community 41|Community 41]]
- [[_COMMUNITY_Community 42|Community 42]]
- [[_COMMUNITY_Community 43|Community 43]]
- [[_COMMUNITY_Community 44|Community 44]]
- [[_COMMUNITY_Community 45|Community 45]]
- [[_COMMUNITY_Community 46|Community 46]]
- [[_COMMUNITY_Community 47|Community 47]]
- [[_COMMUNITY_Community 48|Community 48]]
- [[_COMMUNITY_Community 49|Community 49]]
- [[_COMMUNITY_Community 50|Community 50]]
- [[_COMMUNITY_Community 51|Community 51]]
- [[_COMMUNITY_Community 52|Community 52]]
- [[_COMMUNITY_Community 53|Community 53]]
- [[_COMMUNITY_Community 54|Community 54]]
- [[_COMMUNITY_Community 55|Community 55]]
- [[_COMMUNITY_Community 56|Community 56]]
- [[_COMMUNITY_Community 70|Community 70]]

## God Nodes (most connected - your core abstractions)
1. `cn()` - 23 edges
2. `transitions-dev Skill` - 17 edges
3. `compilerOptions` - 16 edges
4. `getCurrentUser()` - 16 edges
5. `requirePermission()` - 12 edges
6. `Universal :root CSS Block` - 12 edges
7. `prefers-reduced-motion Accessibility Guard` - 12 edges
8. `db - Prisma Client Singleton` - 11 edges
9. `AppDelegate` - 10 edges
10. `getOrCreateCart()` - 10 edges

## Surprising Connections (you probably didn't know these)
- `PostgreSQL Docker Service` --shares_data_with--> `db - Prisma Client Singleton`  [INFERRED]
  docker-compose.yml → lib/db.ts
- `Synarava Storefront README` --references--> `env`  [INFERRED]
  README.md → lib/env.ts
- `Synarava Storefront README` --references--> `Next.js Framework`  [EXTRACTED]
  README.md → package.json
- `Synarava Storefront README` --references--> `Prisma ORM Client`  [EXTRACTED]
  README.md → package.json
- `Synarava Storefront README` --references--> `Stripe Payment Library`  [EXTRACTED]
  README.md → package.json

## Hyperedges (group relationships)
- **Lazy Singleton Services (S3, Stripe, Prisma DB)** — lib_s3_gets3, lib_stripe_getstripe, lib_db_db, concept_singleton_lazy_init [INFERRED 0.95]
- **Application Shell Layout (RootLayout + SiteHeader + SiteFooter)** — app_layout_rootlayout, layout_site_header_siteheader, layout_site_footer_sitefooter [EXTRACTED 1.00]
- **Environment Variable Validation Chain (Schema + env export + consumers)** — lib_env_envschema, lib_env_env, lib_s3_gets3, lib_stripe_getstripe [INFERRED 0.85]
- **All Transition Snippets Share Universal :root CSS Block** — card_resize_card_resize, number_pop_in_number_pop_in, notification_badge_notification_badge, text_states_swap_text_states_swap, menu_dropdown_menu_dropdown, modal_modal, panel_reveal_panel_reveal, page_side_by_side_page_side_by_side, icon_swap_icon_swap, success_check_success_check, avatar_group_hover_avatar_group_hover, transitions_dev_root_css_block [EXTRACTED 1.00]
- **All Transitions Implement prefers-reduced-motion Guard** — card_resize_card_resize, number_pop_in_number_pop_in, notification_badge_notification_badge, text_states_swap_text_states_swap, menu_dropdown_menu_dropdown, modal_modal, panel_reveal_panel_reveal, page_side_by_side_page_side_by_side, icon_swap_icon_swap, success_check_success_check, avatar_group_hover_avatar_group_hover, transitions_dev_prefers_reduced_motion [EXTRACTED 1.00]
- **Next.js Project Default Branding SVGs** — public_vercel_svg, public_next_svg, public_globe_svg, public_window_svg, public_file_svg [INFERRED 0.85]

## Communities (71 total, 19 thin omitted)

### Community 0 - "UI Transition Patterns"
Cohesion: 0.14
Nodes (29): Avatar Group Hover Transition, AvatarGroup React Component, Inline Timing-Function Before Variable Write Rationale, setShifts JS Function, Card Resize Transition, Icon Swap Transition, closeDropdown JS Function, Menu Dropdown Transition (+21 more)

### Community 1 - "TypeScript Compiler Config"
Cohesion: 0.10
Nodes (19): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+11 more)

### Community 2 - "App Shell & Typography"
Cohesion: 0.09
Nodes (27): metadata, mono, Courier Prime Mono Font, RootLayout(), sans, Hanken Grotesk Sans Font, serif, Playfair Display Serif Font (+19 more)

### Community 3 - "Data Layer & Infrastructure"
Cohesion: 0.16
Nodes (15): Lazy Singleton Initialization Pattern, PostgreSQL Docker Service, db - Prisma Client Singleton, env, envSchema, optionalString, optionalUrl, getS3() (+7 more)

### Community 4 - "Runtime Dependencies"
Cohesion: 0.06
Nodes (35): dependencies, @aws-sdk/client-s3, @aws-sdk/s3-request-presigner, clsx, lucide-react, next, next-auth, @prisma/client (+27 more)

### Community 5 - "Project Build Scripts"
Cohesion: 0.10
Nodes (33): AccountActionState, updateAdminCredentialsAction(), AdminAccountPage(), AdminLayout(), buildResetUrl(), loginAction(), logoutAction(), registerAction() (+25 more)

### Community 6 - "Dev Toolchain"
Cohesion: 0.07
Nodes (40): heritagePoints, identityStats, ManifestoPage(), metadata, AboutPage(), heritagePoints, identityStats, infoItems (+32 more)

### Community 7 - "Jewelry Brand Homepage"
Cohesion: 0.13
Nodes (17): AuthActionState, AuthField(), AuthForm(), AuthInput(), AuthMessage(), AuthTextarea(), AuthShell(), AuthShellProps (+9 more)

### Community 8 - "Skills Registry"
Cohesion: 0.25
Nodes (7): skills, transitions-dev, computedHash, skillPath, source, sourceType, version

### Community 9 - "Error State Animations"
Cohesion: 0.50
Nodes (5): transitions-dev Skill Lock, Error State Shake Transition, Reduced Motion Accessibility Guard, Shake Animation - Multi-Segment Keyframe Pattern, Three-Class Error State Pattern (is-error, is-shaking)

### Community 10 - "Avatar Group Interaction"
Cohesion: 0.17
Nodes (11): Commands, Common mistakes to avoid, Decision rules, Output format, Quick reference, Reference files, transitions apply — install the best-fit transition, Transitions.dev (+3 more)

### Community 17 - "Community 17"
Cohesion: 0.14
Nodes (11): Any, AppDelegate, Bool, NSUserActivity, UIApplication, UIApplicationDelegate, UIResponder, UIUserActivityRestoring (+3 more)

### Community 23 - "Community 23"
Cohesion: 0.17
Nodes (11): Admin information architecture, Auth and RBAC, CMS, Commerce, Data model strategy, Delivery strategy, Permission model, Route plan (+3 more)

### Community 24 - "Community 24"
Cohesion: 0.17
Nodes (11): Admin UI kit extension, Collection detail, Collections index, Core primitives, Design intent, Foundation tokens, Implementation rule, Manifesto and home (+3 more)

### Community 25 - "Community 25"
Cohesion: 0.22
Nodes (8): Avatar group hover, CSS, HTML usage, JavaScript orchestration, React form, Tunable variables, When to use, Why the timing-function is set inline before the variable writes

### Community 26 - "Community 26"
Cohesion: 0.22
Nodes (8): CSS, Error state shake, HTML usage, JavaScript orchestration, Recomputing the keyframe stops, Tunable variables, When to use, Why three classes (`.is-error` on wrap + input, `.is-shaking` on input)

### Community 27 - "Community 27"
Cohesion: 0.25
Nodes (7): Calibrating `stroke-dasharray` for your path, CSS, HTML usage, JavaScript orchestration, Success check, Tunable variables, When to use

### Community 28 - "Community 28"
Cohesion: 0.29
Nodes (6): Card resize, CSS, HTML usage, JavaScript orchestration, Tunable variables, When to use

### Community 29 - "Community 29"
Cohesion: 0.29
Nodes (6): CSS, HTML usage, JavaScript orchestration, Number pop-in, Tunable variables, When to use

### Community 30 - "Community 30"
Cohesion: 0.29
Nodes (6): CSS, HTML usage, JavaScript orchestration, Notification badge, Tunable variables, When to use

### Community 31 - "Community 31"
Cohesion: 0.29
Nodes (6): CSS, HTML usage, JavaScript orchestration, Text states swap, Tunable variables, When to use

### Community 32 - "Community 32"
Cohesion: 0.29
Nodes (6): CSS, HTML usage, JavaScript orchestration, Menu dropdown, Tunable variables, When to use

### Community 33 - "Community 33"
Cohesion: 0.29
Nodes (6): CSS, HTML usage, JavaScript orchestration, Modal open / close, Tunable variables, When to use

### Community 34 - "Community 34"
Cohesion: 0.29
Nodes (6): CSS, HTML usage, JavaScript orchestration, Panel reveal, Tunable variables, When to use

### Community 35 - "Community 35"
Cohesion: 0.29
Nodes (6): CSS, HTML usage, JavaScript orchestration, Page side-by-side, Tunable variables, When to use

### Community 36 - "Community 36"
Cohesion: 0.29
Nodes (6): CSS, HTML usage, Icon swap, JavaScript orchestration, Tunable variables, When to use

### Community 37 - "Community 37"
Cohesion: 0.08
Nodes (44): addToCartAction(), decreaseCartItemAction(), increaseCartItemAction(), refreshCommerce(), removeCartItemAction(), CartPage(), metadata, confirmOrderAction() (+36 more)

### Community 38 - "Community 38"
Cohesion: 0.25
Nodes (5): lookbook, materials, metadata, Props, stats

### Community 39 - "Community 39"
Cohesion: 0.33
Nodes (5): Architecture notes, Current implementation posture, Environment, Local development, Synarava

### Community 40 - "Community 40"
Cohesion: 0.06
Nodes (40): categories, CollectionsPage(), materialFilters, materialStories, metadata, products, AddToCartButton(), AddToCartButtonProps (+32 more)

### Community 45 - "Community 45"
Cohesion: 0.14
Nodes (13): dependencies, @capacitor/core, description, devDependencies, @capacitor/android, @capacitor/cli, @capacitor/ios, name (+5 more)

### Community 46 - "Community 46"
Cohesion: 0.14
Nodes (13): Synarava Jewelry — Мобильное приложение (iOS & Android), 📱 Адаптация веб-интерфейса под мобильный WebView, 🚀 Быстрый старт (Локальное тестирование), Запуск на Android (через Android Studio):, Запуск на iOS (через Xcode):, ⚙️ Конфигурация для Продакшна, Метод 1: Скрытие элементов через CSS, Метод 2: Проверка в JavaScript / React (+5 more)

### Community 47 - "Community 47"
Cohesion: 0.26
Nodes (12): parseTags(), revalidateStorefront(), saveCategoryAction(), savePageAction(), saveProductAction(), saveTagAction(), slugify(), AdminDashboardPage() (+4 more)

### Community 48 - "Community 48"
Cohesion: 0.20
Nodes (9): appId, appName, ios, contentInset, packageClassList, server, cleartext, url (+1 more)

### Community 49 - "Community 49"
Cohesion: 0.22
Nodes (8): appId, appName, ios, contentInset, server, cleartext, url, webDir

### Community 50 - "Community 50"
Cohesion: 0.40
Nodes (4): images, info, author, version

### Community 51 - "Community 51"
Cohesion: 0.40
Nodes (4): images, info, author, version

### Community 52 - "Community 52"
Cohesion: 0.50
Nodes (3): info, author, version

### Community 70 - "Community 70"
Cohesion: 0.18
Nodes (8): CheckoutShell(), CheckoutShellProps, steps, metadata, Props, metadata, Props, reasonMap

## Knowledge Gaps
- **321 isolated node(s):** `version`, `source`, `sourceType`, `skillPath`, `computedHash` (+316 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **19 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `db - Prisma Client Singleton` connect `Data Layer & Infrastructure` to `Community 37`, `Project Build Scripts`, `Community 70`, `Community 40`, `Community 47`?**
  _High betweenness centrality (0.040) - this node is a cross-community bridge._
- **Why does `HomePage()` connect `Dev Toolchain` to `Community 40`, `App Shell & Typography`?**
  _High betweenness centrality (0.013) - this node is a cross-community bridge._
- **Why does `RootLayout()` connect `App Shell & Typography` to `Community 37`, `Dev Toolchain`?**
  _High betweenness centrality (0.011) - this node is a cross-community bridge._
- **What connects `version`, `source`, `sourceType` to the rest of the system?**
  _321 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `UI Transition Patterns` be split into smaller, more focused modules?**
  _Cohesion score 0.14285714285714285 - nodes in this community are weakly interconnected._
- **Should `TypeScript Compiler Config` be split into smaller, more focused modules?**
  _Cohesion score 0.1 - nodes in this community are weakly interconnected._
- **Should `App Shell & Typography` be split into smaller, more focused modules?**
  _Cohesion score 0.08739495798319327 - nodes in this community are weakly interconnected._
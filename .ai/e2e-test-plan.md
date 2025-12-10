# Plan środowiska i testów E2E – PokéMath

## Stack (źródło: @tech-stack.md)

- Astro 5, React 19, TS 5, Tailwind 4, shadcn/ui.
- Supabase: Auth (Google), Postgres z RLS, unikalność `(user_id, pokemon_id, variant)`.
- Sprite’y lokalne/CDN PokeAPI (brak runtime calli do PokeAPI API w produkcji; w E2E mogą być mockowane URL-e CDN).
- Build: Astro `output: "server"` z adapterem Vercel; testy E2E korzystają z trybu `--mode e2e` na dev serwerze (bez `astro preview`).

## Środowisko E2E

- Osobny projekt Supabase `pokemath-e2e`; własne URL/anon/service_role/JWT secret.
- RLS włączone; schemat z migracji prod; osobne OAuth Google (lub magic link dla testów).
- Storage opcjonalny (`sprites-e2e`/`placeholders-e2e`), bo sprite’y w testach są mockowane.
- Reset danych przed runem: `supabase db reset` + seed E2E lub truncate + reseed.
- Domeny/CORS: whitelist E2E (localhost:4173, preview).
- Rate limit: poluzowany tylko dla kluczy E2E.

## Zmienne (.env.e2e, ignorowane w VCS)

- `SUPABASE_URL`, `SUPABASE_KEY`
- `E2E_AUTH_MOCK=true` (mock logowania)
- `ASTRO_SITE=http://localhost:4173`
- (opcjonalnie) `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`, `POKEMATH_PRNG_SEED`

## Build/uruchamianie E2E

- Skrypty:
  - `npm run build:e2e` → `astro build --mode e2e`
  - `npm run test:e2e` → build:e2e + Playwright
  - `npm run playwright:install` → instalacja przeglądarek
- Playwright: `playwright.config.e2e.ts` uruchamia `npm run dev -- --host 0.0.0.0 --port 4173 --mode e2e` i czeka na `http://localhost:4173` (adapter Vercel nie wspiera `astro preview`).

## Testy logowania (mock Supabase OAuth)

- Zasada: nie otwieramy Google; mock `/auth/v1/token` (+ `/auth/v1/user` gdy potrzebne).
- Selektory: `data-test-id="login-google"`, `data-test-id="user-avatar"`, `data-test-id="login-error"`.
- Tokeny fikcyjne JSON, bez prawdziwych JWT.
- Przykłady w `tests/e2e/auth-google.spec.ts` (pozytywny i 401).

## Testy kolekcji (mock Supabase collection)

- Cel: użytkownik widzi swoje złapane Pokémony.
- Selektory kart: `data-test-id="collection-card-<name>"`.
- Mocki: `/auth/v1/token`, `/auth/v1/user`, `/api/collection`, `/api/collection/stats`.
- Sprite’y: realne URL z PokeAPI (np. `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/1.png`); w przyszłości można podmienić na lokalne WebP z `public/`.
- Przykład: `tests/e2e/collection-starters.spec.ts` (startery bulbasaur/charmander/squirtle).

## Pokrycie E2E (Playwright) – lista testów

- `tests/e2e/auth-google.spec.ts` – logowanie Google: sukces oraz błąd `invalid_grant`.
- `tests/e2e/collection-starters.spec.ts` – widok kolekcji z mockowanymi starterami (karty Bulbasaur/Charmander/Squirtle).
- `tests/e2e/encounter-flow.spec.ts` – wild encounter: pełne capture oraz ścieżka porażka → retry → sukces.
- `tests/e2e/collection-filters.spec.ts` – filtry kolekcji: shiny i zawężenie po typie (Electric).
- `tests/e2e/dashboard-stats.spec.ts` – dashboard: widoczność sekcji „Collection Progress”, statów i kafla „Start Encounter”.

## Selektory w UI (dodane)

- `login-google`, `user-avatar`, `login-error`
- `collection-card-<name>` (np. bulbasaur, charmander, squirtle)

## Bezpieczeństwo i izolacja

- Sekrety w CI (Encrypted Secrets); lokalnie `direnv`/`doppler`/1Password CLI.
- Guard: testy failują, gdy URL/key nie zawiera `e2e`.
- RLS włączone także w E2E; brak użycia prod/dev kluczy.
- Brak prawdziwego Google OAuth ani realnych JWT w testach.

## Ciągłość/CI (zalecany pipeline)

1. `npm ci`
2. `npm run playwright:install` (cache w CI)
3. Przygotowanie DB E2E: migracje + seed (lub `supabase db reset`)
4. `npm run test:e2e` (build:e2e + testy)
5. Artefakty: trace Playwright, logi

## Dane testowe (mocki)

- Startery: id 1/4/7 z realnymi sprite URL PokeAPI, variant normal, `isCaught=true`.
- Stats mock: `totalCaptured=3`, `totalPossible=151`, breakdown type/variant.

## Do zrobienia (opcjonalnie)

- Dodać lokalne sprite’y WebP do `public/` i używać ich w mockach dla pełnej niezależności od CDN.
- Uzupełnić `site` w `astro.config.mjs` (ostrzeżenie sitemap).
- Script `db:reset:e2e` i seed E2E w repo (obecnie testy rely na mockach).

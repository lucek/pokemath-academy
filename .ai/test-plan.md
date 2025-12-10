## Plan testów PokéMath

### 1. Wprowadzenie i cele

- Zapewnienie jakości MVP PokéMath (Astro static + React islands) z Supabase (auth, Postgres, RLS).
- Weryfikacja ścieżek krytycznych: encounters (wild/evolution/submit), kolekcja, detale Pokémonów, typy, zdrowie usługi, obsługa offline/online.
- Upewnienie się, że walidacje (Zod), limity (rate limit, próby), oraz RLS chronią dane użytkownika.
- Minimalizacja ryzyk wynikających z pamięciowych magazynów (sesje encounterów, rate limiter, LRU pytań).

### 2. Zakres testów

#### 2.1 Co testujemy

- API: `/api/encounters/*`, `/api/collection`, `/api/collection/stats`, `/api/pokemon`, `/api/pokemon/:id`, `/api/types`, `/api/health`.
- UI (React/Astro): Landing (public), Dashboard, CollectionView (filtry, paginacja, infinite scroll), Encounter modal (wild/evolution, retry), PokemonDetailPage (evolution chain, akcje).
- Logika domenowa: generator pytań (stage/difficulty), obsługa seedów, próby i shiny, mapowanie sprite/typów, statystyki kolekcji.
- Niefunkcjonalne: dostępność (a11y), wydajność (LCP, czasy API), odporność na sieć (offline/online), bezpieczeństwo (auth/RLS, rate limit).

#### 2.2 Czego nie testujemy (Out of scope)

- Pełne testy manualne treści marketingowych i stron informacyjnych spoza głównego flow (np. statyczne podstrony bez logiki biznesowej).
- Pełne testy cross‑browser i cross‑device poza uzgodnionym zestawem (Chromium/Chrome + jedna nowoczesna wersja Safari/Firefox na desktopie, podstawowa weryfikacja na mobile).
- Testy obciążeniowe typu stress/soak wykraczające poza zdefiniowane smoke/perf (k6/artillery) oraz uzgodnione budżety wydajnościowe.
- Infrastruktura Supabase jako usługa (dostępność platformy, sieć między regionami) – zakładamy poprawne działanie dostawcy, testujemy jedynie naszą konfigurację i użycie.
- Integracje zewnętrzne, których projekt nie używa w MVP (np. brak testów wysyłki e‑mail/SMS, brak testów płatności).
- Pełny visual regression testing (piksel‑po‑pikselu) – ograniczamy się do krytycznych regresji wizualnych wychwytywanych w E2E i a11y.

### 3. Strategia testowania i piramida testów

Strategia zakłada **piramidę testów**: najwięcej szybkich i tanich testów jednostkowych, mniej testów integracyjnych/API, najmniej kosztownych i wolniejszych testów E2E/UI. Nowe testy dodajemy domyślnie na **najniższym możliwym poziomie**, a wyżej tylko wtedy, gdy niższa warstwa nie jest w stanie wiarygodnie zweryfikować danego zachowania.

- Poziom **unit**: ~60–70% wszystkich testów automatycznych (logika domenowa, helpery, walidacje).
- Poziom **integracja/API**: ~20–30% (ścieżki route → walidacja → DB/Supabase → odpowiedzi).
- Poziom **E2E/UI**: ~10–15% (pełne flow użytkownika w przeglądarce).

Na każdym poziomie upewniamy się, że krytyczne ścieżki biznesowe (encounters, kolekcja, detale Pokémonów, typy) są pokryte w sposób komplementarny – od logiki po pełne flow użytkownika.

- Jednostkowe: serwisy domenowe (EncounterService, CollectionService, PokemonService, TypeService), helpery (encounters/session, rate-limit, LRU, mapery), walidacje Zod.
- Integracyjne API: end-to-end warstwy route → walidacja → Supabase (lokalne/testowe) → odpowiedzi JSON, kody, nagłówki cache/ETag.
- E2E UI: przepływy użytkownika w przeglądarce (Playwright) z mockowanym/realnym Supabase (środowisko testowe).
- Kontraktowe: schematy DTO vs odpowiedzi API (z JSON Schema / zod-to-json-schema).
- Wydajnościowe: czas odpowiedzi API (p95), LCP/CLS kluczowych stron, degradacja zdrowia przy obciążeniu.
- Bezpieczeństwo: auth/unauth, RLS (brak dostępu do cudzych danych), rate limiting, odporność na manipulację payloadem.
- A11y: axe/pa11y + manualne WCAG 2.1 AA (focus, ARIA, kontrast, reduced motion).
- Odporność sieci: offline/online (OfflineBanner, komunikaty błędów), abort fetch, retry UX.

### 4. Scenariusze testowe (kluczowe)

- **Auth i nawigacja**: brak sesji → redirect z `/dashboard`/`/collection`; po zalogowaniu dostęp do stron prywatnych; wygasła sesja → redirect przy pobieraniu kolekcji/encounterów.
- **Wild encounter**: POST `/api/encounters/wild` z/bez seed; walidacja seed; rate limit 429; poprawne 201 body (3 pytania, 3 próby, stage=1, shiny zwracany maks. w ~1% encounterów przy spełnionym warunku posiadania wariantu normal); zapis sesji TTL 15 min.
- **Evolution encounter**: walidacja baseId/evolutionId; brak capture base → 403; relacja brak → 404; poprawny stage 2/3; rate limit.
- **Submit encounter**: min 2 poprawne = capture; 3 próby na ten sam zestaw pytań, `attemptsRemaining` zmniejsza się; session mismatch/expired → 404; różne selectedOption zakres 1-4; duplicate capture → already_captured; shiny wariant poprawnie zwracany; LRU zapis ID pytań po submit; rate limit 20/min.
- **Race conditions**: równoległe submit na jednym encounterId (ostatni powinien fail/404 po delete); retry gdy `attemptsRemaining`>0 bez utraty sesji.
- **Collection list**: filtry caught/all/uncaught, type, shiny, sort (pokedex/name/date), paginacja + infinite scroll; 401 bez sesji; 429 limit; poprawne `hasMore`, `total`.
- **Collection stats**: poprawne przeliczenia % z 151, variant/type breakdown, recent captures kolejność; 401/500 ścieżki.
- **Pokemon list/detail**: filtry type/search, limit/offset granice; detail 404 spoza 1-151; evolution_line poprawna kolejność/stage, `in_collection` zależne od userId; fallback sprite gdy brak front_default.
- **Types**: brak parametrów → 200 + ETag, If-None-Match → 304; błędne parametry → 400.
- **Health**: Supabase dostępny → status healthy/degraded (próg 800ms); symulacja timeout/abort → 503/500.
- **Offline/Network**: OfflineBanner widoczny; Encounter start/submit przy offline → komunikaty; abort fetch (collection) nie oznacza błędu.
- **A11y**: focus trap w modalach (EncounterModal, PokemonDetailModal), aria-live dla wyników, kontrasty w bannerach/toastach, obsługa klawiaturą.
- **Performance**: LCP <2.5s na landing/dashboard/collection (próbki lighthouse); API p95 <400ms lokalnie; sprawdzenie cache headers (types/pokemon list/detail).
- **Bezpieczeństwo**: payload fuzz (negatywne walidacje Zod); brak możliwości odczytu cudzych kolekcji (użycie innego user_id); nagłówki błędów nie ujawniają stacków.

### 5. Środowisko testowe

- Supabase projekt testowy z RLS i seedem Gen1 (pokemon, types, pokemon_evolutions, widoki `my_collection_vw`, `pokemon_catalog_vw`, `user_capture_stats`).
- Konfiguracja env (`SUPABASE_URL`, `SUPABASE_KEY`, testowe cookies).
- Build Astro `output: "static"` + lokalne API (Astro dev) lub podgląd `astro preview`.
- Dane testowe: min. 2 konta użytkowników, część Pokémonów złapana (normal/shiny), scenariusze baz/evolution różne stadia.
- Narzędzia do symulacji sieci (Playwright network conditions), clock mocking dla RNG deterministycznego w unit testach.

### 6. Narzędzia

- Testy jednostkowe/integracyjne: Vitest + @testing-library/react (dla hooków), msw do stubowania fetch.
- E2E: Playwright (scenariusze przeglądarkowe, network throttle/offline).
- Linter/a11y: eslint, axe/pa11y.
- Performance: Lighthouse/Chrome Profiler; k6/artillery dla API smoke/perf.
- Raporty: HTML/JUnit z Vitest/Playwright, k6 JSON, Lighthouse CI (opcjonalnie).

### 7. Harmonogram

- Tydzień 1: przygotowanie środowiska testowego (Supabase seed, dane), skeleton testów jednostkowych + kontraktowych, smoke API.
- Tydzień 2: pokrycie scenariuszy encounters + collection (unit/integration), start E2E krytycznych ścieżek.
- Tydzień 3: E2E pełne (collection filters, evolution flow, offline), a11y + performance runy, testy bezpieczeństwa/rate limit.
- Tydzień 4: regresja, stabilizacja flakiness, raport końcowy i kryteria akceptacji.

### 8. Kryteria akceptacji

- 100% krytycznych ścieżek API pokryte testami automatycznymi (encounters, collection, pokemon detail/list, types).
- E2E: brak blokujących/ krytycznych defektów w encounter flow, collection filters/pagination, auth redirect.
- P95 czasów API i LCP w budżecie uzgodnionym (np. p95 API <400ms lokal/stage; LCP <2.5s).
- A11y: brak blockerów WCAG 2.1 AA w krytycznych ekranach; axe bez błędów wysokiego priorytetu.
- Security: nieautoryzowany dostęp zwraca 401/403/404; rate limiting działa; brak wycieków danych między użytkownikami w testach RLS.

### 9. Role i odpowiedzialności

- QA Lead: koordynacja planu, przegląd raportów, zarządzanie ryzykiem.
- QA Automation: implementacja testów unit/integration/E2E, utrzymanie pipeline.
- Backend Dev: wsparcie w mockowaniu Supabase, poprawki serwisów/endpointów, RLS.
- Frontend Dev: naprawa defektów UI/a11y/perf, wsparcie w hookach/mappingach.
- DevOps: środowiska testowe, CI (Vitest/Playwright/Lighthouse), artefakty raportów.

### 10. Procedury raportowania błędów

- Zgłaszanie w systemie z: opis, kroki, oczekiwany vs rzeczywisty rezultat, środowisko, logi/har, zrzuty, trace requestów.
- Kategoryzacja: P0 (blokuje krytyczną ścieżkę), P1 (wysoki wpływ), P2 (średni), P3 (niski/UX).
- Codzienny przegląd defektów z przypisaniem do właścicieli, SLA napraw zależne od priorytetu.
- Raporty cykliczne: dzienny status smoke, tygodniowy postęp pokrycia i trendy wydajności/a11y.

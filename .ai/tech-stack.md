# Krok 5: Wybór i weryfikacja stacku technologicznego – PokéMath

## Kontekst i decyzja

Zespół utrzymuje architekturę opartą o Astro 5 z **`output: "server"` i adapterem Vercel**, korzystając z SSR i Astro Islands tam, gdzie to potrzebne (API, ochrona tras, integracja z Supabase). Jednocześnie aplikacja jest projektowana tak, aby maksymalnie wykorzystywać statyczne renderowanie i lekki JS po stronie klienta. Wybrane technologie pozwalają szybko dostarczyć funkcjonalny prototyp i realizować cele dydaktyczne (Astro, Tailwind, React, Supabase) przy zachowaniu prostego modelu deployu na Vercelu.

---

## Wybrany stack (z uzasadnieniem)

- **Warstwa frontendu**: Astro 5 (architektura islands, SSR via Vercel adapter), React 19, TypeScript 5, Tailwind CSS 4, shadcn/ui
  - Uzasadnienie: szybkie prototypowanie UI, niewielki narzut JS na ścieżce krytycznej, dojrzałe komponenty i wzorce dostępności; możliwość łączenia SSG i SSR.
- **Warstwa wykonawcza**: Astro `output: "server"` + `@astrojs/vercel` (serverless/edge API routes)
  - Uzasadnienie: prosty deploy na Vercelu, natywne wsparcie dla API (`src/pages/api/*`), middleware i SSR, przy zachowaniu dobrej wydajności.
- **Warstwa danych**: Supabase (Auth Google, Postgres, RLS)
  - Uzasadnienie: redukcja własnej warstwy backendowej, spójne bezpieczeństwo dzięki RLS, szybka implementacja logowania i trwałości danych; integracja SSR przez `@supabase/ssr` (cookies, brak manualnego zarządzania tokenami w localStorage).
- **Narzędzia deweloperskie**: Vite (zarządzany przez Astro), ESLint 9, Prettier
  - Uzasadnienie: standardowe, dobrze znane narzędzia z bogatym wsparciem ekosystemu.
- **Zasoby**: Sprite’y Gen 1 pochodzą z oficjalnych danych PokeAPI, ale są seedowane do bazy i/lub hostowane lokalnie (np. WebP w `public/`); brak zapytań do PokeAPI w runtime (ani po dane, ani po sprite’y).
  - Uzasadnienie: wykorzystanie oficjalnych zasobów PokeAPI na etapie seeda, brak zależności od zewnętrznego API w czasie działania aplikacji, możliwość pełnego self‑hostingu sprite’ów.

---

## Kryteria wyboru

- **Szybkość dostarczenia MVP**: Astro + islands oraz shadcn/ui przyspieszają implementację interfejsu; Supabase skraca czas wdrożenia warstwy danych i uwierzytelniania.
- **Znajomość technologii i cele edukacyjne**: projekt celowo wykorzystuje Astro i Tailwind; SSR przez Vercel adapter jest skonfigurowany od początku i wykorzystywany głównie do API, middleware i ochrony tras prywatnych.
- **Dostępność talentów i ekosystem**: React + Tailwind to powszechne kompetencje; Supabase ma dojrzałą dokumentację i aktywne community.
- **Zgodność z PRD i rozszerzalność**: architektura spełnia bieżące potrzeby i pozostawia możliwość rozbudowy (np. migracja adaptera, wprowadzenie edge funkcji).
- **Koszt utrzymania**: niski próg kosztowy na start (Supabase, brak serwera aplikacyjnego na MVP), brak zewnętrznych API kosztujących per żądanie.

---

## Rola AI i wynik weryfikacji zgodności z PRD

AI dokonuje oceny, czy stack w pełni wspiera wymagania funkcjonalne określone w PRD, oraz wskazuje luki do domknięcia:

- **Uwierzytelnianie i sesja (US‑001..003, 025)**: Supabase Auth (Google) spełnia wymagania; konieczna poprawna obsługa stanów sesji (w tym wygaśnięcia).
- **Dane i bezpieczeństwo (US‑020, 021)**: Postgres + RLS zapewniają izolację danych; unikalność `(user_id, pokemon_id, variant)` eliminuje duplikaty; brak PokeAPI w runtime spełniony.
- **Encounter i generator zadań (US‑004..009, 016)**: możliwe do implementacji w React (islands); wymagane: deterministyczny PRNG seedowany `user_id|pokemon_id|attempt` oraz LRU ~100.
- **Trwałość kolekcji i widoki (US‑011..015, 017, 019)**: zapis do `captured_pokemon`, filtry, liczniki, shiny; sprite URLs z PokeAPI z fallbackiem.
- **Wydajność i dostępność (US‑023, 024)**: islands + sprite URLs z PokeAPI CDN wspierają p75 LCP ≤ 2.5 s; lint a11y pomaga utrzymać standardy dostępności.
- **Analityka (US‑026)**: prosty licznik „captured per user” możliwy zapytaniem agregującym lub dedykowaną tabelą.

**Wniosek AI**: stack spełnia wymagania PRD. Otwarte punkty: integracja Supabase (klient, schemat i RLS), kompletny seed Gen 1 ze sprite URLs, implementacja generatora zadań (PRNG + LRU) oraz nagłówki bezpieczeństwa/CSP.

---

## Potencjalne ryzyka i ograniczenia (z mitigacją)

- **Złożoność SSR (zredukowana w MVP)**  
  Ryzyko: N/D w obecnym wariancie static.  
  Mitigacja: wprowadzić SSR/edge w kolejnych iteracjach wyłącznie, gdy pojawią się wymagania serwerowe (np. webhooki, anti‑cheat, agregacje offline).
- **Kompatybilność Tailwind 4, shadcn/ui i React 19**  
  Ryzyko: niespójności styli i reguł lint.  
  Mitigacja: stosować zalecane presety/tematy; testy komponentów bazowych; aktualne wersje zależności.
- **Polityki RLS, indeksy i constrainty**  
  Ryzyko: błędne reguły lub braki wydajnościowe.  
  Mitigacja: testy RLS, unikalność `(user_id, pokemon_id, variant)`, indeksy po `user_id` i polach filtrów; przegląd bezpieczeństwa.
- **Seed danych i sprite URLs z PokeAPI**  
  Ryzyko: niekompletność danych lub niedostępność zewnętrznego CDN.  
  Mitigacja: pełny seed Gen 1 ze sprite URLs, fallback placeholdery, wykorzystanie oficjalnych zasobów PokeAPI (publicznie dostępne).
- **Generator zadań (PRNG + LRU)**  
  Ryzyko: powtarzalność pytań lub błędna losowość.  
  Mitigacja: deterministyczny PRNG z odpowiednim seedem, LRU per użytkownik (~100), testy kolizyjności.
- **Nagłówki bezpieczeństwa i CSP**  
  Ryzyko: podatność na XSS/miękkie konfiguracje.  
  Mitigacja: dodać CSP, `Strict-Transport-Security`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` oraz audyt UI.

---

## Wariant SSR Node (odłożony)

- **`@astrojs/node` (SSR) + możliwość migracji do edge/serverless**  
  Zalety: funkcje serwerowe, webhooki, łatwiejsze agregacje po stronie backendu.  
  Status: odłożony – na potrzeby MVP stosujemy `output: "server"` z adapterem Vercel i Supabase SSR; wariant Node jest traktowany jako alternatywny adapter na przyszłość.

---

## Plan weryfikacji (checklista)

- Supabase: dodać `@supabase/supabase-js`, skonfigurować `.env`, przygotować schemat (tabele, indeksy, unikalność) i polityki RLS.
- Seed: uzupełnić dane Gen 1 ze sprite URLs z PokeAPI, dodać fallback placeholdery.
- Generator: zaimplementować PRNG seedowany `user_id|pokemon_id|attempt` i LRU ~100 z testami.
- UI/UX: dopracować stany loading/error; filtry kolekcji; oznaczenia shiny 1/100.
- Security: wdrożyć nagłówki bezpieczeństwa i CSP; audyt logów bez PII.
- Performance: utrzymać budżet LCP; lazy‑loading zasobów; brak zbędnych pakietów na ścieżce krytycznej.

---

## Konkluzja

Aktualny stack (Astro 5 z `output: "server"` + Vercel adapter, Supabase SSR, React 19, Tailwind 4, shadcn/ui) jest spójny z wymaganiami PRD i upraszcza realizację MVP dzięki gotowym API routes i middleware. Daje możliwość płynnej rozbudowy (edge functions, dodatkowe serwisy) w kolejnych iteracjach. Priorytety na najbliższy sprint: domknięcie integracji Supabase (RLS + typy), przygotowanie pełnego seeda Gen 1 oraz utrzymanie deterministycznego generatora zadań z LRU.

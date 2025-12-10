# Architektura UI dla PokéMath

## 1. Przegląd struktury UI

PokéMath to aplikacja webowa zbudowana w architekturze hybrydowej wykorzystującej Astro 5 (**server output via Vercel adapter**) dla layoutów/publicznych stron i React 19 (Astro islands) dla dynamicznych komponentów wymagających interakcji. Interfejs użytkownika został zaprojektowany z myślą o szybkim ładowaniu, responsywności (mobile-first) oraz prostocie obsługi. Główne założenia architektury:

### Zasady architektoniczne

1. **Separation of concerns**: Wyraźny podział na warstwy publiczne (bez autentykacji) i prywatne (wymagające JWT)
2. **Performance-first**: SSG dla statycznych zasobów, lazy loading sprite'ów, cache z TTL, minimalizacja CLS
3. **Mobile-first responsive**: Tailwind breakpoints (sm: 640px, md: 768px, lg: 1024px) z elastyczną siatką 3/4/6 kolumn
4. **Online-only**: Aplikacja zakłada stałe połączenie sieciowe; błędy i time‑outy komunikowane są standardowymi stanami błędu/toastami (bez osobnego trybu offline)
5. **Security by default**: RLS w Supabase, brak przechowywania wrażliwych danych w localStorage, obsługa wygasłych sesji

### Główne warstwy aplikacji

**Warstwa publiczna (SSG)**

- Landing page z CTA logowania
- Strony błędów (404, 500)

**Warstwa prywatna (SSR + client-side islands)**

- Dashboard (hub aplikacji)
- Wild Encounter Modal
- Collection View (infinite scroll z filtrami)
- Pokemon Detail View
- Profile View (post-MVP, zaplanowany widok profilu)

**Warstwa infrastruktury**

- Globalna nawigacja (top bar z ikonami Play/Collection/Profile)
- Interceptory HTTP (401/403 → logout + redirect)
- Error Boundary (globalne łapanie błędów React)
- Toast system (komunikaty sukcesu/błędów)

### Zarządzanie stanem

**React Query (TanStack Query v5)**

- Cache dla danych z API (`/api/pokemon`, `/api/types`, `/api/collection`, `/api/collection/stats`, opcjonalnie `/api/profile` w post‑MVP)
- Automatyczna refetch policy (stale-while-revalidate)
- Optymistyczne invalidation po sukcesie capture
- TTL 24h dla katalogu Pokémonów i typów (wersjonowanie `staticDataVersion`)

**Zustand**

- Stan sesji Encounter Modal (pytania, postęp, licznik prób, wylosowany Pokémon)
- Stan UI (drawer menu, toast queue)
- Nie persystowany (reset po odświeżeniu)

**Supabase Auth (SSR + klient)**

- Sesja użytkownika zarządzana przez `@supabase/ssr` i middleware Astro (`src/middleware/index.ts`), z wykorzystaniem cookies HttpOnly (brak manualnego przechowywania JWT w localStorage).
- Po stronie przeglądarki używamy `createBrowserClient` jedynie do inicjalizacji OAuth Google w `SignInButton.tsx` (redirect do `/api/auth/callback`).
- Middleware SSR odświeża sesję (`supabase.auth.getUser()`) i udostępnia `locals.supabase` w stronach i API; prywatne widoki (np. `/dashboard`, `/collection`) są chronione przez ten mechanizm.

---

## 2. Lista widoków

### 2.1 Landing / Sign-in (Publiczny)

**Ścieżka:** `/`  
**Layout:** `PublicLayout.astro`  
**Autentykacja:** Nie wymagana; przekierowanie do `/dashboard` jeśli sesja aktywna

**Główny cel:**

- Przedstawienie wartości produktu (gamifikowana nauka matematyki + kolekcjonowanie Pokémonów)
- Zachęcenie do logowania (single CTA: "Sign in with Google")

**Kluczowe informacje:**

- Tytuł i krótki opis produktu (1-2 zdania)
- Wizualizacja głównej mechaniki (sprite przykładowych Pokémonów)
- Przycisk logowania Google (prominent CTA)
- Komunikaty błędów logowania (jeśli występują)

**Kluczowe komponenty:**

- `SignInButton.tsx` (React island) – obsługa OAuth Google przez Supabase
- `ErrorAlert.tsx` – wyświetlanie błędów autentykacji
- Hero section z przykładową grafiką
- Footer z linkami (opcjonalnie: Privacy Policy, Terms)

**UX/A11y/Security:**

- CTA wyróżniony wizualnie (kontrast WCAG AA: 4.5:1 dla tekstu)
- Focus ring na przycisku dla użytkowników klawiatury
- Loading state podczas przekierowania OAuth
- Retry mechanism w przypadku błędu OAuth
- Bezpieczne przekierowanie tylko na whitelist URL (callback Supabase)

---

### 2.2 Dashboard (Prywatny)

**Ścieżka:** `/dashboard`  
**Layout:** `PrivateLayout.astro` (z top navigation bar)  
**Autentykacja:** Wymagana (JWT)

**Główny cel:**

- Hub centralny aplikacji – punkt wyjścia do wszystkich głównych funkcji
- Pokazanie postępu użytkownika (motywacja do dalszej gry)
- Szybki dostęp do rozpoczęcia encounter

**Kluczowe informacje:**

- Welcome message z imieniem użytkownika (z `profiles.display_name` lub Google name)
- Liczniki postępu: "X / 151 Pokémon caught" + "X Shiny"
- Recent captures (ostatnie 3-5 złapanych Pokémonów: sprite, nazwa, czas)
- CTA "Start Wild Encounter" (prominent button)

**Kluczowe komponenty:**

- `DashboardStats.tsx` (React island) – pobranie danych z `/api/collection/stats`
- `RecentCaptures.tsx` – lista ostatnich złapań (linki do detail view)
- `TypeProgressGrid.tsx` – siatka postępu wg typów (18 boxów: ikona, nazwa, X/Y)
- `StartEncounterButton.tsx` – otwiera Encounter Modal
- `EncounterModal.tsx` – modal pełnoekranowy (React island z Zustand)
- `TopNavBar.tsx` – nawigacja globalna (Play/Collection/Profile icons + avatar menu)

**UX/A11y/Security:**

- Skeleton loaders dla asynchronicznych danych (stats, recent captures)
- Error state z retry button jeśli `/api/collection/stats` zawiedzie
- Modal dostępny przez ESC (zamknięcie), Trap focus wewnątrz modala
- Przycisk "Start Encounter" pokazuje loading podczas wywołania; błędy sieciowe komunikowane przez toast/state błędu (brak dedykowanego trybu offline)
- RLS zapewnia izolację danych użytkownika

---

### 2.3 Encounter Modal (Prywatny, komponent Dashboard)

**Ścieżka:** N/A (modal na `/dashboard`, nie zmienia routing)  
**Komponent:** `EncounterModal.tsx` (React island zarządzany przez Zustand)  
**Autentykacja:** Wymagana (JWT)

**Główny cel:**

- Przeprowadzenie użytkownika przez sesję 3 pytań matematycznych
- Wyświetlenie wyniku (capture success/failure) z natychmiastowym feedbackiem
- Obsługa retry logic (do 3 prób) na tym samym zestawie pytań; po wyczerpaniu prób użytkownik ręcznie uruchamia nowy encounter

**Kluczowe informacje:**

- Wylosowany Pokémon (sprite normal/shiny, nazwa, stage indicator)
- Pytanie matematyczne (np. "12 + 7 = ?")
- 4 opcje odpowiedzi (przyciski 1, 2, 3, 4)
- Progress bar: krok aktualny (1/3, 2/3, 3/3)
- Licznik pozostałych prób (Attempts: 3/3, 2/3, 1/3)
- Po zakończeniu: ekran wyniku (score X/3, komunikat, CTA)

**Kluczowe komponenty:**

- `EncounterHeader.tsx` – sprite Pokémona, nazwa, shiny badge (jeśli shiny)
- `QuestionCard.tsx` – wyświetlanie pytania i 4 przycisków odpowiedzi
- `ProgressBar.tsx` – wizualizacja postępu (3 kroki)
- `ResultScreen.tsx` – wynik po 3 pytaniach (success/failure)
- `RetryButton.tsx` – CTA po porażce (jeśli `canRetry === true`)
- `NewEncounterButton.tsx` – CTA po sukcesie lub soft reroll

**UX/A11y/Security:**

- Modal pełnoekranowy (z-index wyższy niż navbar)
- Trap focus: Tab/Shift+Tab cyklicznie wewnątrz modala
- ESC zamyka modal (z potwierdzeniem jeśli encounter w trakcie)
- Animacje przejść między pytaniami (slide transition)
- Wyłączenie przycisku odpowiedzi po wyborze (prevent double-submit)
- Loading state podczas POST `/api/encounters/submit`
- Obsługa błędów API (toast + możliwość retry submissji)
- Wizualne rozróżnienie poprawnej/niepoprawnej odpowiedzi (opcjonalnie po submissji)
- Shiny badge: połyskujący efekt CSS lub ikona gwiazdki
- Anti-cheat: brak ekspozycji poprawnej odpowiedzi w DOM przed submissją
- Licznik prób resetuje się po odświeżeniu strony (nie persystowany)

---

### 2.4 My Collection (Prywatny)

**Ścieżka:** `/collection`  
**Layout:** `PrivateLayout.astro`  
**Autentykacja:** Wymagana (JWT)

**Główny cel:**

- Przeglądanie wszystkich Pokémonów Gen 1 (151) z wyróżnieniem złapanych
- Filtrowanie i sortowanie kolekcji
- Dostęp do szczegółów poszczególnych Pokémonów

**Kluczowe informacje:**

- Siatka Pokémonów (sprite, nazwa, numer Pokédex)
- Niezłapane: sylwetka placeholder (shadow/blur)
- Złapane: pełny sprite, shiny badge jeśli dotyczy
- Liczniki postępu: "X / 151 Caught" + "X Shiny"
- Filtry: Caught/Uncaught, Type (dropdown), Shiny Only (toggle)
- Sort: Pokédex Number (default), Name, Capture Date

**Kluczowe komponenty:**

- `CollectionGrid.tsx` (React island) – infinite scroll, lazy loading sprite'ów
- `PokemonCard.tsx` – pojedynczy kafelek (sprite, nazwa, link do detail)
- `CollectionFilters.tsx` – UI filtrów i sortowania (odzwierciedlone w URL query params)
- `ProgressCounters.tsx` – liczniki X/151 i Shiny X
- `ScrollToTopButton.tsx` – FAB w prawym dolnym rogu (pojawia się po scroll down)
- `InfiniteScrollSentinel.tsx` – Intersection Observer do ładowania kolejnych stron

**UX/A11y/Security:**

- Responsywna siatka: 3 kolumny (mobile), 4 (tablet), 6 (desktop)
- Infinite scroll z sentinelem (brak "Load More" button)
- Skeleton loaders dla nowo ładowanych kafelków
- Filtry w URL query params: `/collection?caught=true&type=10&shiny=true`
- Możliwość resetu filtrów (Clear Filters button)
- Lazy loading sprite'ów (`loading="lazy"`, `width/height` dla anti-CLS)
- Fallback placeholder jeśli sprite nie załaduje się (404)
- Focus management: po zmianie filtra focus wraca na pierwszy wynik
- Empty state: komunikat "No Pokémon match your filters" z CTA Clear Filters
- RLS zapewnia widoczność tylko własnych złapań
- Shiny badge: gwiazdka lub shimmer effect

---

### 2.5 Pokemon Detail Modal (Prywatny)

**Ścieżka:** `/pokemon/:id`  
**Layout:** `PrivateLayout.astro`  
**Autentykacja:** Wymagana (JWT) dla pełnych danych; publiczny endpoint `/api/pokemon/:id` dla info o Pokémonie

**Główny cel:**

- Prezentacja pełnych informacji o wybranym Pokémonie w modalu, takim samym pod względem rozmiatu modal jak encounter
- Dostęp do Challenge Evolution

**Kluczowe informacje:**

- Sprite
- Nazwa, numer Pokédex, typy (badges)
- Stats: height, weight, HP, Attack, Defense, Speed (wizualizacja bar chart)
- Flavor text (opis z PokeAPI seed)
- Capture info: data złapania, wariant(y) posiadane
- Jeśli zlapana wersja shiny - w górnej sekcji toggle do zmiany sprite
- Evolution chain: lista ewolucji z sprite'ami i moliwością kliknięcia zeby wywolac evolution encounter

**Kluczowe komponenten:**

- `PokemonDetailHeader.tsx` – sprite, nazwa, typy, shiny badge
- `StatsBars.tsx` – wizualizacja statystyk (progress bars)
- `EvolutionChain.tsx` – lista ewolucji z kafelkami (sprite wyszarzony jak niezlapane pokemony w collection, nazwa w formie ???)
- `ChallengeEvolutionButton.tsx` – otwiera Encounter Modal (POST `/api/encounters/evolution`)
- `CaptureStatus.tsx` – badge "Caught" + data, lub "Not caught yet"

**UX/A11y/Security:**

- Back button (Return to Collection)
- Skeleton loader dla danych asynchronicznych
- Jeśli Pokémon niezłapany: placeholder sprite (sylwetka) + zachęta "Catch this Pokémon!"
- Evolution gating: CTA "Challenge Evolution" disabled z tooltipem "Catch base form first" jeśli baza niezłapana
- Loading state podczas POST evolution encounter
- Error handling: jeśli `/api/pokemon/:id` zawiedzie, show error + retry
- Typy prezentowane jako kolorowe badges (color-coded per type)
- Anti-CLS: fixed dimensions dla sprite'ów
- RLS zapewnia sprawdzenie capture status przez `/api/collection`

---

### 2.6 Profile (Post-MVP, planowany widok prywatny)

**Ścieżka:** `/profile`  
**Layout:** `PrivateLayout.astro`  
**Autentykacja:** Wymagana (JWT) – **widok projektowany, niezaimplementowany w aktualnym MVP**

**Główny cel (post-MVP):**

- Wyświetlenie informacji o profilu użytkownika
- Edycja display name i avatar (MVP: tylko odczyt, edycja w późniejszej fazie)
- Dostęp do wylogowania

**Kluczowe informacje:**

- Avatar (z Google OAuth lub custom)
- Display name (z Google lub własne)
- Email (z Google OAuth, read-only)
- Stats: Total Captured, Shiny Count, Account Created Date
- Sign Out button

**Kluczowe komponenty (post-MVP):**

- `ProfileHeader.tsx` – avatar, display name, email
- `ProfileStats.tsx` – agregaty z `/api/collection/stats`
- `SignOutButton.tsx` – link/CTA wywołujący `GET /api/auth/signout` (SSR) + redirect do `/`
- `EditProfileButton.tsx` (odroczone w MVP) – modal z formularzem edycji

**UX/A11y/Security:**

- Skeleton loader dla stats
- Potwierdzenie przed Sign Out (modal "Are you sure?")
- Po Sign Out: czyszczenie cache (React Query clear) + redirect do Landing
- Error handling: jeśli `/api/profile` (post-MVP) zawiedzie, show error + retry
- Avatar fallback: inicjały użytkownika jeśli brak URL
- Focus trap w modal potwierdzenia Sign Out
- Bezpieczne wylogowanie: invalidacja sesji Supabase po stronie serwera (endpoint `/api/auth/signout`) + wyczyszczenie cache po stronie klienta

---

### 2.7 Error Pages (Publiczne/Prywatne)

#### 404 Not Found

**Ścieżka:** `/404`  
**Layout:** `PublicLayout.astro`  
**Autentykacja:** Nie wymagana

**Główny cel:** Informacja o nieistniejącej stronie + nawigacja powrotna

**Kluczowe informacje:**

- Komunikat "Page not found"
- Link do Dashboard (jeśli zalogowany) lub Landing (jeśli niezalogowany)
- Wizualizacja (opcjonalnie: sprite zagubionego Pokémona)

**Kluczowe komponenty:**

- `ErrorMessage.tsx` – komunikat z ilustracją
- `ReturnHomeButton.tsx` – CTA do głównej strony

#### 500 Internal Server Error

**Ścieżka:** `/500`  
**Layout:** `PublicLayout.astro`  
**Autentykacja:** Nie wymagana

**Główny cel:** Informacja o błędzie serwera + możliwość retry

**Kluczowe informacje:**

- Komunikat "Something went wrong"
- Przycisk Retry (reload strony)
- Link do Dashboard/Landing

**Kluczowe komponenty:**

- `ErrorMessage.tsx`
- `RetryButton.tsx` – reload `window.location.reload()`

**UX/A11y/Security:**

- Semantic HTML (role="alert" dla error message)
- Keyboard accessible buttons
- Brak ekspozycji szczegółów błędu (stack trace) w UI
- Logging błędów do konsoli/backendu (dla diagnostyki)

---

### 2.8 Global UI Components (Infrastruktura)

#### Top Navigation Bar (Prywatny layout)

**Komponent:** `TopNavBar.tsx` (React island w `PrivateLayout.astro`)

**Główny cel:** Nawigacja między głównymi widokami + dostęp do profilu/wylogowania

**Kluczowe informacje:**

- Logo aplikacji (link do Dashboard)
- Ikony nawigacyjne: Play (Dashboard), Collection, Profile
- Avatar użytkownika (dropdown menu: Profile, Sign Out)

**Kluczowe komponenty:**

- `NavIcon.tsx` – pojedyncza ikona z active state
- `AvatarDropdown.tsx` – menu z opcjami profilu

**UX/A11y/Security:**

- Sticky top bar (fixed position)
- Active state ikony (underline/bold dla aktualnej strony)
- Keyboard navigation: Tab przez ikony, Enter/Space otwiera dropdown
- Focus trap w otwartym dropdown menu
- Zamknięcie dropdown przez ESC lub klik poza
- Accessible labels (aria-label dla ikon)

#### Global Error Boundary

**Komponent:** `ErrorBoundary.tsx` (React class component owijający root app)

**Główny cel:** Łapanie nieobsłużonych błędów React + prezentacja fallback UI

**Kluczowe informacje:**

- Komunikat "An unexpected error occurred"
- Przycisk "Reload Page"
- Opcjonalnie: przycisk "Report Issue" (kopiuje error log)

**UX/A11y/Security:**

- Logowanie błędów do konsoli + zewnętrzny serwis (Sentry/LogRocket w przyszłości)
- Graceful degradation: fallback UI nie crash'uje całej strony
- Brak ekspozycji wrażliwych danych w error message

#### Toast System

**Komponent:** `ToastContainer.tsx` (React island na root level)

**Główny cel:** Wyświetlanie komunikatów sukcesu/błędów/info (non-blocking notifications)

**Kluczowe informacje:**

- Typ: success, error, warning, info
- Treść komunikatu (krótka, max 2 linie)
- Auto-dismiss po 5s (lub manual close)

**Kluczowe komponenty:**

- `Toast.tsx` – pojedynczy toast (ikona typu + tekst + close button)
- `ToastContainer.tsx` – stack toastów (top-right corner, mobile: top-center)

**UX/A11y/Security:**

- role="status" lub role="alert" w zależności od typu
- Auto-dismiss nie przerywa odczytu screen readera
- Manual close button (X) zawsze dostępny
- Stack limit: max 3 toasty jednocześnie (starsze auto-dismiss)
- Animacje wejścia/wyjścia (slide in/out)

---

## 3. Mapa podróży użytkownika

### 3.1 Główny flow: Pierwszy raz w aplikacji (Happy Path)

**Krok 1: Lądowanie**

- Użytkownik wchodzi na `/` (Landing Page)
- Widzi opis produktu i przycisk "Sign in with Google"

**Krok 2: Logowanie**

- Klik "Sign in with Google" → przekierowanie do OAuth Supabase
- Po autoryzacji Google: callback do aplikacji
- Supabase tworzy sesję (JWT w localStorage)
- Przekierowanie do `/dashboard`

**Krok 3: Dashboard (Hub)**

- Pierwszy widok: Dashboard z pustymi licznikami (0 / 151, 0 Shiny)
- Recent Captures puste (empty state: "No captures yet")
- CTA "Start Wild Encounter" (prominent button)

**Krok 4: Wild Encounter (Modal)**

- Klik "Start Wild Encounter" → POST `/api/encounters/wild`
- Modal otwiera się pełnoekranowo
- Wyświetlenie wylosowanego Pokémona (np. Bulbasaur, stage 1)
- Postęp 1/3, Attempts 3/3
- Pytanie 1: "12 + 7 = ?" → 4 przyciski odpowiedzi
- Użytkownik wybiera odpowiedź → klik → animacja przejścia do pytania 2
- Pytanie 2, następnie Pytanie 3
- Po 3 pytaniach: POST `/api/encounters/submit` z odpowiedziami

**Krok 5: Wynik Encounter**

- Backend zwraca score (np. 3/3 correct)
- Result Screen: "Success! You caught Bulbasaur!"
- Animacja capture (opcjonalnie: Poké Ball effect)
- CTA "View in Collection" lub "Start New Encounter"

**Krok 6: My Collection**

- Użytkownik klika "View in Collection" → redirect `/collection`
- Siatka 151 Pokémonów: 1 złapany (Bulbasaur sprite), reszta sylwetki
- Liczniki: 1 / 151, 0 Shiny
- Klik na Bulbasaur → redirect `/pokemon/1`

**Krok 7: Pokemon Detail**

- Widok detali Bulbasaura: sprite, typy (Grass/Poison), stats, flavor text
- Evolution chain: Ivysaur (lvl 16), Venusaur (lvl 32) – oba niezłapane
- CTA "Challenge Evolution" (enabled, bo baza złapana)
- Użytkownik może wrócić do Collection lub rozpocząć evolution challenge

**Krok 8: Evolution Challenge**

- Klik "Challenge Evolution" → POST `/api/encounters/evolution` (baseId=1, evolutionId=2)
- Modal encounter z Ivysaurem (stage 2, trudniejsze pytania: 0-50, mnożenie)
- Proces analogiczny do wild encounter
- Po sukcesie: Ivysaur w kolekcji

**Krok 9: Kontynuacja**

- Użytkownik wraca do Dashboard → kolejny wild encounter
- Cykl powtarza się: encounter → capture → collection → evolution

---

### 3.2 Alternatywne ścieżki (Edge Cases)

#### 3.2.1 Porażka w Encounter (Retry Flow)

**Krok 4A: Niepowodzenie pytań**

- Użytkownik odpowiada poprawnie tylko na 1/3 pytań
- Result Screen: "Failed! Try again!" (Attempts: 2/3 remaining)
- CTA "Try Again" → powrót do tego samego zestawu 3 pytań dla tego samego Pokémona
- Po 3 nieudanych próbach (Attempts: 0/3):
  - Result Screen: "No attempts left. Start a new encounter to keep playing."
  - CTA "New Encounter" zamyka modal; użytkownik może ponownie kliknąć "Start Wild Encounter" na Dashboardzie

#### 3.2.2 Duplikat Capture

**Krok 5A: Złapanie tego samego wariantu**

- Użytkownik łapie Pokémona, którego już ma (np. Bulbasaur normal)
- Backend zwraca `result: "already_captured"`, `newCapture: false`
- Result Screen: "You've already caught this Pokémon!" (uprzejmy komunikat)
- Kolekcja nie zmienia się (bez duplikatu)
- CTA "Start New Encounter"

#### 3.2.3 Wygaśnięcie sesji

**W dowolnym momencie:**

- Zapytanie API zwraca 401 Unauthorized
- HTTP interceptor łapie 401 → Supabase `signOut()` + clear cache
- Toast: "Your session has expired. Please sign in again."
- Redirect do `/` (Landing)
- Użytkownik musi zalogować się ponownie

#### 3.2.4 Offline Mode (usunięty)

- Tryb offline i baner zostały wycofane; aplikacja zakłada aktywne połączenie sieciowe i w przypadku problemów pokazuje standardowe stany błędu/toasty.

#### 3.2.5 Shiny Encounter (Rzadki wariant)

**Krok 4B: Wylosowanie shiny**

- POST `/api/encounters/wild` zwraca `isShiny: true` (1/100 szansa, tylko jeśli wariant normal danego Pokémona jest już w kolekcji)
- Modal pokazuje shiny sprite + shiny badge (gwiazdka + sparkle effect)
- Użytkownik przechodzi przez pytania normalnie
- Po sukcesie: Result Screen z dodatkowym komunikatem "Shiny caught! 🌟"
- Kolekcja: shiny wariant zapisany (osobny wpis od normal)
- Licznik Shiny X zwiększa się

---

### 3.3 Flow Wylogowania

**Z dowolnego widoku:**

1. Klik na Avatar (top right) → dropdown menu
2. Klik "Sign Out" → modal potwierdzenia "Are you sure?"
3. Confirm → Supabase `signOut()` + clear React Query cache
4. Redirect do `/` (Landing)
5. Toast: "You have been signed out successfully."

---

### 3.4 Flow Error Handling

#### API Error (500)

1. Użytkownik klika "Start Encounter"
2. POST `/api/encounters/wild` zwraca 500 Internal Server Error
3. Toast error: "Failed to start encounter. Please try again."
4. CTA "Retry" w toaście lub na UI
5. Użytkownik klika Retry → ponowne wywołanie POST

#### Network Error (No Response)

1. Request timeout (np. 30s)
2. Toast error: "Network error. Check your connection."
3. Użytkownik może ponowić żądanie po powrocie sieci (brak dedykowanego bannera offline)

#### Validation Error (400)

1. Backend zwraca 400 Bad Request (np. invalid `encounterId`)
2. Toast error: "Invalid request. Please refresh and try again."
3. Modal zamyka się automatycznie
4. Użytkownik musi zrestartować encounter

---

## 4. Układ i struktura nawigacji

### 4.1 Top Navigation Bar (Prywatne widoki)

**Struktura:**

```
[Logo/Brand]  [Play Icon]  [Collection Icon]  [Profile Icon]  [Avatar Dropdown]  [Offline Badge?]
```

**Elementy:**

1. **Logo/Brand** (left align)
   - Link do `/dashboard`
   - Tekst "PokéMath" lub graficzne logo

2. **Navigation Icons** (center)
   - **Play Icon**: Link do `/dashboard` (domyślnie aktywny)
   - **Collection Icon**: Link do `/collection`
   - **Profile Icon**: Link do `/profile`
   - Active state: bold + underline

3. **Avatar Dropdown** (right align)
   - Avatar użytkownika (okrągły, 40x40px)
   - Klik otwiera dropdown menu:
     - "Profile" → `/profile`
     - "Sign Out" → modal potwierdzenia

4. **Offline Badge** (conditional, right align przed avatar)
   - Pokazywany tylko jeśli `navigator.onLine === false`
   - Tekst "Offline" + ikona Wi-Fi slash

**Responsive (Mobile):**

- Top bar sticky (fixed position)
- Ikony nawigacyjne zmniejszone (32x32px)
- Avatar dropdown przesuwa się do prawej krawędzi
- Logo może być skrócone do inicjałów "PM"

---

### 4.2 Layout Publiczny vs Prywatny

#### PublicLayout.astro

- **Używany na:** Landing (`/`), 404, 500
- **Struktura:**
  - Minimalistyczny header (logo, opcjonalnie link "About")
  - Main content (centered, max-width 800px)
  - Footer (opcjonalnie: Privacy Policy, Terms, © 2024)
- **Brak:** Top Navigation Bar, Avatar, Protected content

#### PrivateLayout.astro

- **Używany na:** Dashboard, Collection, Pokemon Detail, Profile
- **Struktura:**
  - Top Navigation Bar (fixed)
  - Main content (full-width lub container, zależnie od widoku)
  - Padding top dla sticky navbar (60px)
  - Offline Banner (conditional, under navbar)
- **Ochrona:** Astro middleware sprawdza sesję JWT; jeśli brak → redirect do `/`

---

### 4.3 Nawigacja między widokami

**Dostępne ścieżki:**

- `/` → Landing (publiczny)
- `/dashboard` → Dashboard (prywatny, domyślny po logowaniu)
- `/collection` → My Collection (prywatny)
- `/pokemon/:id` → Pokemon Detail (prywatny)
- `/profile` → Profile (prywatny)
- `/404` → Not Found (publiczny)
- `/500` → Server Error (publiczny)

**Mechanizm nawigacji:**

- **Top Nav Bar**: główna nawigacja dla zalogowanych (Play, Collection, Profile)
- **CTA Buttons**: kontekstowe przyciski (Start Encounter, Challenge Evolution, View Collection)
- **Breadcrumbs**: na Pokemon Detail (`Collection > Pokémon Name`)
- **Back Button**: na Pokemon Detail (Return to Collection)
- **Links w Collection**: klik na kafelek Pokémona → detail view

**Redirects:**

- Jeśli niezalogowany próbuje otworzyć `/dashboard` → redirect do `/`
- Po logowaniu na Landing → redirect do `/dashboard`
- Po Sign Out → redirect do `/`
- 404 na nieistniejącej ścieżce → `/404`

---

## 5. Kluczowe komponenty

### 5.1 Komponenty wspólne (Shared)

#### Button.tsx (shadcn/ui)

- **Opis:** Podstawowy przycisk z wariantami (primary, secondary, ghost, danger)
- **Props:** `variant`, `size`, `disabled`, `loading`, `onClick`
- **Stany:** default, hover, active, disabled, loading (spinner)
- **Dostępność:** focus ring, keyboard navigation (Enter/Space)

#### Card.tsx (shadcn/ui)

- **Opis:** Kontener z cieniem i zaokrąglonymi rogami
- **Użycie:** PokemonCard, DashboardStats, ResultScreen
- **Props:** `padding`, `hover` (lift effect)

#### Skeleton.tsx (shadcn/ui)

- **Opis:** Placeholder dla ładujących się danych (animated pulse)
- **Użycie:** CollectionGrid, DashboardStats, Profile
- **Props:** `width`, `height`, `variant` (text, circle, rect)

#### Badge.tsx (shadcn/ui)

- **Opis:** Kolorowy badge dla typów, shiny, statusów
- **Użycie:** Type badges (Fire, Water), Shiny badge, Caught badge
- **Props:** `variant` (type-specific colors), `icon`

#### Modal.tsx

- **Opis:** Pełnoekranowy modal z overlay
- **Użycie:** EncounterModal, Sign Out Confirmation
- **Props:** `isOpen`, `onClose`, `children`, `closeOnEsc`, `closeOnOverlay`
- **Dostępność:** focus trap, ESC close, aria-modal, initial focus na pierwszy interactive element

#### Toast.tsx

- **Opis:** Notyfikacja non-blocking (success/error/warning/info)
- **Props:** `type`, `message`, `duration`, `onClose`
- **Stany:** enter animation (slide in), exit animation (slide out)
- **Dostępność:** role="status" (info/success) lub role="alert" (error/warning)

---

### 5.2 Komponenty autoryzacji

#### SignInButton.tsx

- **Opis:** Przycisk Google Sign In
- **API:** Utworzenie klienta poprzez `createBrowserClient` z `@supabase/ssr` i wywołanie `supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: '/api/auth/callback' } })`
- **Stany:** default, loading (spinner + "Signing in...")
- **Error Handling:** toast error jeśli OAuth fail, retry button

#### SignOutButton.tsx

- **Opis:** Przycisk wylogowania (w dropdown avatar menu)
- **API:** Nawigacja do endpointu `GET /api/auth/signout`, który czyści sesję Supabase po stronie serwera
- **Flow:** modal potwierdzenia → request do `/api/auth/signout` → clear cache (React Query) → redirect `/`
- **Stany:** default, loading (podczas signOut)

---

### 5.3 Komponenty Dashboard

#### DashboardStats.tsx

- **Opis:** Widżet z licznikami postępu (Total Captured, Shiny Count)
- **API:** GET `/api/collection/stats` (React Query)
- **Stany:** loading (skeleton), error (retry button), success (dane)
- **UI:** 2 karty obok siebie (desktop) lub stack (mobile)

#### RecentCaptures.tsx

- **Opis:** Lista ostatnich 3-5 złapanych Pokémonów
- **API:** Dane z `/api/collection/stats` → `recentCaptures`
- **UI:** Horizontal scroll (mobile) lub grid (desktop)
- **Elementy:** sprite, nazwa, czas (relative: "2 hours ago"), link do detail

#### StartEncounterButton.tsx

- **Opis:** CTA rozpoczęcia wild encounter
- **Action:** Otwiera EncounterModal (Zustand `setModalOpen(true)`) + POST `/api/encounters/wild`
- **Stany:** default, loading (spinner), disabled (offline)

#### TypeProgressGrid.tsx

- **Opis:** Siatka małych boxów prezentujących postęp złapań dla każdego typu Pokémona (18 elementów).
- **Dane/API:** GET `/api/collection/stats` → `typeBreakdown` (mapa `typeId → { caught, total }`).
- **UI (tile):**
  - Górą: mała ikonka typu (24–32px).
  - Niżej: nazwa typu (np. "Fire").
  - Niżej: licznik postępu w formacie `X / Y` (złapane/łącznie dla typu).
  - Tło boxa: powiększona ikonka typu jako background (opacity ~0.06–0.1), wycentrowana, `background-size: 140%`.
  - Styl: zaokrąglone rogi, subtelny border, hover lift (transform), focus ring dla dostępności.
- **Layout/Responsive:** Grid 3/4/6 kolumn (`grid-cols-3 md:grid-cols-4 lg:grid-cols-6`), jednakowa wysokość tile’i.
- **Assets:** Ikony typów z `public/types/*.png` (np. `public/types/fire_type.png`). Alt text zgodny z nazwą typu.
- **Stany:**
  - Loading: skeletony kwadratowe/rect (ikona + dwie linie tekstu).
  - Error: niewielki komunikat w miejscu siatki + przycisk Retry.
- **Interakcje (opcjonalnie):** Kliknięcie tile’a może nawigować do `/collection?type=<id>` filtrując kolekcję po typie.

---

### 5.4 Komponenty Encounter Modal

#### EncounterModal.tsx

- **Opis:** Pełnoekranowy modal zarządzający sesją encounter
- **Stan:** Zustand store (`encounterState`)
- **Subkomponenty:** EncounterHeader, QuestionCard, ProgressBar, ResultScreen
- **Flow:**
  1. Open → POST `/api/encounters/wild` → wyświetl pytanie 1
  2. Użytkownik odpowiada → zapisz odpowiedź lokalnie → następne pytanie
  3. Po 3 pytaniach → POST `/api/encounters/submit` → wynik
  4. ResultScreen → CTA (New Encounter / Retry / View Collection)

#### EncounterHeader.tsx

- **Opis:** Nagłówek z informacją o Pokémonie
- **Elementy:** sprite (normal/shiny), nazwa, shiny badge, stage indicator
- **UI:** Flexbox (sprite left, info right)

#### QuestionCard.tsx

- **Opis:** Karta z pytaniem matematycznym i 4 przyciskami odpowiedzi
- **Props:** `question` (string), `options` (array[4]), `onAnswer` (callback)
- **UI:** Pytanie na górze (large font), 2x2 grid przycisków (mobile: stack)
- **Stany:** default, selected (po kliknięciu: disable wszystkie, highlight wybrane)

#### ProgressBar.tsx

- **Opis:** Wizualizacja postępu 3 kroków
- **UI:** 3 kółka z linią między nimi; aktywny krok highlighted
- **Props:** `currentStep` (1-3)

#### ResultScreen.tsx

- **Opis:** Ekran wyniku po 3 pytaniach
- **Props:** `success` (bool), `score` (X/3), `pokemon` (dane), `canRetry` (bool), `attemptsRemaining`
- **UI:**
  - Success: "You caught [Name]!" + sprite + celebration animation
  - Failure: "Try again!" + licznik prób + CTA Retry (jeśli `canRetry`)
  - Duplicate: "Already caught!" + uprzejmy komunikat
- **CTAs:** New Encounter, Retry, View Collection

---

### 5.5 Komponenty Collection

#### CollectionGrid.tsx

- **Opis:** Siatka 151 Pokémonów z infinite scroll
- **API:** GET `/api/collection?limit=50&offset=X` (React Query infinite query)
- **UI:** Responsive grid (3/4/6 kolumn), lazy load sprite'ów
- **Stany:** loading (skeletony), error (retry), empty (komunikat + CTA)
- **Infinite Scroll:** Intersection Observer na sentinel (ostatni kafelek + 50px)

#### PokemonCard.tsx

- **Opis:** Pojedynczy kafelek Pokémona
- **Props:** `pokemon` (id, name, sprite, isCaught, variant)
- **UI:**
  - Złapany: pełny sprite, nazwa pod spodem, shiny badge (jeśli shiny)
  - Niezłapany: sylwetka (blur/shadow), nazwa "???" (opcjonalnie: numer Pokédex)
- **Interakcja:** klik → `/pokemon/:id`
- **Hover:** lift effect (transform scale 1.05)

#### CollectionFilters.tsx

- **Opis:** UI filtrów i sortowania
- **Props:** aktywne filtry z URL query params, `onFilterChange` callback
- **Elementy:**
  - Dropdown "Type" (lista 18 typów)
  - Toggle "Shiny Only"
  - Toggle "Caught / Uncaught"
  - Dropdown "Sort by" (Pokédex, Name, Date)
  - Button "Clear Filters"
- **UI:** Horizontal bar (desktop), collapsible drawer (mobile)
- **Interakcja:** zmiana filtra → update URL query params → refetch collection

#### ProgressCounters.tsx

- **Opis:** Liczniki postępu (X / 151, X Shiny)
- **API:** GET `/api/collection/stats`
- **UI:** 2 badges obok siebie (top collection view)
- **Stany:** loading (skeleton), success (dane)

#### ScrollToTopButton.tsx

- **Opis:** FAB (Floating Action Button) w prawym dolnym rogu
- **Akcja:** `window.scrollTo({ top: 0, behavior: 'smooth' })`
- **Widoczność:** conditional (pojawia się po scroll > 500px)
- **UI:** Okrągły przycisk z ikoną strzałki w górę, z-index ponad grid

---

### 5.6 Komponenty Pokemon Detail

#### PokemonDetailHeader.tsx

- **Opis:** Nagłówek z sprite, nazwą, typami
- **Props:** `pokemon` (pełne dane z `/api/pokemon/:id`)
- **UI:** Sprite (large), nazwa (h1), typy (badges), shiny badge (jeśli dotyczy)

#### StatsBars.tsx

- **Opis:** Wizualizacja statystyk (HP, Attack, Defense, Speed)
- **Props:** `stats` (object)
- **UI:** Lista progress bars (każda stat 0-255, skalowana do 100%)
- **Kolory:** per stat (HP: green, Attack: red, Defense: blue, Speed: yellow)

#### EvolutionChain.tsx

- **Opis:** Lista ewolucji z sprite'ami
- **Props:** `evolutions` (array)
- **UI:** Horizontal list (sprite, nazwa, level requirement)
- **Interakcja:** klik na ewolucję → `/pokemon/:evolutionId` (navigate)

#### ChallengeEvolutionButton.tsx

- **Opis:** CTA Challenge Evolution
- **Props:** `baseId`, `evolutionId`, `isBaseCaught` (bool)
- **Akcja:** POST `/api/encounters/evolution` → otwiera EncounterModal
- **Stany:**
  - Enabled: jeśli `isBaseCaught === true`
  - Disabled: jeśli baza niezłapana + tooltip "Catch base form first"
- **Loading:** spinner podczas POST

#### CaptureStatus.tsx

- **Opis:** Badge statusu złapania
- **Props:** `isCaught`, `capturedAt`, `variant`
- **UI:**
  - Caught: zielony badge "Caught" + data (relative: "Caught 2 days ago")
  - Uncaught: szary badge "Not caught yet"
  - Variant: osobne badge "Normal" lub "Shiny ✨"

---

### 5.7 Komponenty Profile

#### ProfileHeader.tsx

- **Opis:** Avatar, display name, email
- **Props:** `profile` (dane z `/api/profile`)
- **UI:** Avatar (large, 80x80px), display name (h1), email (muted)
- **Avatar fallback:** inicjały użytkownika jeśli brak URL

#### ProfileStats.tsx

- **Opis:** Agregaty capture stats
- **Props:** `stats` (total, shiny, typeBreakdown)
- **UI:** Lista kart (Total Captured, Shiny Count, Favorite Type)
- **Stany:** loading (skeleton), success

---

### 5.8 Komponenty infrastruktury

#### TopNavBar.tsx

- **Opis:** Globalna nawigacja dla widoków prywatnych
- **Elementy:** Logo, Play/Collection/Profile icons, Avatar dropdown, Offline badge
- **Stany:** active route (highlighted icon)
- **Responsive:** sticky top, zmniejszone ikony (mobile)

#### AvatarDropdown.tsx

- **Opis:** Menu rozwijane z awatara
- **Opcje:** Profile, Sign Out
- **Interakcja:** klik awatar → otwiera dropdown, klik poza → zamyka
- **Dostępność:** focus trap, ESC close

#### OfflineBanner.tsx

- **Opis:** Banner informujący o braku połączenia
- **Detekcja:** `navigator.onLine` + event listeners
- **UI:** Orange/yellow banner (top sticky, under navbar)
- **Tekst:** "You are offline. Some features are unavailable."
- **Auto-hide:** znika po `online` event

#### ErrorBoundary.tsx

- **Opis:** Globalne łapanie błędów React
- **Fallback UI:** Komunikat "Something went wrong" + przycisk Reload
- **Logging:** Konsola + zewnętrzny serwis (opcjonalnie Sentry)

#### ToastContainer.tsx

- **Opis:** Stack toastów (top-right desktop, top-center mobile)
- **Zarządzanie:** Zustand store (`toastQueue`)
- **Props:** max 3 toasty jednocześnie
- **Auto-dismiss:** 5s per toast

---

### 5.9 Hooks i utilities

#### useAuth()

- **Opis:** Hook do zarządzania stanem autentykacji
- **Return:** `{ user, isLoading, isAuthenticated, signIn, signOut }`
- **Implementacja:** Supabase `onAuthStateChange` listener

#### useNetworkStatus()

- **Opis:** Hook do detekcji stanu sieci
- **Return:** `{ isOnline, wasOffline }`
- **Implementacja:** `navigator.onLine` + event listeners (`online`/`offline`)

#### useEncounterModal()

- **Opis:** Hook do zarządzania stanem Encounter Modal (Zustand)
- **Return:** `{ isOpen, currentQuestion, answers, attemptsRemaining, openModal, closeModal, submitAnswer }`

#### useCollection()

- **Opis:** Hook do pobierania kolekcji (React Query)
- **Props:** filters, sort, pagination
- **Return:** `{ data, isLoading, error, refetch, fetchNextPage, hasNextPage }`

#### useToast()

- **Opis:** Hook do wyświetlania toastów (Zustand)
- **Return:** `{ showToast(type, message), dismissToast(id) }`

---

## 6. Mapowanie wymagań na UI

### 6.1 Mapowanie User Stories → Widoki/Komponenty

| User Story                          | Widok/Komponent                                                 | Realizacja                                                        |
| ----------------------------------- | --------------------------------------------------------------- | ----------------------------------------------------------------- |
| US-001: Logowanie Google            | Landing (`/`), `SignInButton.tsx`                               | Przycisk OAuth, redirect po sukcesie do Dashboard                 |
| US-002: Błąd logowania              | Landing, `ErrorAlert.tsx`                                       | Toast error, retry button                                         |
| US-003: Wylogowanie                 | `AvatarDropdown.tsx`, `SignOutButton.tsx`                       | Opcja Sign Out w menu, modal potwierdzenia                        |
| US-004: Wild encounter              | Dashboard, `StartEncounterButton.tsx`, `EncounterModal.tsx`     | POST `/api/encounters/wild`, modal z wylosowanym Pokémonem        |
| US-005: 3 pytania MCQ               | `EncounterModal.tsx`, `QuestionCard.tsx`                        | Cykl 3 pytań, 4 przyciski odpowiedzi, progress bar                |
| US-006: Warunek 2/3                 | `EncounterModal.tsx`, `ResultScreen.tsx`                        | POST `/api/encounters/submit`, score display                      |
| US-007: Try again, limit 3          | `ResultScreen.tsx`, `RetryButton.tsx`                           | Licznik prób, CTA Retry, po 3 porażkach zakończenie encounteru    |
| US-008: Stage zgodny ze stage       | Backend logic (nie UI)                                          | Pytania generowane przez API                                      |
| US-009: Dystraktory, losowa pozycja | Backend logic (nie UI)                                          | API zwraca shuffled options                                       |
| US-010: Deduplikacja pytań          | Backend logic (nie UI)                                          | LRU cache na backendzie                                           |
| US-011: Zapis do kolekcji           | Backend + Collection (`/collection`)                            | POST `/api/encounters/submit` → insert DB → refetch collection    |
| US-012: Blokada duplikatów          | Backend + `ResultScreen.tsx`                                    | Backend zwraca `already_captured`, UI pokazuje uprzejmy komunikat |
| US-013: Wyświetlanie kolekcji       | Collection (`/collection`), `CollectionGrid.tsx`                | Siatka 151 Pokémonów, sort Pokédex, sylwetki dla niezłapanych     |
| US-014: Filtry kolekcji             | `CollectionFilters.tsx`                                         | Caught/Uncaught, Type, Shiny, URL query params                    |
| US-015: Podgląd detalu              | Pokemon Detail (`/pokemon/:id`), `PokemonDetailHeader.tsx`      | Typy, data złapania, ewolucje                                     |
| US-016: Challenge Evolution         | `ChallengeEvolutionButton.tsx`, `EncounterModal.tsx`            | CTA gated na złapanie bazy, POST `/api/encounters/evolution`      |
| US-017: Wariant shiny               | `EncounterModal.tsx`, `PokemonCard.tsx`, `ProgressCounters.tsx` | Shiny badge, oddzielny licznik Shiny X                            |
| US-018: Stany ładowania/błędów      | Wszystkie widoki: `Skeleton.tsx`, `ErrorAlert.tsx`, `Toast.tsx` | Loading states, error messages, retry buttons                     |
| US-019: Trwałość po odświeżeniu     | Backend (RLS) + React Query cache                               | Dane kolekcji z `/api/collection`, cache TTL 24h                  |
| US-020: Ochrona danych RLS          | Backend (nie UI)                                                | RLS policies w Supabase, JWT verification                         |
| US-021: Brak PokeAPI w runtime      | Backend (nie UI)                                                | Sprite URLs z seeda, brak fetch do PokeAPI                        |
| US-022: Fallback sprite'ów          | `PokemonCard.tsx`, `EncounterHeader.tsx`                        | Placeholder `onError` event, fallback img                         |
| US-023: Responsywność mobilna       | Wszystkie widoki: Tailwind breakpoints                          | Grid 3/4/6 kolumn, touch-friendly buttons                         |
| US-024: Wydajność LCP               | Landing, Dashboard                                              | Lazy load sprite'ów, minimalizacja JS, anti-CLS                   |
| US-025: Wygasła sesja               | HTTP interceptor, `OfflineBanner.tsx`, Toast                    | 401 → signOut + redirect + toast                                  |
| US-026: Minimalna analityka         | Backend (nie UI MVP)                                            | Licznik captures w DB, możliwy dashboard admin (future)           |

---

### 6.2 Mapowanie kluczowych funkcji → UI/UX rozwiązania

| Funkcja                     | Problem użytkownika                                 | Rozwiązanie UI/UX                                                                                           |
| --------------------------- | --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| **Gamifikacja**             | Nudne ćwiczenia matematyczne                        | Mechanika kolekcjonowania Pokémonów, wizualne nagrody (sprite'y), shiny variants (rzadkość)                 |
| **Natychmiastowa feedback** | Brak informacji zwrotnej w tradycyjnych ćwiczeniach | Instant result screen po każdym encounterze, animacje capture/fail, toast notifications                     |
| **Prosta pętla gry**        | Skomplikowane interfejsy edukacyjne                 | Jeden główny CTA "Start Encounter", modal encounter (focus na zadaniu), minimalistyczny Dashboard           |
| **Progresja widoczna**      | Brak poczucia postępu                               | Liczniki X/151 i Shiny X, progress bars w encounterze, recent captures widget                               |
| **Dostępność mobilna**      | Konieczność działania na telefonie                  | Mobile-first design, touch-friendly buttons (min 44x44px), responsive grid, top navbar zamiast bottom bar   |
| **Retry bez frustracji**    | Trudność pytań może zniechęcić                      | Try Again button (do 3 prób na ten sam zestaw pytań), uprzejme komunikaty (nie "FAIL", a "Try again!")      |
| **Kolekcja jako motywacja** | Brak długoterminowego celu                          | Collection view z sylwetkami (pokazuje co jeszcze można złapać), filtry, detail views, evolution chains     |
| **Shiny hunting**           | Dodatkowa motywacja dla zaawansowanych              | 1/100 szansa na shiny, oddzielny wariant w kolekcji, wizualne wyróżnienie (badge, sparkle effect)           |
| **Bezpieczeństwo danych**   | Obawy o prywatność                                  | RLS w Supabase (izolacja per user), brak ekspozycji cudzych danych, uprzejme komunikaty o wygaśnięciu sesji |

---

### 6.3 Mapowanie Session Notes → Implementacja UI

| Decyzja z Session Notes                           | Implementacja w UI                                                                                         |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| **Oddzielne layouty public/private**              | `PublicLayout.astro` (Landing, 404, 500) vs `PrivateLayout.astro` (Dashboard, Collection, Detail, Profile) |
| **Dashboard jako hub**                            | `/dashboard` z widżetami (stats, recent captures), główny CTA "Start Encounter"                            |
| **Top navbar (nie bottom bar)**                   | `TopNavBar.tsx` sticky top z ikonami Play/Collection/Profile + avatar dropdown                             |
| **Interceptor 401/403**                           | HTTP client w React Query (axios/fetch wrapper) z globalnym interceptorem → signOut + redirect             |
| **SSG dla publicznych, client-side dla kolekcji** | Astro SSG dla Landing/404/500; React Query dla `/api/collection` (client-side fetch)                       |
| **Breakpointy sm/md/lg, grid 3/4/6**              | Tailwind classes: `grid-cols-3 md:grid-cols-4 lg:grid-cols-6`                                              |
| **React Query + Zustand**                         | React Query dla API cache, Zustand dla Encounter Modal state i UI state (toasty)                           |
| **Mapa błędów + toasty**                          | Centralna mapa `errorCodes` w `i18n/en.json`, `useToast()` hook, `ToastContainer.tsx`                      |
| **Cache TTL 24h dla katalogu**                    | React Query `staleTime: 24h`, `cacheTime: 24h`, wersjonowanie `staticDataVersion` w query key              |
| **Encounter jako modal**                          | `EncounterModal.tsx` pełnoekranowy na Dashboard, brak zmiany route (nie `/play`)                           |
| **Progress bar + licznik prób**                   | `ProgressBar.tsx` (3 kroki), licznik "Attempts: X/3" w header modala                                       |
| **Brak wirtualizacji w MVP**                      | `CollectionGrid.tsx` z infinite scroll (Intersection Observer), brak windowing (react-window)              |
| **Brak dark mode w MVP**                          | Przygotowanie CSS variables (np. `--color-bg`, `--color-text`), hardcoded light mode w MVP                 |
| **i18n z resource files**                         | `i18next` z plikami `en.json`, hook `useTranslation()`, UI w EN (MVP single language)                      |
| **Skeleton loaders**                              | `Skeleton.tsx` (shadcn/ui) dla loading states (collection, stats, profile)                                 |
| **Wersjonowanie cache katalogu**                  | Query key: `['pokemon', staticDataVersion]`, bump version przy seedzie nowych danych                       |
| **GlobalErrorBoundary + 404/500**                 | `ErrorBoundary.tsx` w root app, Astro catch-all route dla 404, custom 500 page                             |
| **Sign out pod awatarem**                         | `AvatarDropdown.tsx` z opcją "Sign Out" + modal potwierdzenia                                              |
| **Anti-CLS dla sprite'ów**                        | `<img width={96} height={96} loading="lazy" />`, placeholder blur (base64 tiny image)                      |
| **Filtry w URL query params**                     | `/collection?caught=true&type=10&shiny=true`, React Query keys depend on params                            |
| **Reset licznika prób po refresh**                | Zustand store nie persystowany, brak endpoint `encounters/status` (decyzja MVP)                            |
| **Brak optymistycznego capture**                  | UI czeka na response POST `/api/encounters/submit` przed refetch collection                                |
| **Infinite scroll + scroll-to-top**               | `InfiniteScrollSentinel.tsx` + `ScrollToTopButton.tsx` (FAB)                                               |
| **CSS custom properties pod dark mode**           | `:root { --color-bg: white; --color-text: black; }`, future `.dark` class swap values                      |

---

## 7. Względy UX, Dostępności i Bezpieczeństwa

### 7.1 User Experience (UX)

#### Priorytet: Prostota i natychmiastowa feedback

- **Single CTA per view**: Główny przycisk (np. "Start Encounter") wyróżniony wizualnie, pozostałe akcje secondary
- **Instant feedback**: Animacje transition między pytaniami, animacje capture/fail, toast notifications
- **Uprzejme komunikaty**: Zamiast "FAIL" → "Try again!", zamiast "ERROR" → "Something went wrong. Please try again."
- **Progress visibility**: Progress bar (1/3, 2/3, 3/3), liczniki (X/151), recent captures widget

#### Loading States

- **Skeleton loaders** dla asynchronicznych danych (zamiast spinnerów)
- **Optimistic UI** (odroczone w MVP): Przygotowanie pod optimistic updates (np. przy capture pokazać "Catching..." z sprite'em przed response)
- **Inline loading**: Spinner w przycisku podczas POST (np. "Starting encounter...")

#### Error Handling (UX perspective)

- **Retry-friendly**: Każdy error state ma przycisk Retry lub Clear Error
- **Contextual errors**: Error toast wskazuje co poszło nie tak i co zrobić (np. "Network error. Check connection and try again.")
- **Graceful degradation**: Jeśli stats nie załadują się, Dashboard wciąż pokazuje CTA "Start Encounter"

#### Empty States

- **First-time user**: Dashboard z pustymi licznikami → "Start your adventure!" CTA
- **Empty collection**: "No Pokémon yet. Start catching!" + CTA
- **No results (filtry)**: "No Pokémon match your filters" + "Clear Filters" button

---

### 7.2 Bezpieczeństwo (Security)

#### Autentykacja i Autoryzacja

- **JWT w localStorage**: Zarządzane przez Supabase SDK (auto-refresh, secure storage)
- **RLS enforcement**: Wszystkie zapytania do `/api/collection`, `/api/profile` wymagają JWT + RLS policy w DB
- **Session expiry**: Interceptor 401 → signOut + clear cache + redirect (uprzejmy komunikat)
- **No token exposure**: JWT nigdy nie wyświetlany w UI, nie logowany w konsoli (production)

#### Data Privacy

- **User isolation**: RLS zapewnia `user_id = auth.uid()` dla `captured_pokemon`
- **No PII exposure**: UI nie pokazuje emaili innych użytkowników, user_id ukryty
- **No sensitive data in URL**: Query params tylko dla filtrów (type, caught, shiny), nie user_id

#### Input Validation

- **Client-side**: Podstawowa walidacja (np. disable submit jeśli brak odpowiedzi)
- **Server-side**: API wykonuje pełną walidację (zob. API Plan)
- **No XSS**: React escape'uje dane automatycznie, shadcn/ui komponenty bezpieczne

#### Network Security

- **HTTPS only**: Wszystkie zapytania przez HTTPS (Supabase wymaga)
- **CORS**: Supabase dashboard whitelist origin aplikacji
- **CSP Headers**: Content-Security-Policy w Astro config (inline scripts z nonce, whitelist Supabase/CDN)

#### Anti-Cheat (Mild)

- **Correct answer hidden**: Poprawna odpowiedź nie ekspozowana w DOM przed submissją (tylko backend zna)
- **Server-side scoring**: POST `/api/encounters/submit` weryfikuje odpowiedzi na backendzie
- **Rate limiting**: API ma rate limits (10 encounters/min per user)

**Post-MVP (zaplanowane):**

- CAPTCHA dla logowania (jeśli spam/boty)
- Audit logs dla operacji CRUD (admin panel)
- Penetration testing

---

## 8. Otwarte kwestie i ograniczenia MVP

### 8.1 Znane ograniczenia MVP

1. **Licznik prób nie persystowany**: Po odświeżeniu strony w trakcie encounteru użytkownik traci postęp (licznik prób resetuje się). Decyzja: akceptowalne w MVP, można dodać endpoint `/api/encounters/:id/status` później.

2. **Brak prefetchu encounteru**: Kolejny encounter nie jest prefetchowany podczas aktualnego. Może wpłynąć na TTI (Time To Interactive) kolejnej rundy. Decyzja: optymalizacja post-MVP.

3. **Brak wirtualizacji grida kolekcji**: Lista 151 Pokémonów renderowana w DOM (z lazy loading sprite'ów). Na słabszych urządzeniach może być lag przy scrollu. Decyzja: infinite scroll z Intersection Observer wystarczy w MVP, wirtualizacja (react-window) w przyszłości.

4. **A11y minimalne**: Pełne testy WCAG AA i wsparcie screen readerów odroczone. MVP zawiera tylko podstawy (semantic HTML, focus rings, ARIA minimum). Decyzja: priorytet na funkcjonalność, a11y audit po stabilizacji.

5. **Brak dark mode**: UI tylko light mode, chociaż CSS variables przygotowane pod przyszłą implementację. Decyzja: dark mode nie jest wymaganiem MVP.

6. **Analityka wstrzymana**: Brak event trackingu (np. PostHog, Supabase events) w MVP. Decyzja: backend już liczy captures per user, frontend event tracking post-MVP.

7. **Brak optimistic UI dla capture**: UI czeka na response POST `/api/encounters/submit` przed aktualizacją kolekcji. Może wydawać się wolno przy słabym połączeniu. Decyzja: akceptowalne w MVP, optimistic updates wymagają rollback logic (złożoność).

---

### 8.2 Ryzyka UX

| Ryzyko                                | Opis                                                                        | Mitigation                                                                                                 |
| ------------------------------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| **Slow sprite loading**               | Sprite'y z PokeAPI CDN (GitHub) mogą ładować się wolno na słabym połączeniu | Lazy loading, placeholder blur, fallback placeholder, przyszłość: self-host sprite'y lub WebP optimization |
| **Encounter modal abandon**           | Użytkownik może zamknąć modal w trakcie encounteru (utrata postępu)         | Confirmation modal przy zamykaniu w trakcie ("Are you sure? Progress will be lost")                        |
| **Filtry w URL mogą być długie**      | `/collection?caught=true&type=10&shiny=true&sort=name&order=desc`           | Dopuszczalne, short URLs nie są wymaganiem; w przyszłości: saved filters                                   |
| **Infinite scroll bez "back to top"** | Użytkownik musi scroll ręcznie na górę po długim scrollu                    | `ScrollToTopButton.tsx` FAB (decyzja już uwzględniona)                                                     |
| **Duplikat capture może frustrować**  | Użytkownik odpowiada poprawnie, ale dostaje "Already caught"                | Uprzejmy komunikat + suggestion "Try catching shiny variant!" lub "Catch a different Pokémon!"             |

---

### 8.3 Przyszłe usprawnienia (Post-MVP)

#### UX Enhancements

- **Prefetch następnego encounteru**: POST `/api/encounters/wild` w tle po sukcesie poprzedniego
- **Optimistic capture**: Pokazać "Catching..." z animacją przed response API
- **Saved filters**: "Save this filter set" → localStorage lub backend
- **Battle mode**: PvP math challenges (rozbudowane)

#### A11y Enhancements

- **Full WCAG 2.1 AA audit** + fixes
- **Screen reader testing**: NVDA, JAWS, VoiceOver
- **High contrast mode**: Dedykowane style dla Windows High Contrast
- **Keyboard shortcuts cheat sheet**: Modal z listą shortcuts

#### Performance

- **Self-host sprite'y**: Kopiowanie sprite'ów PNG/WebP do `/public/sprites/`
- **WebP conversion**: Konwersja PNG → WebP dla mniejszych rozmiarów
- **Service Worker**: Cache sprite'ów offline (PWA)
- **Wirtualizacja grida**: react-window dla kolekcji (jeśli potrzebne)

#### Features

- **Dark mode**: Toggle w Profile, persystowany w localStorage
- **Analityka**: Event tracking (encounter start, capture success, filter usage) → PostHog/Supabase
- **Leaderboards**: Ranking użytkowników (most captures, fastest to 151, most shinies)
- **Trading**: Wymiana Pokémonów między użytkownikami
- **Profile edycja**: Zmiana display name, avatar upload

---

## 9. Podsumowanie

Architektura UI dla PokéMath została zaprojektowana z naciskiem na:

1. **Szybkość i responsywność**: Astro SSG dla publicznych stron, React islands dla interaktywności, lazy loading, anti-CLS, cache TTL 24h
2. **Prostota obsługi**: Minimalistyczny UI, jeden główny CTA per widok, natychmiastowa feedback, uprzejme komunikaty błędów
3. **Progresję i gamifikację**: Liczniki postępu, kolekcja z filtrami, shiny variants, evolution challenges, recent captures widget
4. **Bezpieczeństwo**: RLS w Supabase, JWT autentykacja, obsługa wygasłej sesji, brak ekspozycji danych innych użytkowników
5. **Offline-awareness**: Detekcja utraty połączenia, offline banner, disabled state akcji wymagających API, auto-sync po reconnect
6. **Skalowalność**: Przygotowanie pod dark mode (CSS variables), i18n (resource files), future features (PWA, analytics, a11y)

Wszystkie 26 User Stories z PRD są pokryte przez widoki i komponenty opisane w tym dokumencie. Kluczowe decyzje z Session Notes zostały zaimplementowane (top navbar, modal encounter, infinite scroll, React Query + Zustand, filtry w URL). Otwarte kwestie (brak persystencji prób, brak wirtualizacji, a11y minimalne) są świadomymi decyzjami MVP i zaplanowane do rozbudowy post-MVP.

**Główne widoki:**

- Landing (public)
- Dashboard (hub, private)
- Encounter Modal (react island na Dashboard)
- My Collection (infinite scroll, filtry)
- Pokemon Detail (evolutions, capture status)
- Profile (stats, sign out)
- 404/500 error pages

**Kluczowe komponenty:**

- Nawigacja: `TopNavBar.tsx`, `AvatarDropdown.tsx`
- Encounter: `EncounterModal.tsx`, `QuestionCard.tsx`, `ProgressBar.tsx`, `ResultScreen.tsx`
- Collection: `CollectionGrid.tsx`, `PokemonCard.tsx`, `CollectionFilters.tsx`
- Infrastruktura: `ErrorBoundary.tsx`, `ToastContainer.tsx`, `OfflineBanner.tsx`
- Auth: `SignInButton.tsx`, `SignOutButton.tsx`

Architektura jest gotowa do implementacji zgodnie z tech stackiem (Astro 5, React 19, TypeScript 5, Tailwind 4, shadcn/ui, Supabase). 🚀

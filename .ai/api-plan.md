# Plan REST API – PokéMath

## Przegląd

To REST API obsługuje pokemonową aplikację do treningu matematyki zbudowaną w oparciu o Astro 5 (server output przez adapter Vercel), React 19 i Supabase. API odpowiada za losowe spotkania (`encounters`), generowanie zadań matematycznych, mechanikę łapania oraz zarządzanie kolekcją, przy wymuszeniu `Row-Level Security (RLS)` na poziomie bazy danych.

**Kluczowe założenia:**

- RESTful design z jasnymi, zorientowanymi na zasoby endpointami
- Uwierzytelnianie przez Supabase Auth z użyciem `@supabase/ssr` (SSR + client) oraz sesjami przechowywanymi w bezpiecznych ciasteczkach
- Egzekwowanie RLS w warstwie bazy dla izolacji danych pomiędzy użytkownikami
- Endpointy Astro serverless (`src/pages/api/*`) uruchamiane na Vercel z middleware SSR
- Brak wywołań w runtime do zewnętrznego PokeAPI (ani po dane, ani po sprite’y)

### Zakres API

- Obsługiwane endpointy: GET `/api/pokemon`, GET `/api/pokemon/:id`, GET `/api/types`, GET `/api/health`, GET `/api/collection`, GET `/api/collection/stats`, POST `/api/encounters/wild`, POST `/api/encounters/evolution`, POST `/api/encounters/submit`, GET `/api/auth/callback`, GET `/api/auth/signout`. Nie ma endpointów profilu ani usuwania wpisów kolekcji.
- Limity RPS: collection list 30/min; wild encounters 10/min; evolution encounters 10/min; encounter submissions 20/min; pozostałe żądania bez limitu.
- Generator pytań: operatory `+`, `-`, `*`; zakresy: stage 1 dod./odej. 5–99, mul 2–12; stage 2 dod./odej. 10–120, mul 3–12; stage 3 dod./odej. 25–200, mul 7–12 (rozkład stage 3: 50% `*`, 25% `+`, 25% `-`). Dystraktory to losowe wartości ±12 od poprawnej (unikalne). Każdy encounter ma 3 pytania i 3 próby.
- Losowanie: opcjonalne `seed`; domyślnie `${userId}|${Date.now()}` (wynik niedeterministyczny per user/pokemon/attempt). Brak deduplikacji podczas generacji; in-memory LRU (50 ID) aktualizuje się po submit.
- Shiny: szansa 1%, ale shiny jest możliwy tylko, gdy użytkownik ma już wariant `normal` danego Pokémona. Wild stage zawsze 1; evolution stage wyznaczany z głębokości łańcucha (2 lub 3).
- Retry/capture: porażka zachowuje te same pytania; po 3 nieudanych próbach sesja jest kasowana, bez automatycznego rerollu.
- Kolekcja: używa `my_collection_vw` dla złapanych i `pokemon_catalog_vw` dla placeholderów; statystyki oparte o `user_capture_stats` + manualną agregację typów; `recentCaptures` maks. 5 wpisów.

---

## 1. Zasoby

| Zasób      | Tabela(e) w bazie                                | Opis                                                                      |
| ---------- | ------------------------------------------------ | ------------------------------------------------------------------------- |
| Pokemon    | `pokemon`, `pokemon_types`, `pokemon_evolutions` | Katalog Pokémonów z 1. generacji ze statystykami, sprite’ami i ewolucjami |
| Types      | `types`                                          | Definicje 18 typów Pokémon                                                |
| Encounters | N/A (efemeryczne)                                | Sesje losowych lub ewolucyjnych spotkań z wygenerowanymi pytaniami        |
| Collection | `captured_pokemon`, `my_collection_vw`           | Kolekcja złapanych Pokémon użytkownika z wariantami                       |
| Profile    | `profiles`                                       | Dane profilu użytkownika powiązane z `auth.users`                         |
| Stats      | `user_capture_stats` (materialized view)         | Zbiorcze statystyki łapania per użytkownik                                |

---

## 2. Endpointy

### 2.1 Katalog Pokémonów

#### GET /api/pokemon

Pobiera stronicowaną listę wszystkich Pokémonów 1. generacji z opcjonalnym filtrowaniem.

**Parametry zapytania:**

- `type` (opcjonalny, integer): filtr po ID typu
- `search` (opcjonalny, string): pełnotekstowe wyszukiwanie po nazwie Pokémona
- `limit` (opcjonalny, integer, domyślnie: 50, max: 151): liczba wyników
- `offset` (opcjonalny, integer, domyślnie: 0): offset paginacji

**Odpowiedź 200 OK:**

```json
{
  "data": [
    {
      "id": 1,
      "name": "bulbasaur",
      "stats": {
        "height": 7,
        "weight": 69,
        "hp": 45,
        "attack": 49,
        "defense": 49,
        "speed": 45
      },
      "sprites": {
        "front_default": "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/1.png",
        "front_shiny": "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/shiny/1.png"
      },
      "flavor_text": "A strange seed was planted on its back at birth. The plant sprouts and grows with this POKéMON.",
      "types": [
        { "id": 12, "name": "grass", "slot": 1 },
        { "id": 4, "name": "poison", "slot": 2 }
      ],
      "region": "kanto"
    }
  ],
  "pagination": {
    "total": 151,
    "limit": 50,
    "offset": 0,
    "hasMore": true
  }
}
```

**Błędy:**

- `400 Bad Request`: nieprawidłowe parametry zapytania
- `500 Internal Server Error`: błąd zapytania do bazy danych

---

#### GET /api/pokemon/:id

Pobiera szczegółowe informacje o konkretnym Pokémonie, w tym łańcuch ewolucji.

**Parametry w URL:**

- `id` (integer, wymagany): ID Pokémona (1–151)

**Odpowiedź 200 OK:**

```json
{
  "id": 1,
  "name": "bulbasaur",
  "stats": {
    "height": 7,
    "weight": 69,
    "hp": 45,
    "attack": 49,
    "defense": 49,
    "speed": 45
  },
  "sprites": {
    "front_default": "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/1.png",
    "front_shiny": "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/shiny/1.png"
  },
  "flavor_text": "A strange seed was planted on its back at birth. The plant sprouts and grows with this POKéMON.",
  "types": [
    { "id": 12, "name": "grass", "slot": 1 },
    { "id": 4, "name": "poison", "slot": 2 }
  ],
  "evolutions": [
    {
      "id": 2,
      "name": "ivysaur",
      "sprite": "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/2.png",
      "trigger": {
        "min_level": 16
      }
    },
    {
      "id": 3,
      "name": "venusaur",
      "sprite": "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/3.png",
      "trigger": {
        "min_level": 32
      }
    }
  ],
  "region": "kanto",
  "created_at": "2024-11-30T12:00:00Z"
}
```

**Błędy:**

- `404 Not Found`: podane ID Pokémona nie istnieje
- `400 Bad Request`: nieprawidłowy format ID
- `500 Internal Server Error`: błąd zapytania do bazy danych

---

#### GET /api/types

Pobiera listę wszystkich typów Pokémonów.

**Odpowiedź 200 OK:**

```json
{
  "data": [
    { "id": 1, "name": "normal" },
    { "id": 2, "name": "fighting" },
    { "id": 10, "name": "fire" },
    { "id": 11, "name": "water" },
    { "id": 12, "name": "grass" }
  ]
}
```

**Błędy:**

- `500 Internal Server Error`: błąd zapytania do bazy danych

---

### 2.2 Encounters

#### POST /api/encounters/wild

Generuje nowe losowe spotkanie (`wild encounter`) z bazową formą Pokémona oraz 3 pytaniami z matematyki.

**Uwierzytelnianie:** wymagane (Supabase JWT)

**Body żądania:**

```json
{
  "seed": "optional-string-for-deterministic-prng"
}
```

**Odpowiedź 200 OK:**

```json
{
  "encounterId": "uuid-v4",
  "pokemon": {
    "id": 4,
    "name": "charmander",
    "sprite": "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/4.png",
    "isShiny": false,
    "stage": 1
  },
  "questions": [
    {
      "id": "q1",
      "question": "12 + 7 = ?",
      "options": [19, 20, 18, 21]
    },
    {
      "id": "q2",
      "question": "15 - 8 = ?",
      "options": [7, 6, 8, 9]
    },
    {
      "id": "q3",
      "question": "9 + 5 = ?",
      "options": [14, 13, 15, 12]
    }
  ],
  "attemptsRemaining": 3
}
```

**Logika biznesowa:**

- Losujemy losowego Pokémona bazowej formy z 1. generacji (bez ewolucji).
- Stosujemy szansę 1/100 na wariant shiny.
- Generujemy 3 pytania używając deterministycznego PRNG z seedem `${user_id}|${pokemon_id}|${attempt}`.
- Pytania oparte są o poziom trudności `stage` (dla wild encounter zawsze 1).
- Brak deduplikacji pytań podczas generacji; historia pytań jest śledzona w in-memory LRU (~50 ID).
- 3 dystraktory na pytanie (2 „bliskie” wartości, 1 o podobnej wielkości).
- Odpowiedzi zwracane są jako prosta tablica liczb; frontend wyświetla je jako przyciski 1–4.

**Błędy:**

- `401 Unauthorized`: brak lub nieprawidłowy token
- `429 Too Many Requests`: przekroczony limit zapytań
- `500 Internal Server Error`: błąd generowania pytań

---

#### POST /api/encounters/evolution

Generuje encounter typu „evolution challenge” dla konkretnej ewolucji.

**Uwierzytelnianie:** wymagane (Supabase JWT)

**Body żądania:**

```json
{
  "baseId": 1,
  "evolutionId": 2,
  "seed": "optional-string"
}
```

**Odpowiedź 200 OK:**

```json
{
  "encounterId": "uuid-v4",
  "pokemon": {
    "id": 2,
    "name": "ivysaur",
    "sprite": "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/2.png",
    "isShiny": false,
    "stage": 2
  },
  "questions": [
    {
      "id": "q1",
      "question": "24 + 18 = ?",
      "options": [42, 41, 43, 40]
    },
    {
      "id": "q2",
      "question": "7 × 6 = ?",
      "options": [42, 41, 43, 48]
    },
    {
      "id": "q3",
      "question": "35 - 19 = ?",
      "options": [16, 15, 17, 14]
    }
  ],
  "attemptsRemaining": 3
}
```

**Logika biznesowa:**

- Weryfikujemy, że bazowy Pokémon jest złapany przez uwierzytelnionego użytkownika (gating).
- Weryfikujemy relację ewolucji w tabeli `pokemon_evolutions`.
- Stosujemy wyższy poziom trudności `stage` zależnie od poziomu ewolucji.
- Stosujemy szansę 1/100 na wariant shiny.
- Generujemy pytania tak samo jak w `/api/encounters/wild`.

**Błędy:**

- `401 Unauthorized`: brak lub nieprawidłowy token
- `403 Forbidden`: bazowy Pokémon nie został jeszcze złapany
- `404 Not Found`: relacja ewolucji nie istnieje
- `400 Bad Request`: nieprawidłowe `baseId` lub `evolutionId`
- `500 Internal Server Error`: błąd generowania pytań

---

#### POST /api/encounters/submit

Przesyła odpowiedzi dla encountera i zwraca rezultat złapania.

**Uwierzytelnianie:** wymagane (Supabase JWT)

**Body żądania:**

```json
{
  "encounterId": "uuid-v4",
  "answers": [
    { "questionId": "q1", "selectedOption": 1 },
    { "questionId": "q2", "selectedOption": 2 },
    { "questionId": "q3", "selectedOption": 1 }
  ]
}
```

**Odpowiedź 200 OK (sukces – capture):**

```json
{
  "success": true,
  "result": "captured",
  "score": {
    "correct": 3,
    "total": 3
  },
  "pokemon": {
    "id": 4,
    "name": "charmander",
    "sprite": "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/4.png",
    "variant": "normal",
    "capturedAt": "2024-12-01T10:30:00Z"
  },
  "newCapture": true
}
```

**Odpowiedź 200 OK (porażka – retry dostępne):**

```json
{
  "success": false,
  "result": "failed",
  "score": {
    "correct": 1,
    "total": 3
  },
  "attemptsRemaining": 2,
  "canRetry": true,
  "message": "Not enough correct answers. Try again!"
}
```

**Odpowiedź 200 OK (porażka – soft reroll):**

```json
{
  "success": false,
  "result": "failed",
  "score": {
    "correct": 0,
    "total": 3
  },
  "attemptsRemaining": 0,
  "canRetry": false,
  "message": "Maximum attempts reached. Starting new encounter..."
}
```

**Odpowiedź 200 OK (duplikat capture):**

```json
{
  "success": true,
  "result": "already_captured",
  "score": {
    "correct": 3,
    "total": 3
  },
  "pokemon": {
    "id": 4,
    "name": "charmander",
    "variant": "normal"
  },
  "newCapture": false,
  "message": "You've already captured this Pokémon!"
}
```

**Logika biznesowa:**

- Walidujemy, że sesja encountera istnieje i należy do uwierzytelnionego użytkownika.
- Liczymy wynik (min. 2/3 poprawnych odpowiedzi = sukces).
- Przy sukcesie:
  - Wstawiamy rekord do `captured_pokemon` z unikalnym ograniczeniem `(user_id, pokemon_id, variant)`.
  - Obsługujemy duplikaty łagodnie (zwracamy `already_captured`).
  - Aktualizujemy statystyki capture użytkownika.
- Przy porażce:
  - Zmniejszamy licznik prób.
  - Jeśli próby pozostały: zwracamy `canRetry: true`.
  - Jeśli próby się skończą: zwracamy `canRetry: false` i klient inicjuje nowy encounter.
- Aktualizujemy LRU pytań użytkownika.

**Błędy:**

- `401 Unauthorized`: brak lub nieprawidłowy token
- `404 Not Found`: sesja encountera nie znaleziona lub wygasła
- `400 Bad Request`: nieprawidłowy format odpowiedzi lub brak pytań
- `422 Unprocessable Entity`: błąd unikalności (nie powinien wystąpić przy poprawnej obsłudze)
- `500 Internal Server Error`: błąd operacji na bazie

---

### 2.3 Zarządzanie kolekcją

#### GET /api/collection

Pobiera kolekcję złapanych Pokémonów uwierzytelnionego użytkownika, z filtrowaniem i paginacją.

**Uwierzytelnianie:** wymagane (Supabase JWT)

**Parametry zapytania:**

- `caught` (opcjonalny, boolean): filtr po statusie złapania (true/false)
- `type` (opcjonalny, integer): filtr po ID typu
- `shiny` (opcjonalny, boolean): filtr po wariancie shiny
- `sort` (opcjonalny, string, domyślnie: `"pokedex"`): sortowanie (`"pokedex"`, `"name"`, `"date"`)
- `order` (opcjonalny, string, domyślnie: `"asc"`): kierunek sortowania (`"asc"`, `"desc"`)
- `limit` (opcjonalny, integer, domyślnie: 50, max: 302): liczba wyników (151 normal + 151 shiny)
- `offset` (opcjonalny, integer, domyślnie: 0): offset paginacji

**Odpowiedź 200 OK:**

```json
{
  "data": [
    {
      "pokemonId": 4,
      "name": "charmander",
      "sprites": {
        "front_default": "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/4.png",
        "front_shiny": "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/shiny/4.png"
      },
      "types": [{ "id": 10, "name": "fire", "slot": 1 }],
      "variant": "normal",
      "capturedAt": "2024-12-01T10:30:00Z",
      "isCaught": true
    },
    {
      "pokemonId": 1,
      "name": "bulbasaur",
      "sprites": {
        "front_default": "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/1.png",
        "front_shiny": "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/shiny/1.png"
      },
      "types": [
        { "id": 12, "name": "grass", "slot": 1 },
        { "id": 4, "name": "poison", "slot": 2 }
      ],
      "variant": "shiny",
      "capturedAt": "2024-11-29T15:20:00Z",
      "isCaught": true
    }
  ],
  "pagination": {
    "total": 2,
    "limit": 50,
    "offset": 0,
    "hasMore": false
  }
}
```

**Logika biznesowa:**

- Używamy widoku `my_collection_vw` dla zoptymalizowanych JOIN-ów.
- RLS automatycznie filtruje po `user_id = auth.uid()`.
- Przy `caught=false` pokazujemy sylwetki (uncaught Pokémon z pełnego katalogu).
- Domyślne sortowanie po numerze w Pokédexie (`pokemon.id ASC`).

**Błędy:**

- `401 Unauthorized`: brak lub nieprawidłowy token
- `400 Bad Request`: nieprawidłowe parametry zapytania
- `500 Internal Server Error`: błąd zapytania do bazy

---

#### GET /api/collection/stats

Pobiera zagregowane statystyki kolekcji dla uwierzytelnionego użytkownika.

**Uwierzytelnianie:** wymagane (Supabase JWT)

**Odpowiedź 200 OK:**

```json
{
  "totalCaptured": 12,
  "totalPossible": 151,
  "percentage": 7.95,
  "shinyCount": 2,
  "variantBreakdown": {
    "normal": 10,
    "shiny": 2
  },
  "typeBreakdown": [
    { "typeId": 10, "typeName": "fire", "count": 3 },
    { "typeId": 11, "typeName": "water", "count": 2 },
    { "typeId": 12, "typeName": "grass", "count": 4 }
  ],
  "recentCaptures": [
    {
      "pokemonId": 4,
      "name": "charmander",
      "sprite": "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/4.png",
      "variant": "normal",
      "capturedAt": "2024-12-01T10:30:00Z"
    }
  ]
}
```

**Logika biznesowa:**

- Używamy materializowanego widoku `user_capture_stats` dla wydajności.
- Liczymy unikalne pary `(pokemon_id, variant)`.
- Wyliczamy procent ukończenia jako `captured / 151`.
- Agregujemy po typach korzystając z tabeli `pokemon_types`.
- Zwracamy ostatnie 5 złapań posortowane po `captured_at DESC`.

**Błędy:**

- `401 Unauthorized`: brak lub nieprawidłowy token
- `500 Internal Server Error`: błąd zapytania do bazy

---

#### DELETE /api/collection/:pokemonId/:variant (Post-MVP, niezaimplementowane w MVP)

Usuwa złapanego Pokémona z kolekcji użytkownika (funkcja opcjonalna do testów, **niewdrożona w aktualnym MVP**).

**Uwierzytelnianie:** wymagane (Supabase JWT)

**Parametry w URL:**

- `pokemonId` (integer, wymagany)
- `variant` (string, wymagany): `"normal"` lub `"shiny"`

**Odpowiedź 204 No Content**

**Błędy:**

- `401 Unauthorized`: brak lub nieprawidłowy token
- `404 Not Found`: Pokémon nie należy do kolekcji użytkownika
- `400 Bad Request`: nieprawidłowe `pokemonId` lub `variant`
- `500 Internal Server Error`: błąd operacji na bazie

---

### 2.4 Profil użytkownika (Post-MVP, niezaimplementowane)

#### GET /api/profile

Pobiera profil uwierzytelnionego użytkownika (**planowany endpoint, brak implementacji w MVP**).

**Uwierzytelnianie:** wymagane (Supabase JWT)

**Odpowiedź 200 OK:**

```json
{
  "userId": "uuid",
  "displayName": "Ash Ketchum",
  "avatarUrl": "https://example.com/avatar.jpg",
  "createdAt": "2024-11-01T08:00:00Z",
  "stats": {
    "totalCaptured": 12,
    "shinyCount": 2
  }
}
```

**Błędy:**

- `401 Unauthorized`: brak tokena
- `404 Not Found`: profil nie istnieje (powinien zostać utworzony przy pierwszym dostępie)
- `500 Internal Server Error`: błąd zapytania do bazy

---

#### PUT /api/profile

Aktualizuje profil uwierzytelnionego użytkownika (**planowany endpoint, brak implementacji w MVP**).

**Uwierzytelnianie:** wymagane (Supabase JWT)

**Body żądania:**

```json
{
  "displayName": "Ash Ketchum",
  "avatarUrl": "https://example.com/avatar.jpg"
}
```

**Odpowiedź 200 OK:**

```json
{
  "userId": "uuid",
  "displayName": "Ash Ketchum",
  "avatarUrl": "https://example.com/avatar.jpg",
  "createdAt": "2024-11-01T08:00:00Z"
}
```

**Walidacja:**

- `displayName`: max 50 znaków, alfanumeryczne + spacje
- `avatarUrl`: poprawny URL, max 500 znaków

**Błędy:**

- `401 Unauthorized`: brak tokena
- `400 Bad Request`: nieprawidłowe dane profilu
- `500 Internal Server Error`: błąd operacji na bazie

---

### 2.5 Health & Utility

#### GET /api/health

Endpoint health-check do monitoringu.

**Odpowiedź 200 OK:**

```json
{
  "status": "healthy",
  "timestamp": "2024-12-01T10:30:00Z",
  "database": "connected",
  "version": "1.0.0"
}
```

**Błędy:**

- `503 Service Unavailable`: problem z połączeniem z bazą danych

---

## 3. Uwierzytelnianie i autoryzacja

### Mechanizm uwierzytelniania

**Provider:** Supabase Auth z Google OAuth

**Implementacja:**

- Uwierzytelnianie po stronie klienta z użyciem SDK `@supabase/supabase-js`.
- JWT wydawane przez usługę Supabase Auth.
- Tokeny przekazywane w nagłówku `Authorization: Bearer <jwt-token>`.
- Weryfikacja tokenów delegowana do klienta Supabase z RLS.

**Zarządzanie sesją:**

- Tokeny przechowywane w `localStorage`/`sessionStorage` przez klienta Supabase.
- Automatyczne odświeżanie wygasłych tokenów przez SDK.
- Czas życia sesji konfigurowany w panelu Supabase (domyślnie 7 dni).

### Autoryzacja

**Row-Level Security (RLS):**

Wszystkie operacje na bazie respektują polityki RLS:

1. **Publiczne zasoby tylko do odczytu:**
   - `pokemon`, `types`, `pokemon_types`, `pokemon_evolutions`
   - Polityka: `FOR SELECT USING (true)`

2. **Zasoby powiązane z użytkownikiem:**
   - `captured_pokemon`: `USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid())`
   - `profiles`: `USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid())`

3. **Widoki:**
   - `my_collection_vw`: dziedziczy RLS z tabel źródłowych
   - `user_capture_stats`: widok materializowany filtrowany po `user_id`

**Sprawdzenia na poziomie API:**

- Wszystkie chronione endpointy sprawdzają obecność i poprawność JWT.
- Klient Supabase automatycznie wstrzykuje `user_id` do zapytań.
- Nieudane uwierzytelnienie → `401 Unauthorized`.
- Naruszenie autoryzacji → `403 Forbidden`.

**Nagłówki bezpieczeństwa:**

- `Strict-Transport-Security: max-age=31536000; includeSubDomains`
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Content-Security-Policy`: skonfigurowane pod Astro server output, Supabase i Vercel

---

## 4. Walidacja i logika biznesowa

### 4.1 Zasady walidacji per zasób

#### Pokemon

- `id`: integer, zakres 1–151
- `name`: string, unikalny (case-insensitive), max 50 znaków
- `stats`: obiekt JSONB z kluczami: `height`, `weight`, `hp`, `attack`, `defense`, `speed`
- `sprites`: obiekt JSONB z poprawnymi URL-ami
- `region`: string, aktualnie tylko `"kanto"`

#### Captured Pokemon

- `user_id`: UUID, musi odpowiadać użytkownikowi z JWT
- `pokemon_id`: integer, musi istnieć w tabeli `pokemon` (FK)
- `variant`: enum `"normal"` lub `"shiny"`
- **Unikalność:** `(user_id, pokemon_id, variant)`

#### Encounter Submission

- `encounterId`: UUID v4
- `answers`: tablica dokładnie 3 obiektów
- Każda odpowiedź:
  - `questionId`: string odpowiadający wygenerowanemu ID pytania
  - `selectedOption`: integer 1–4 reprezentujący indeks opcji

#### Profile

- `display_name`: string, max 50 znaków, opcjonalny
- `avatar_url`: poprawny URL, max 500 znaków, opcjonalny

---

### 4.2 Implementacja logiki biznesowej

#### Generowanie wild encounter

**Algorytm:**

1. Wyciągamy `user_id` z sesji Supabase (JWT rozwiązywany przez middleware SSR).
2. Pytamy bazę o pulę Pokémonów **bazowych form** z tabeli `pokemon` (bez rekordów będących celem w `pokemon_evolutions`).
3. Stosujemy deterministyczny wybór z PRNG z seedem `${user_id}|${seedOrNow}` – bez ważenia, dopuszczalne powtórzenia między encounterami.
4. Rzucamy na wariant shiny (prawdopodobieństwo 1/100) i dodatkowo sprawdzamy, czy użytkownik ma już wariant `normal` danego Pokémona w `captured_pokemon`; w przeciwnym razie encounter jest normalny.
5. Dla wild encountera `stage = 1`; dla evolution encountera `stage` wynika z głębokości łańcucha ewolucji (2 lub 3).
6. Seed PRNG: `${user_id}|${pokemon_id}|${Date.now()}` lub przekazany `seed` (deterministyczny w obrębie encountera, niedeterministyczny pomiędzy próbami).
7. Generujemy **dokładnie 3 pytania**:
   - Losujemy operator zgodnie z zasadami `stage` (poniżej).
   - Losujemy operandy zależnie od `stage` i operatora.
   - Obliczamy poprawny wynik (tylko liczby całkowite, bez wartości ujemnych).
   - Generujemy 3 dystraktory w zakresie ±12 od poprawnej odpowiedzi (unikalne, wartości < 0 podbijane do 0).
   - Tasujemy kolejność odpowiedzi (Fisher–Yates na 4-elementowej tablicy).
   - Nadajemy ID pytaniu jako skrót z (`stage`, operatora, operandów, indeksu pytania).
8. Budujemy payload encountera (`EncounterResponseDto`) bez ujawniania indeksów poprawnych odpowiedzi (tylko treści i opcje).
9. Po stronie serwera tworzymy **in-memory session snapshot** (Map w `globalThis`) z poprawnymi indeksami, licznikiem prób (3) i TTL ≈ 15 minut.
10. Zwracamy encounter do klienta.

**Zasady stage (zgodne z PRD):**

- **Stage 1:**
  - Operatory: `+`, `-`, `*` losowane równomiernie.
  - Dodawanie/odejmowanie: operandy 5–99 (przy odejmowaniu zapewniamy wynik ≥ 0).
  - Mnożenie: oba operandy 2–12.
- **Stage 2:**
  - Operatory: `+`, `-`, `*` losowane równomiernie.
  - Dodawanie/odejmowanie: operandy 10–120 (wynik ≥ 0).
  - Mnożenie: oba operandy 3–12.
- **Stage 3:**
  - Operatory: 50% `*`, 25% `+`, 25% `-`.
  - Dodawanie/odejmowanie: operandy 25–200 (wynik ≥ 0).
  - Mnożenie: oba operandy 7–12.

Brak dzielenia w MVP; wszystkie wyniki są nieujemnymi liczbami całkowitymi.

#### Gating wyzwań ewolucyjnych

**Kroki weryfikacji:**

1. Wyciągamy `user_id` z JWT.
2. Walidujemy istnienie `baseId` i `evolutionId` w bazie.
3. Sprawdzamy relację w `pokemon_evolutions`.
4. Sprawdzamy, czy użytkownik złapał bazową formę:

```sql
SELECT * FROM captured_pokemon
WHERE user_id = $1 AND pokemon_id = $2
```

5. Jeśli brak rekordu → `403 Forbidden` z odpowiednim komunikatem.
6. Jeśli rekord istnieje → generujemy encounter z wyższym `stage`.

#### Walidacja capture i zapis do bazy

**Przepływ submitu:**

1. Pobieramy sesję encountera po `encounterId` (zawiera poprawne indeksy).
2. Weryfikujemy, że sesja należy do uwierzytelnionego użytkownika.
3. Liczymy wynik:

```text
correct_count = 0
for each answer:
  if answer.selectedOption == stored_correct_index_for_question:
    correct_count++
```

`selectedOption` ma wartości 1–4 (numer przycisku na froncie) i odpowiada pozycji w tablicy `options`.

4. Jeśli `correct_count >= 2`:
   - Próbujemy `INSERT` do `captured_pokemon`:

```sql
INSERT INTO captured_pokemon (user_id, pokemon_id, variant, captured_at)
VALUES ($1, $2, $3, NOW())
ON CONFLICT (user_id, pokemon_id, variant) DO NOTHING
RETURNING *
```

- Jeśli rekord wstawiono → zwracamy sukces z `newCapture: true`.
- Jeśli konflikt → zwracamy sukces z `newCapture: false` (`already_captured`).

5. Jeśli `correct_count < 2`:
   - Dekrementujemy `attemptsRemaining` w sesji.
   - Jeśli `attemptsRemaining > 0` → `canRetry: true`.
   - Jeśli `attemptsRemaining = 0` → `canRetry: false` (front inicjuje nowy encounter).

6. Aktualizujemy LRU pytań użytkownika.

#### Filtrowanie kolekcji

**Budowa zapytania:**

1. Bazujemy na widoku `my_collection_vw` lub lewym JOIN z `captured_pokemon`.
2. Stosujemy filtr RLS: `WHERE user_id = auth.uid()`.
3. Nakładamy filtry z parametrów zapytania:
   - `caught=true`: `WHERE captured_at IS NOT NULL`
   - `caught=false`: `WHERE captured_at IS NULL`
   - `type=$id`: `JOIN pokemon_types WHERE type_id = $id`
   - `shiny=true`: `WHERE variant = 'shiny'`
4. Sortowanie:
   - `pokedex`: `ORDER BY pokemon.id`
   - `name`: `ORDER BY pokemon.name`
   - `date`: `ORDER BY captured_at DESC`
5. Paginacja: `LIMIT $limit OFFSET $offset`.
6. Zwracamy wyniki z metadanymi paginacji.

#### Logika wariantu shiny

- Prawdopodobieństwo: 1/100 na encounter (`rng() < 0.01` na PRNG z seedem użytkownika).
- Gate: shiny możliwy tylko, jeśli użytkownik ma już wariant `normal` danego Pokémona (sprawdzenie w `captured_pokemon`).
- Przebieg:
  - Najpierw losujemy `isShiny`.
  - Jeśli `isShiny = true` i użytkownik ma `normal` → encounter jest shiny, inaczej normalny.
  - Sprite wybieramy na podstawie kluczy `front_shiny` / `front_default` w kolumnie `sprites`.
- Przy capture wariant zapisujemy w `captured_pokemon.variant` (`'normal' | 'shiny'`).

#### Deduplikacja pytań

**Strategia LRU (MVP):**

1. Utrzymujemy **per-user** historię pytań w in-memory Map (`QuestionLruService`) w procesie Node (brak tabeli/Redis w MVP).
2. Dla każdego użytkownika przechowujemy maksymalnie 50 ostatnich ID pytań (hash ze `stage`, operatorów, operandów, indeksu).
3. Podczas generacji **nie wymuszamy** braku kolizji – powtórki są dopuszczalne; LRU służy głównie do diagnostyki i future-proofingu.
4. Po każdym poprawnym submitcie `/api/encounters/submit` zapisuje ID pytań do LRU, usuwając najstarsze przy przekroczeniu limitu.
5. Cache istnieje tylko w pamięci jednej instancji – w środowisku multi-instance potrzebny będzie współdzielony store (np. Redis, post-MVP).

---

### 4.3 Obsługa błędów

**Standardowy format błędu:**

```json
{
  "error": {
    "code": "POKEMON_NOT_FOUND",
    "message": "The requested Pokémon does not exist",
    "details": {
      "pokemonId": 999
    }
  }
}
```

**Typowe kody błędów:**

- `AUTHENTICATION_REQUIRED`: brak JWT
- `INVALID_TOKEN`: niepoprawny lub wygasły JWT
- `PERMISSION_DENIED`: naruszenie polityki RLS
- `RESOURCE_NOT_FOUND`: zasób nie istnieje
- `VALIDATION_FAILED`: błąd walidacji requestu
- `DUPLICATE_CAPTURE`: naruszenie unikalności capture
- `BASE_NOT_CAPTURED`: niespełniony wymóg bazowego capture dla ewolucji
- `ENCOUNTER_EXPIRED`: sesja encountera wygasła lub jest niepoprawna
- `RATE_LIMIT_EXCEEDED`: przekroczony limit zapytań
- `INTERNAL_ERROR`: nieoczekiwany błąd serwera

---

### 4.4 Rate limiting

**Limity:**

- Wild encounter: 10/min na użytkownika
- Evolution challenges: 5/min na użytkownika
- Zapytania kolekcji: 30/min na użytkownika
- Profile updates: 5/min na użytkownika

**Implementacja:**

- Algorytm `token bucket`.
- Kluczowanie po `user_id` z JWT.
- Nagłówki odpowiedzi: `X-RateLimit-Remaining`, `X-RateLimit-Reset`.
- Przy przekroczeniu: `429 Too Many Requests` z `Retry-After`.

---

## 5. Wydajność

### 5.1 Cache

**Dane statyczne (długi TTL):**

- Katalog Pokémonów: `Cache-Control: public, max-age=86400` (24h)
- Lista typów: `Cache-Control: public, max-age=86400`
- Łańcuchy ewolucji: `Cache-Control: public, max-age=86400`

**Dane użytkownika (bez cache lub krótki):**

- Kolekcja: `Cache-Control: private, no-cache`
- Profil: `Cache-Control: private, no-cache`
- Statystyki: `Cache-Control: private, max-age=300` (5 minut)

**Widoki materializowane:**

- `user_capture_stats`: odświeżanie po evencie capture lub okresowo (co 5 minut).

### 5.2 Indeksy bazy

**Istniejące indeksy (ze schematu):**

- `pokemon_name_unique` na `LOWER(pokemon.name)`
- `pokemon_name_gin` na `to_tsvector('simple', pokemon.name)`
- `pokemon_types_type_id_idx` na `pokemon_types.type_id`
- `captured_pokemon_user_idx` na `captured_pokemon.user_id`

**Dodatkowo zalecane:**

- `captured_pokemon_captured_at_idx` dla sortowania po dacie
- `captured_pokemon_variant_idx` dla filtrowania shiny

### 5.3 Optymalizacja zapytań

- Użycie prepared statements dla zapytań parametryzowanych.
- Wykorzystanie widoku `my_collection_vw` dla pre-joinowanych danych kolekcji.
- Ograniczanie wyników paginacją (max 151 elementów).
- Korzystanie z connection poolingu (obsługiwany przez Supabase).
- Unikanie problemu N+1 poprzez poprawne JOIN-y.

---

## 6. Uwagi implementacyjne

### 6.1 Integracja z Astro

**Struktura route’ów API:**

```text
src/pages/api/
├── pokemon/
│   ├── index.ts        # GET /api/pokemon
│   └── [id].ts         # GET /api/pokemon/:id
├── types/
│   └── index.ts        # GET /api/types
├── encounters/
│   ├── wild.ts         # POST /api/encounters/wild
│   ├── evolution.ts    # POST /api/encounters/evolution
│   └── submit.ts       # POST /api/encounters/submit
├── collection/
│   ├── index.ts        # GET /api/collection
│   ├── stats.ts        # GET /api/collection/stats
│   └── [pokemonId]/[variant].ts  # DELETE
├── profile/
│   └── index.ts        # GET/PUT /api/profile
└── health.ts           # GET /api/health
```

**Szablon endpointu:**

```typescript
// src/pages/api/pokemon/[id].ts
import type { APIRoute } from "astro";
import { supabaseServer } from "@/lib/supabase";

export const GET: APIRoute = async ({ params, request }) => {
  const { id } = params;

  // Validate
  if (!id || isNaN(Number(id))) {
    return new Response(
      JSON.stringify({
        error: { code: "INVALID_ID", message: "Invalid Pokemon ID" },
      }),
      { status: 400 }
    );
  }

  // Query database
  const { data, error } = await supabaseServer
    .from("pokemon")
    .select("*, types(*), evolutions(*)")
    .eq("id", id)
    .single();

  if (error || !data) {
    return new Response(
      JSON.stringify({
        error: { code: "POKEMON_NOT_FOUND", message: "Pokemon not found" },
      }),
      { status: 404 }
    );
  }

  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
```

### 6.2 Konfiguracja klienta Supabase

**Klient po stronie serwera (public data):**

```typescript
// src/lib/supabase/server.ts
import { createClient } from "@supabase/supabase-js";

export const supabaseServer = createClient(import.meta.env.SUPABASE_URL, import.meta.env.SUPABASE_SERVICE_ROLE_KEY);
```

**Klient po stronie przeglądarki (auth):**

```typescript
// src/lib/supabase/client.ts
import { createClient } from "@supabase/supabase-js";

export const supabaseClient = createClient(import.meta.env.SUPABASE_URL, import.meta.env.SUPABASE_KEY);
```

**Wyciąganie JWT w endpointach API:**

```typescript
import { supabaseServer } from "@/lib/supabase";

export const POST: APIRoute = async ({ request }) => {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader) {
    return new Response(
      JSON.stringify({
        error: { code: "AUTHENTICATION_REQUIRED" },
      }),
      { status: 401 }
    );
  }

  const token = authHeader.replace("Bearer ", "");
  const {
    data: { user },
    error,
  } = await supabaseServer.auth.getUser(token);

  if (error || !user) {
    return new Response(
      JSON.stringify({
        error: { code: "INVALID_TOKEN" },
      }),
      { status: 401 }
    );
  }

  // Use user.id for RLS queries
  // ...
};
```

### 6.3 Strategia testowania

**Testy jednostkowe:**

- Logika generowania pytań (PRNG, dystraktory, zakresy).
- Funkcje walidujące dane wejściowe.
- Pomocnicze funkcje logiki biznesowej (prawdopodobieństwo shiny, wyznaczanie `stage`).

**Testy integracyjne:**

- Odpowiedzi endpointów API (statusy, payloady).
- Operacje na bazie (CRUD, constrainty, RLS).
- Przepływy uwierzytelniania (walidacja JWT, kontekst użytkownika).

**Testy E2E:**

- Pełna ścieżka użytkownika (logowanie → encounter → capture → podgląd kolekcji).
- Edge case’y (duplikaty capture, max retry, brak auth).

---

## 7. Rozszerzenia przyszłościowe (poza MVP)

- **Webhooks:** powiadomienia o rzadkich capture (shiny, „legendary”).
- **Leaderboards:** rankingi globalne i wśród znajomych.
- **Trading:** wymiana Pokémonów między użytkownikami.
- **Battles:** wyzwania PvP/PvE oparte o zadania matematyczne.
- **Achievements:** odznaki za milestone’y (np. złap wszystkie `fire`, 10 shiny itd.).
- **Advanced filtering:** złożone filtry, zapisane wyszukiwania.
- **Batch operations:** masowe zwalnianie Pokémonów, transfery, itp.
- **Real-time updates:** WebSockety dla zmian kolekcji w czasie rzeczywistym.
- **Admin panel:** zarządzanie treścią, moderacja użytkowników, analityka.

---

## Podsumowanie

Ten plan REST API definiuje pełny fundament dla MVP PokéMath, obejmujący:

- **13 endpointów** dla katalogu Pokémonów, encounterów, kolekcji oraz profilu (część jako planowane).
- **Bezpieczeństwo z RLS** i integracją Supabase Auth.
- **Kompletną walidację** i obsługę błędów.
- **Deterministyczne generowanie pytań** z PRNG i LRU.
- **Skalowalną architekturę** przygotowaną pod statyczne wdrożenie Astro.
- **Optymalizacje wydajności** przez indeksy, cache i widoki materializowane.

# Specyfikacja architektury logowania przez Google (Supabase Auth) – PokéMath

Dokument opisuje architekturę logowania i wylogowania wyłącznie przez Google z wykorzystaniem Supabase Auth, zgodnie z PRD. Projekt obejmuje utworzenie minimalnych elementów: komponentów UI, middleware SSR, layoutów i dwóch route handlerów: `GET /api/auth/callback` oraz `GET /api/auth/signout`. Zachowujemy SSR (`output: "server"`) i wzorzec Astro Islands.

## 0) Założenia i ograniczenia

- PRD: jedyna ścieżka uwierzytelnienia to Google (login-first). Brak rejestracji/odzyskiwania hasła w aplikacji – rejestracja jest implicit przez Google.
- Do utworzenia minimalny zestaw route handlerów:
  - `GET /api/auth/callback` – wymiana `code` → sesja, redirect,
  - `GET /api/auth/signout` – wylogowanie, redirect.
- SSR i Supabase SSR:
  - w `astro.config.mjs` ustawiamy `output: "server"`,
  - tworzymy `src/middleware/index.ts` z `createServerClient` (SSR) i odświeżaniem sesji (`auth.getUser()`), przypinając klienta do `locals.supabase`.
- RLS i reszta logiki domenowej pozostają bez zmian.

## 1) User flow (logowanie, wylogowanie, implicit „rejestracja”)

- Logowanie (Google OAuth)
  1. Użytkownik klika „Sign in with Google” (komponent React po stronie klienta).
  2. Wywoływane jest `supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo } })`, gdzie `redirectTo = <origin>/api/auth/callback?next=<allowlisted-path>`.
  3. Po autoryzacji Google przekierowuje na `/api/auth/callback?code=...&next=...`.
  4. Handler `callback` wywołuje `supabase.auth.exchangeCodeForSession(code)` (ustawia cookies sesyjne przez SSR adapter) i wykonuje redirect do `next` (gdy poprawne) lub `/dashboard` (domyślnie).
  5. Przy błędzie – redirect na stronę startową `/` z bezpiecznym komunikatem (np. `?authError=sign_in_failed`); UI prezentuje `ErrorAlert`.

- Implicit „rejestracja”
  - Jeśli użytkownik nie istniał, Supabase tworzy konto po stronie Auth przy pierwszym udanym OAuth. Po stronie aplikacji (np. przy wejściu na `/dashboard`) należy zaimplementować lazy inicjalizację profilu (insert do `profiles` pod RLS) w serwerowym renderze widoku lub dedykowanym serwisie wywołanym z widoku.

- Wylogowanie
  - Link/CTA „Sign out” kieruje na `GET /api/auth/signout` → `supabase.auth.signOut()` → redirect na `/`.

- Wygasła sesja
  - Próba wejścia na zasób chroniony powoduje redirect do `/` (lub `/dashboard` → redirect do `/`), z komunikatem informującym o wygaśnięciu sesji (URI np. `/?authError=expired`), a UI prezentuje odpowiedni stan i przycisk „Sign in with Google”.

## 2) Struktura komponentów UI

- Strony i layouty (do utworzenia)
  - Publiczne widoki (np. `src/pages/index.astro`) renderowane w `PublicLayout.astro`. Zawierają CTA `SignInButton`.
  - Prywatne widoki (np. `src/pages/dashboard.astro`) renderowane w `PrivateLayout.astro`. Tam wykonywany jest server-side guard: `const { data: { user } } = await locals.supabase.auth.getUser()`. Brak użytkownika → redirect 302 do `/` z `?next=<original>`.

- Komponenty (React islands – do utworzenia)
  - `src/components/SignInButton.tsx` – przycisk do logowania przez Google. Bazowy sposób rozpoczęcia OAuth. Warto rozszerzyć `redirectTo` o propagację `next` (jeśli dostępne) – to tylko parametr query.
  - `src/components/ErrorAlert.tsx` – prezentacja komunikatów błędów (np. po powrocie z `callback` z błędem lub `authError=expired`).
  - `src/components/ui/button.tsx` – wspólny wzorzec przycisków.

- Stany UI i dostępność
  - `SignInButton` ma stan `isLoading` (disable + spinner).
  - Widok publiczny powinien renderować `ErrorAlert` na podstawie parametru `authError` (wartości: `sign_in_failed` | `expired`) i mieć kluczowy CTA (Sign in with Google).
  - ARIA: komunikaty błędów w regionie `aria-live="polite"`.

## 3) API endpoints / route handlers (do utworzenia)

- `GET /api/auth/callback`
  - Wejście: `code` (wymagany), `next?` (opcjonalny, wewnętrzna ścieżka).
  - Działanie: `supabase.auth.exchangeCodeForSession(code)`; w przypadku błędu loguje i redirectuje do `/` (rekomendacja: z `?authError=sign_in_failed`).
  - Wyjście: redirect 302 do `next` (po walidacji) lub `/dashboard`.

- `GET /api/auth/signout`
  - Działanie: `supabase.auth.signOut()` → redirect 302 na `/`.

- Uwaga: tylko dwa minimalne route handlery. Inicjacja OAuth odbywa się w kliencie przez `signInWithOAuth`; obsługa sesji – w `callback` + middleware.

## 4) Session management (cookies, JWT, server sessions)

- Cookies i SSR
  - Dodajemy middleware (`src/middleware/index.ts`) z Supabase SSR (`createServerClient`), który odczytuje i zapisuje cookies (`getAll`/`setAll`), dzięki czemu sesja (oparta o JWT) jest dostępna w czasie SSR dla każdej strony i API.
  - Na każdą prośbę middleware wywołuje `supabase.auth.getUser()` w celu odświeżenia sesji (jeśli istnieje).
  - Ustawienia bezpieczeństwa cookies: `HttpOnly`, `Secure` (prod), `SameSite=Lax`, `Path=/` – zapewniane przez Supabase; aplikacja nie powinna ich modyfikować ręcznie.

- Gating widoków prywatnych
  - W `PrivateLayout.astro` implementujemy server-side guard, który pobiera użytkownika z `locals.supabase`. Brak usera → redirect do `/` z zachowaniem bezpiecznego `next` (patrz: open redirect prevention).

- Klient
  - `createBrowserClient` używamy wyłącznie w `SignInButton.tsx` do wywołania `signInWithOAuth`.
  - Brak przechowywania tokenów w `localStorage/sessionStorage` – sesja żyje w cookies zarządzanych przez Supabase SSR.

## 5) Error handling i walidacja

- Walidacja parametrów powrotu
  - `code`: musi być ustawiony (w przeciwnym razie redirect na `/`).
  - `next`: dozwolone wyłącznie ścieżki wewnętrzne (np. zaczynające się od `/`, bez protokołu i bez `//`). W przypadku nieprawidłowego `next` – ignorujemy i kierujemy na `/dashboard`. (Ochrona przed open redirect).

- Mapowanie błędów na komunikaty UI
  - Błąd wymiany `code` → sesja: redirect na `/` z `?authError=sign_in_failed`.
  - Wygasła sesja: redirect na `/` z `?authError=expired`.
  - UI wyświetla prosty, bezpieczny komunikat (bez PII).

- Logowanie błędów
  - Handler `callback` loguje błąd (konsola/observability) z minimalnym kontekstem (typ operacji, identyfikator żądania), bez PII.

## 6) Security measures (rate limiting, CSRF protection)

- CSRF/OAuth
  - OAuth z Supabase wykorzystuje PKCE i `state` – ochrona przed CSRF w trakcie wymiany kodu jest zapewniona przez bibliotekę i cookies.
  - Brak klasycznych formularzy, więc brak osobnych CSRF tokenów w aplikacji.

- Open Redirect Prevention
  - Walidacja `next` w `callback.ts` i w server-side guardzie – tylko ścieżki wewnętrzne (np. `^/([\\w-./]*)$`). Zewnętrzne URL-e są odrzucane.

- Rate limiting
  - Nie tworzymy własnego endpointu logowania – właściwa weryfikacja dzieje się u dostawcy (Google). `callback` może zostać teoretycznie floodowany błędnymi `code`, ale jest to tania operacja; ewentualny limiter można dodać na poziomie reverse proxy.

- Cookies i transport
  - Wymuszamy HTTPS w środowisku produkcyjnym (`Secure`), `SameSite=Lax`, `HttpOnly` – przez Supabase SSR.

- RLS i separacja danych
  - Cała dalsza praca na danych (kolekcja Pokémonów) odbywa się z RLS i filtrem `user_id = auth.uid()`.

## 7) Zakres implementacji (do utworzenia)

- Elementy do zaimplementowania:
  - `src/components/SignInButton.tsx` – island inicjująca OAuth (obsługa `isLoading`, propagacja `next` w `redirectTo`).
  - `src/components/ErrorAlert.tsx` – komponent do prezentacji błędów na publicznych widokach.
  - `src/components/ui/button.tsx` – wspólny przycisk (jeśli nie istnieje).
  - `src/pages/api/auth/callback.ts` – wymiana `code` na sesję i redirect (obsługa `next`, błędów).
  - `src/pages/api/auth/signout.ts` – czyszczenie sesji, redirect na `/`.
  - `src/middleware/index.ts` – inicjalizacja Supabase SSR i odświeżanie sesji (`auth.getUser()`), przypięcie klienta do `locals.supabase`.
  - `src/layouts/PublicLayout.astro` i `src/layouts/PrivateLayout.astro` – odpowiednio publiczny layout z CTA logowania i prywatny layout z guardem SSR oraz linkiem „Sign out”.

## 8) Podsumowanie

- Uwierzytelnianie wyłącznie przez Google (Supabase OAuth), do utworzenia minimalny zestaw: `SignInButton`, middleware SSR, layouty oraz dwa route handlery (`callback`, `signout`).
- Flow: `SignInButton` → Google → `/api/auth/callback` → `/dashboard` (lub bezpieczne `next`), wylogowanie przez `/api/auth/signout`.
- Sesje: cookies zarządzane przez Supabase SSR, `locals.supabase` dostępne w SSR i API.
- Bezpieczeństwo: PKCE/state, `SameSite` cookies, walidacja `next`, RLS dla danych domenowych, brak przechowywania tokenów po stronie klienta.

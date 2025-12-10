# Dokument wymagań produktu (PRD) - PokéMath

## 1. Przegląd produktu

PokéMath to lekka, przeglądarkowa gra edukacyjna łącząca krótkie ćwiczenia matematyczne z kolekcjonowaniem Pokémonów. Użytkownik odblokowuje i kolekcjonuje Pokémony, rozwiązując 3 pytania jednokrotnego wyboru w każdym spotkaniu. Złapanie następuje, gdy użytkownik odpowie poprawnie na co najmniej 2 z 3 pytań. Po złapaniu Pokémon trafia do kolekcji użytkownika i pozostaje tam po odświeżeniu strony.

- Cel produktu: zwiększenie motywacji do nauki podstawowej arytmetyki dzięki prostej mechanice kolekcjonowania i progresji.
- Grupa docelowa: dzieci uczące się podstaw matematyki i dorośli szukający krótkich, gamifikowanych ćwiczeń. Interfejs w języku EN, dostęp na mobile i desktop.
- Zakres danych: pełna Generacja 1 (151 Pokémonów). W „wild encounter" losowane wyłącznie formy bazowe; ewolucje łapane z ekranu detalu po odblokowaniu.
- Unikalna propozycja wartości: natychmiastowa informacja zwrotna, prosta pętla gry, kolekcjonowanie, wariant shiny (1/100) dla dodatkowej rzadkości i motywacji.
- Platformy: przeglądarka mobilna i desktopowa.
- Technologia: Astro 5 (islands, server output via Vercel adapter), React 19, TypeScript 5, Tailwind 4, shadcn/ui; Supabase (Auth i baza danych, RLS, typy generowane z bazy). Dane i sprite’y Gen 1 seedowane offline z oficjalnych zasobów PokeAPI (API/CDN), bez runtime calli do PokeAPI.

## 2. Problem użytkownika

- Klasyczne ćwiczenia matematyczne są dla wielu osób mało angażujące; brakuje elementów grywalizacji i natychmiastowych nagród.
- Użytkownicy chcą krótkich, powtarzalnych zadań z natychmiastową informacją zwrotną, najlepiej dostępnych z poziomu przeglądarki i bez konfiguracji.
- Dzieci i początkujący potrzebują prostych zakresów działań i czytelnej eskalacji trudności.
- Użytkownicy mobilni wymagają responsywnego i szybkiego interfejsu.

## 3. Wymagania funkcjonalne

### 3.1 Uwierzytelnianie i sesja

- Logowanie Google przez Supabase Auth (login-first); wylogowanie dostępne w UI.
- Czytelne stany błędu i możliwość ponowienia logowania.
- Sesja utrzymywana pomiędzy odświeżeniami; przy wygaśnięciu sesji użytkownik proszony o ponowne logowanie.

### 3.2 Dane i bezpieczeństwo

- Tabele: pokemon, pokemon_evolutions, captured_pokemon.
- captured_pokemon zawiera co najmniej: user_id, pokemon_id, name, sprite_url, variant ['normal','shiny'], captured_at.
- Indeksy m.in. po user_id oraz polach używanych w filtrach.
- RLS: publiczny SELECT dla pokemon; pełny CRUD captured_pokemon wyłącznie dla właściciela (user_id = auth.uid()).
- Dane Gen 1 są seedowane offline z użyciem sprite URLs z PokeAPI; brak wywołań do PokeAPI w runtime.

### 3.3 Wild encounter

- Losowanie form bazowych z Gen 1; możliwe powtórzenia między encounterami.
- Każde spotkanie to 3 pytania jednokrotnego wyboru; cztery możliwe odpowiedzi, jedna poprawna, pozycje losowe.
- Warunek złapania: co najmniej 2 poprawne odpowiedzi z 3.
- Porażka: przy <2 poprawnych – przycisk Try again ponawia te same pytania; po maksymalnie 3 próbach sesja jest kasowana, nowy encounter uruchamia użytkownik.
- Shiny: szansa 1/100, ale shiny pojawia się tylko, gdy użytkownik ma już wariant normal danego Pokémona; shiny zapisuje się jako osobny wariant.

### 3.4 Generator zadań matematycznych

- Operacje: dodawanie, odejmowanie, mnożenie (brak dzielenia); wyniki całkowite, brak liczb ujemnych.
- Zakresy per stage:
  - stage 1: dod./odej. 5–99; mnożenie 2–12,
  - stage 2: dod./odej. 10–120; mnożenie 3–12,
  - stage 3: dod./odej. 25–200; mnożenie 7–12; rozkład operatorów: 50% `*`, 25% `+`, 25% `-`.
- Dystraktory: losowe wartości ±12 od poprawnej (unikalne), poprawna w losowej pozycji.
- Losowość: opcjonalny seed z żądania; domyślnie `${user_id}|${Date.now()}` (wynik niedeterministyczny per user/pokemon/attempt).
- Deduplikacja: brak podczas generacji; LRU w pamięci (~50 ostatnich ID pytań) aktualizuje się po submit i może nie zapobiegać powtórkom.

### 3.5 Kolekcja i szczegóły

- My Collection: siatka złapanych Pokémonów (sprite, nazwa), domyślny sort po numerze Pokédex.
- Nieznane Pokémony prezentowane jako sylwetki (placeholder).
- Filtry: caught/uncaught, typ, shiny.
- Ekran detalu: typy, data złapania, dostępne ewolucje oraz CTA Challenge Evolution, jeśli baza jest złapana.

### 3.6 Ewolucje

- Ewolucje odblokowane po złapaniu formy bazowej.
- Challenge Evolution uruchamia spotkanie o wyższym stopniu trudności (zgodnie ze stage).
- Złapanie ewolucji podlega tym samym regułom (3 pytania, 2/3 poprawnych, wariant shiny możliwy).

### 3.7 UX/UI i dostępność

- Responsywny interfejs (mobile i desktop); spójne stany ładowania, błędów i pustych widoków.
- Język interfejsu: EN.

  3.8 Analityka (MVP)

- Minimalna metryka: liczba złapanych Pokémonów per użytkownik (inkrementacja przy sukcesie).

## 4. Zakres produktu

### 4.1 Wchodzą w zakres MVP

- Logowanie Google, wylogowanie, stany błędu i retry.
- Seed offline Gen 1 (151) ze sprite URLs z PokeAPI; brak zapytań do PokeAPI w runtime.
- Wild encounter: formy bazowe; 3 pytania jednokrotnego wyboru; 2/3 = złapanie; 3 próby na te same pytania, po porażce sesja kończy się bez automatycznego rerollu.
- Generator zadań zgodny ze stage oraz zasadami dystraktorów opisanymi w 3.4; brak dzielenia; PRNG niedeterministyczny domyślnie; LRU in-memory po submit.
- Kolekcja: siatka, sort po Pokédex, filtry caught/uncaught, typ, shiny; sylwetki dla nieznanych.
- Detal Pokémona + Challenge Evolution (wyższy stage).
- Shiny: 1/100, wyłącznie po posiadaniu wariantu normal; badge/oznaczenia w UI.
- RLS: pokemon public read; captured_pokemon tylko właściciel; blokada duplikatów (user_id, pokemon_id, variant).
- Podstawowe stany ładowania i błędów; UI responsywne.

### 4.2 Poza zakresem MVP

- PWA/offline-first, leaderboardy, rankingi, rozbudowane profile, społeczności, płatności, sklep, subskrypcje.
- Panel administracyjny, moderacja, zaawansowana analityka i personalizacja.
- Złożone mechaniki (walki, trading, zaawansowane statusy/warunki).

### 4.3 Ograniczenia i budżety niefunkcjonalne

- Sprite’y Gen 1 pochodzą z oficjalnych danych PokeAPI (API/CDN), ale są **seedowane i referencjonowane jako statyczne zasoby** (np. lokalne WebP/PNG lub stabilne URL-e CDN).
- LCP p75 ≤ 2.5 s na docelowych urządzeniach.
- Brak zapytań do PokeAPI w runtime; wszystkie potrzebne dane są pobrane offline i znajdują się w bazie lub w repo.
- Sprite'y wykorzystują oficjalne zasoby PokeAPI wyłącznie jako źródło danych do seeda; runtime aplikacji nie wykonuje zapytań HTTP do API PokeAPI.

## 5. Historyjki użytkowników

### US-001

Tytuł: Logowanie Google  
Opis: Jako użytkownik chcę zalogować się przez Google, aby mieć własną kolekcję.  
Kryteria akceptacji:

- Na ekranie startowym widzę przycisk Sign in with Google.
- Po udanym logowaniu widzę ekran główny z możliwością rozpoczęcia encounteru.
- Sesja jest utrzymywana po odświeżeniu strony.
- Po wylogowaniu zostaję przeniesiony do ekranu logowania.

### US-002

Tytuł: Błąd logowania i ponowienie  
Opis: Jako użytkownik chcę zobaczyć czytelny błąd logowania i móc spróbować ponownie.  
Kryteria akceptacji:

- W przypadku błędu logowania widzę komunikat o błędzie.
- Mogę ponowić próbę logowania jednym kliknięciem.
- Nie jestem wpuszczany do aplikacji bez ważnej sesji.
- Po udanym ponowieniu trafiam do ekranu głównego.

### US-003

Tytuł: Wylogowanie  
Opis: Jako użytkownik chcę się wylogować, aby zakończyć sesję.  
Kryteria akceptacji:

- Z poziomu nawigacji mogę wybrać Sign out.
- Po wylogowaniu wracam na ekran logowania.
- Żadne widoki wymagające sesji nie są dostępne po wylogowaniu.
- Odświeżenie strony po wylogowaniu nie przywraca sesji.

### US-004

Tytuł: Rozpoczęcie wild encounter  
Opis: Jako zalogowany użytkownik chcę rozpocząć encounter z losowym bazowym Pokémonem.  
Kryteria akceptacji:

- Po wejściu do gry mogę uruchomić encounter.
- Wyświetla się losowy bazowy Pokémon z Gen 1 (możliwe powtórzenia).
- Jeśli wylosowano shiny (1/100 i wariant normal jest w kolekcji), widzę oznaczenia shiny.
- Nie są losowane formy nie-bazowe.

### US-005

Tytuł: Trzy pytania w encounterze  
Opis: Jako użytkownik chcę odpowiedzieć na 3 pytania z jedną poprawną odpowiedzią.  
Kryteria akceptacji:

- Każdy encounter zawiera dokładnie 3 pytania.
- Każde pytanie ma jedną poprawną odpowiedź i cztery warianty do wyboru; pozycje są losowe.
- Po udzieleniu odpowiedzi przechodzę do kolejnego pytania.
- Po 3. pytaniu widzę podsumowanie wyniku.

### US-006

Tytuł: Warunek złapania 2/3  
Opis: Jako użytkownik chcę złapać Pokémona po co najmniej 2 poprawnych odpowiedziach z 3.  
Kryteria akceptacji:

- Przy 2 lub 3 poprawnych odpowiedziach Pokémon zostaje złapany.
- Przy 0 lub 1 poprawnej odpowiedzi następuje porażka.
- Po złapaniu zapis trafia do captured_pokemon.
- Widzę potwierdzenie sukcesu lub porażki.

### US-007

Tytuł: Try again i limit 3 prób  
Opis: Jako użytkownik po porażce chcę móc spróbować ponownie do 3 razy.  
Kryteria akceptacji:

- Po porażce dostępny jest przycisk Try again.
- Wszystkie próby używają tego samego zestawu 3 pytań dla danego Pokémona.
- Po 3 nieudanych próbach sesja kończy się; aby grać dalej, uruchamiam nowy encounter.
- Licznik prób jest widoczny lub jednoznaczny w zachowaniu.

### US-008

Tytuł: Generator zadań zgodny ze stage  
Opis: Jako użytkownik chcę, aby poziom trudności zadań odpowiadał stage Pokémona.  
Kryteria akceptacji:

- stage 1: dod./odej. 5–99; mnożenie 2–12.
- stage 2: dod./odej. 10–120; mnożenie 3–12.
- stage 3: dod./odej. 25–200; mnożenie 7–12; operator w stage 3: 50% `*`, 25% `+`, 25% `-`.
- Wyniki całkowite, brak liczb ujemnych.

### US-009

Tytuł: Dystraktory i losowa pozycja poprawnej  
Opis: Jako użytkownik chcę realistycznych dystraktorów i losową kolejność odpowiedzi.  
Kryteria akceptacji:

- Dystraktory to losowe wartości w zakresie ±12 od poprawnej, bez duplikatów.
- Pozycja poprawnej odpowiedzi jest losowa w każdym pytaniu.
- Wskaźnik poprawnej nie jest przewidywalny między pytaniami.

### US-010

Tytuł: Deduplikacja pytań  
Opis: Jako użytkownik nie chcę widzieć powtarzających się pytań w krótkim czasie.

- Kryteria akceptacji:
  - PRNG seedowany parametrem `seed` lub domyślnie `${user_id}|${Date.now()}` (niedeterministyczny między próbami).
  - LRU in-memory przechowuje ~50 ostatnich ID pytań per użytkownik po submit; powtórki są możliwe.
  - Try again używa tego samego zestawu pytań w danym encounterze.

### US-011

Tytuł: Zapisanie złapania do kolekcji  
Opis: Jako użytkownik chcę, aby złapany Pokémon pojawił się w mojej kolekcji po odświeżeniu.

- Kryteria akceptacji:
  - Po sukcesie tworzony jest wpis w captured_pokemon.
  - Po odświeżeniu widzę złapanego Pokémona na liście.
  - Wpis zawiera wariant (normal/shiny) i captured_at.
  - Błąd zapisu prezentuje czytelny komunikat i nie duplikuje wpisów.

### US-012

Tytuł: Blokada duplikatów w kolekcji  
Opis: Jako użytkownik nie chcę duplikatów tego samego wariantu Pokémona.

- Kryteria akceptacji:
  - Nie można dodać wpisu z tą samą parą (user_id, pokemon_id, variant).
  - Próba ponownego złapania tego samego wariantu kończy się informacją o duplikacie.
  - Dozwolone jest posiadanie obu wariantów: normal i shiny.
  - Zasady wynikają z ograniczeń na poziomie bazy i RLS.

### US-013

Tytuł: Wyświetlanie kolekcji  
Opis: Jako użytkownik chcę przeglądać siatkę złapanych Pokémonów.

- Kryteria akceptacji:
  - Lista przedstawia sprite i nazwę.
  - Domyślny sort po numerze Pokédex.
  - Sylwetki dla Pokémonów nieznanych/niezłapanych.
  - Widoczne liczniki postępu X/151 i Shiny X.

### US-014

Tytuł: Filtry kolekcji  
Opis: Jako użytkownik chcę filtrować po caught/uncaught, typie i shiny.

- Kryteria akceptacji:
  - Filtr caught/uncaught działa zgodnie z aktualnym stanem kolekcji.
  - Filtr po typie zawęża listę do wybranego typu.
  - Filtr shiny pokazuje wyłącznie wariant shiny.
  - Filtry można resetować i łączyć.

### US-015

Tytuł: Podgląd detalu Pokémona  
Opis: Jako użytkownik chcę zobaczyć szczegóły i dostępne ewolucje.

- Kryteria akceptacji:
  - Widzę typy.
  - Widzę listę możliwych ewolucji.
  - Jeśli baza jest złapana, widzę CTA Challenge Evolution.
  - Brak błędów przy Pokémonach bez ewolucji.

### US-016

Tytuł: Challenge Evolution  
Opis: Jako użytkownik po złapaniu bazy chcę podjąć wyzwanie złapania ewolucji o wyższym stage.

- Kryteria akceptacji:
  - CTA dostępne tylko, jeśli baza jest złapana.
  - Encounter ewolucji używa zakresów i operatorów z 3.4; stage wynikowy to 2 lub 3 na podstawie głębokości łańcucha.
  - Zasady złapania identyczne (3 pytania, 2/3).
  - Po sukcesie ewolucja pojawia się w kolekcji.

### US-017

Tytuł: Wariant shiny  
Opis: Jako użytkownik chcę, aby rzadki wariant shiny był wyraźnie oznaczony.

- Kryteria akceptacji:
  - Encounter może być shiny z prawdopodobieństwem 1/100, wyłącznie gdy wariant normal jest już w kolekcji.
  - W UI widoczne jest odznaczenie shiny (np. badge, połysk).
  - Kolekcja rozróżnia normal vs shiny i aktualizuje licznik Shiny X.
  - Unikalność na poziomie wariantu jest respektowana.

### US-018

Tytuł: Stany ładowania i błędów  
Opis: Jako użytkownik chcę jasnych stanów ładowania i błędów.

- Kryteria akceptacji:
  - Widoki loading dla kluczowych operacji (logowanie, encounter, zapis).
  - Czytelne komunikaty błędów i możliwość ponawiania.
  - Brak nieobsłużonych wyjątków w konsoli w typowych ścieżkach.
  - UI pozostaje responsywne.

### US-019

Tytuł: Trwałość i odświeżenie strony  
Opis: Jako użytkownik chcę, aby wyniki były trwałe po przeładowaniu.

- Kryteria akceptacji:
  - Po odświeżeniu widzę ten sam stan kolekcji.
  - Brak duplikatów wpisów po odświeżeniu.
  - Sesja jest kontynuowana, jeśli nie wygasła.

### US-020

Tytuł: Ochrona danych i RLS  
Opis: Jako użytkownik chcę mieć pewność, że inni nie widzą moich danych.

- Kryteria akceptacji:
  - Zapytania do captured_pokemon innych użytkowników są blokowane przez RLS.
  - Próby dostępu do cudzych danych kończą się brakiem rekordów lub błędem uprawnień.
  - Widoki UI nigdy nie pokazują danych innego użytkownika.
  - Logowanie i sesje nie ujawniają identyfikatorów innych użytkowników.

### US-021

Tytuł: Brak wywołań PokeAPI w runtime  
Opis: Jako użytkownik (i zespół) chcę, by aplikacja nie łączyła się z PokeAPI podczas działania.

- Kryteria akceptacji:
  - Analiza ruchu sieciowego nie wykazuje żądań do domen PokeAPI w runtime.
  - Wszystkie dane i sprite’y pochodzą z seeda i repozytorium.
  - Aplikacja działa bez dostępu do PokeAPI.
  - Seed zapewnia kompletność danych dla Gen 1.

### US-022

Tytuł: Fallback zasobów graficznych  
Opis: Jako użytkownik chcę, aby brakujący sprite nie psuł działania aplikacji.

- Kryteria akceptacji:
  - Przy braku pliku grafiki renderowana jest sylwetka/placeholder.
  - Brak błędów krytycznych w konsoli przy brakach.
  - Miejsce i rozmiar obrazka pozostają spójne.
  - Log zawiera informację diagnostyczną (nieinwazyjną dla użytkownika).

### US-023

Tytuł: Responsywność mobilna  
Opis: Jako użytkownik mobilny chcę wygodnie korzystać z aplikacji na telefonie.

- Kryteria akceptacji:
  - Kluczowe widoki są czytelne i dotykowe elementy są wystarczająco duże.
  - Siatka kolekcji skaluje się do małych ekranów.
  - Brak poziomego przewijania w głównych widokach.
  - Wydajność pozwala na płynne działanie.

### US-024

Tytuł: Wydajność i LCP  
Opis: Jako użytkownik chcę, by aplikacja ładowała się szybko.

- Kryteria akceptacji:
  - p75 LCP ≤ 2.5 s dla strony startowej.
  - Sprite'y ładowane z PokeAPI CDN (GitHub).
  - Brak niepotrzebnych pakietów JS na ścieżce krytycznej.
  - Lazy loading zasobów poza widokiem.

### US-025

Tytuł: Wygasła sesja  
Opis: Jako użytkownik przy wygaśnięciu sesji chcę jasnego komunikatu i prostego ponownego logowania.

- Kryteria akceptacji:
  - Przy wygaśnięciu sesji widzę komunikat o konieczności zalogowania.
  - Po zalogowaniu wracam do poprzedniej ścieżki (o ile to bezpieczne).
  - Operacje chronione są zablokowane bez sesji.
  - Brak utraty spójności UI przy odświeżeniu.

US-026  
Tytuł: Minimalna analityka  
Opis: Jako zespół chcemy zliczać liczbę złapanych Pokémonów na użytkownika.

- Kryteria akceptacji:
  - Licznik zwiększa się wyłącznie po udanym złapaniu.
  - Nie zlicza się przy duplikacie zablokowanym przez unikalność.
  - Agregacja możliwa do odczytu per użytkownik i globalnie (bez PII).
  - Brak istotnego wpływu na wydajność UI.

### US-027

Tytuł: Wyświetlenie progresu użytkownika na Dashboardzie  
Opis: Jako zalogowany użytkownik chcę na Dashboardzie zobaczyć liczniki mojego postępu, aby wiedzieć, ile Pokémonów (w tym shiny) już złapałem.

- Kryteria akceptacji:
  - Po wejściu na `/dashboard` widzę powitanie z moim imieniem (z profilu).
  - Dashboard pokazuje dwa liczniki: „X / 151 Pokémon caught” oraz „X Shiny”.
  - Dane liczbowe pobierane są z `/api/collection/stats`.
  - Podczas ładowania widoczny jest skeleton loader; przy błędzie ­wersja error state z przyciskiem Retry.
  - Liczniki aktualizują się po każdym udanym złapaniu lub wylogowaniu/logowaniu (refetch).
  - Przy braku złapań pokazuje się licznik `0 / 151`, `0 Shiny`.
  - Komponent działa zarówno na desktopie, jak i mobile (responsywne rozmieszczenie).

### US-028

Tytuł: Lista ostatnich złapanych Pokémonów na Dashboardzie  
Opis: Jako użytkownik chcę na Dashboardzie widzieć listę moich ostatnich złapań, aby cieszyć się postępem i łatwo przejść do detalu Pokémona.

- Kryteria akceptacji:
  - Sekcja „Recent Captures” pokazuje od 3 do 5 ostatnich wpisów z `recentCaptures` otrzymanych z `/api/collection/stats`.
  - Każdy element zawiera sprite, nazwę i czas względny („2 hours ago”).
  - Lista jest przewijana horyzontalnie na mobile, w układzie grid na desktop.
  - Kliknięcie kafelka przekierowuje do `/pokemon/:id`.
  - Brak rekordów → pusty stan: „No captures yet” z CTA „Start Wild Encounter”.
  - Skeleton loaders w trakcie ładowania, error state z Retry przy problemach API.

### US-029

Tytuł: Rozpoczęcie Wild Encounter z poziomu Dashboardu  
Opis: Jako użytkownik chcę z Dashboardu jednym przyciskiem uruchomić nowe spotkanie z dzikim Pokémonem, aby natychmiast zacząć grać.

- Kryteria akceptacji:
  - Na Dashboardzie widoczny jest wyraźny CTA „Start Wild Encounter”.
  - Kliknięcie wysyła POST `/api/encounters/wild` i otwiera pełnoekranowy `EncounterModal`.
  - Podczas requestu przycisk przechodzi w stan „loading” (spinner, disabled).
  - Przy błędzie wywołania API pojawia się toast „Failed to start encounter”, a przycisk wraca do stanu aktywnego.
  - Po zamknięciu modala lub sukcesie encounteru Dashboard odświeża liczniki i Recent Captures.

## 6. Metryki sukcesu

- Funkcyjne: po zalogowaniu użytkownik może złapać co najmniej jednego Pokémona i zobaczyć go w kolekcji po odświeżeniu; RLS spełnia założenia; brak runtime wywołań PokeAPI.
- Użycie: minimalnie liczba złapanych Pokémonów per użytkownik; wskaźnik aktywacji (odsetek użytkowników, którzy złapali ≥1 w pierwszej sesji); czas do pierwszego złapania.
- Jakość i wydajność: p75 LCP ≤ 2.5 s; brak błędów krytycznych i nieobsłużonych wyjątków; kompletność seeda 100% dla Gen 1.
- Kolekcja: postęp X/151 i Shiny X widoczny i zgodny ze stanem danych; filtry działają zgodnie z kryteriami.
- Bezpieczeństwo: unikalność (user_id, pokemon_id, variant) egzekwowana; RLS uniemożliwia dostęp do cudzych rekordów.

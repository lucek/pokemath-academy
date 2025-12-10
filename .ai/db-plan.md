# PokéMath – PostgreSQL Schema

Uwzględniono dodatkowe wymagania:  
• `id`, `name`, `flavor_text` jako osobne kolumny.  
• `stats`, `sprites` przechowywane w oddzielnych kolumnach `JSONB`.  
• W `stats` znajdują się: `height`, `weight`, `hp`, `attack`, `defense`, `speed`.

---

## 1 Tabele, kolumny i ograniczenia

### 1.1 pokemon

| kolumna     | typ danych  | ograniczenia / domyślne                                                                                                                                                                              |
| ----------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| id          | INTEGER     | PRIMARY KEY                                                                                                                                                                                          |
| name        | TEXT        | NOT NULL, UNIQUE (case-insensitive)\*                                                                                                                                                                |
| stats       | JSONB       | NOT NULL – `{"height":…, "weight":…, "hp":…, "attack":…, "defense":…, "speed":…}`                                                                                                                    |
| sprites     | JSONB       | NOT NULL – struktura `sprites` wyprowadzona z PokeAPI (front_default/front_shiny itp.), używana jako źródło stabilnych URL-i do lokalnych lub CDN-owych sprite’ów (bez runtime calli do API PokeAPI) |
| flavor_text | TEXT        | NULL – Pokédex description (English, from Red version)                                                                                                                                               |
| region      | TEXT        | NULL (na razie zawsze `kanto`)                                                                                                                                                                       |
| created_at  | TIMESTAMPTZ | DEFAULT now()                                                                                                                                                                                        |

\* UNIQUE INDEX `pokemon_name_unique` ON `pokemon` (LOWER(name));  
GIN INDEX `pokemon_name_gin` USING gin (to_tsvector('simple', name));

---

### 1.2 types

(Nadal potrzebna do filtrowania po typie; zawiera słownik z 18 typami)

| kolumna | typ danych | ograniczenia    |
| ------- | ---------- | --------------- |
| id      | SMALLINT   | PRIMARY KEY     |
| name    | TEXT       | NOT NULL UNIQUE |

---

### 1.3 pokemon_types (łącznik wiele-do-wielu)

(zapewnia szybkie JOIN-y bez parsowania JSONB)

| kolumna    | typ danych | ograniczenia                                 |
| ---------- | ---------- | -------------------------------------------- |
| pokemon_id | INTEGER    | NOT NULL, FK → pokemon.id ON DELETE RESTRICT |
| type_id    | SMALLINT   | NOT NULL, FK → types.id ON DELETE RESTRICT   |
| slot       | SMALLINT   | NOT NULL (1 = primary, 2 = secondary)        |

PRIMARY KEY (pokemon_id, type_id)  
INDEX `pokemon_types_type_id_idx` ON pokemon_types(type_id);

---

### 1.4 pokemon_evolutions

| kolumna      | typ danych | ograniczenia                                 |
| ------------ | ---------- | -------------------------------------------- |
| base_id      | INTEGER    | NOT NULL, FK → pokemon.id ON DELETE RESTRICT |
| evolution_id | INTEGER    | NOT NULL, FK → pokemon.id ON DELETE RESTRICT |
| trigger      | JSONB      | NULL – warunki ewolucji (min_level, item …)  |

PRIMARY KEY (base_id, evolution_id);

---

### 1.5 variant_enum

```sql
CREATE TYPE variant_enum AS ENUM ('normal', 'shiny');
```

---

### 1.6 captured_pokemon

| kolumna     | typ danych   | ograniczenia                                    |
| ----------- | ------------ | ----------------------------------------------- |
| id          | BIGSERIAL    | PRIMARY KEY                                     |
| user_id     | UUID         | NOT NULL, FK → auth.users.id ON DELETE RESTRICT |
| pokemon_id  | INTEGER      | NOT NULL, FK → pokemon.id ON DELETE RESTRICT    |
| variant     | variant_enum | NOT NULL                                        |
| captured_at | TIMESTAMPTZ  | DEFAULT now()                                   |

UNIQUE (user_id, pokemon_id, variant)  
INDEX `captured_pokemon_user_idx` ON captured_pokemon(user_id);

---

### 1.7 profiles

| kolumna      | typ danych  | ograniczenia                                      |
| ------------ | ----------- | ------------------------------------------------- |
| user_id      | UUID        | PRIMARY KEY, FK → auth.users.id ON DELETE CASCADE |
| display_name | TEXT        | NULL                                              |
| avatar_url   | TEXT        | NULL                                              |
| created_at   | TIMESTAMPTZ | DEFAULT now()                                     |

---

### 1.8 Widoki

- **my_collection_vw** – JOIN captured_pokemon + pokemon + pokemon_types dla front-endu.
- **user_capture_stats** (MATERIALIZED) – liczniki złapień per user i globalnie.

---

## 2 Relacje

- pokemon 1––∞ pokemon_types
- types 1––∞ pokemon_types
- pokemon 1––∞ pokemon_evolutions (base / evolution)
- pokemon 1––∞ captured_pokemon
- auth.users 1––1 profiles
- auth.users 1––∞ captured_pokemon

---

## 3 Indeksy kluczowe

| indeks                    | tabela           | kolumny / wyrażenie         | cel                        |
| ------------------------- | ---------------- | --------------------------- | -------------------------- |
| pokemon_name_unique       | pokemon          | LOWER(name)                 | unikalność nazw            |
| pokemon_name_gin          | pokemon          | to_tsvector('simple', name) | wyszukiwanie pełnotekstowe |
| pokemon_types_type_id_idx | pokemon_types    | type_id                     | filtr kolekcji po typie    |
| captured_pokemon_user_idx | captured_pokemon | user_id                     | zapytania per użytkownik   |

---

## 4 Row-Level Security (RLS)

### pokemon, types, pokemon_types, pokemon_evolutions

```sql
ALTER TABLE <table> ENABLE ROW LEVEL SECURITY;
CREATE POLICY public_read_only ON <table>
    FOR SELECT USING (true);
```

### captured_pokemon

```sql
ALTER TABLE captured_pokemon ENABLE ROW LEVEL SECURITY;
CREATE POLICY captured_pokemon_owner
    ON captured_pokemon
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());
```

### profiles

```sql
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY profiles_owner
    ON profiles
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());
```

Widoki dziedziczą polityki z tabel źródłowych.

---

## 5 Uwagi projektowe

1. Dodatkowa tabela `pokemon_types` pozwala na szybkie filtrowanie bez parsowania JSON--> zapewnia optymalną wydajność UI (filtry typów, liczniki).
2. Brak partycjonowania – obecny wolumen < 1 mln rekordów; decyzja do ponownej oceny przy wzroście.
3. Materializowane widoki można odświeżać w cron/batch (np. `REFRESH MATERIALIZED VIEW CONCURRENTLY user_capture_stats;`).
4. Przy dużym ruchu można dodać indeks GIN na `sprites` / `types` dla specyficznych zapytań JSONB, ale nie jest to wymagane w MVP.

## 6 Uwagi implementacyjne

- API korzysta z widoku `pokemon_catalog_vw` (katalog Gen1 z polami `pokemon_id`, `pokemon_name`, `sprites`, `type_details`) do budowania placeholderów dla nie złapanych pozycji w kolekcji.
- Sesje encounterów oraz limity RPS są utrzymywane w pamięci procesu (Map w globalThis); brak persystencji w DB/Redis, co wymaga zewnętrznego magazynu w środowisku multi-instance.
- LRU pytań działa in-memory (50 ID) i nie ma odpowiednika w schemacie DB; generator nie zapisuje historii w bazie.
- Sprawdzenie wariantu shiny odwołuje się do `captured_pokemon` (wymaga posiadania wariantu normal danego Pokémona przed shiny).

# A6. System wspomagający planowanie wizyt i badań kontrolnych

## 1. Opis projektu

Aplikacja umożliwiająca zapisywanie terminów badań i wizyt kontrolnych oraz generowanie przypomnień o nadchodzących wydarzeniach. System wspomaga użytkownika w planowaniu wizyt i badań poprzez obsługę kalendarza, terminów cyklicznych oraz powiadomień.

## 2. Funkcjonalności

- Zapisywanie terminów badań i wizyt kontrolnych.
- Wyświetlanie zaplanowanych terminów w kalendarzu.
- Obsługa terminów cyklicznych (np. badania co 6 miesięcy).
- Generowanie i wyświetlanie powiadomień przypominających o nadchodzących badaniach i wizytach.

## 3. Cel projektu

Celem projektu jest stworzenie aplikacji wspomagającej planowanie badań i wizyt kontrolnych, umożliwiającej wygodne zarządzanie terminami oraz przypominającej użytkownikowi o nadchodzących wydarzeniach.

## 4. Technologie

- Node.js 22 + TypeScript
- MySQL 8.4
- HTML, CSS, JavaScript
- Docker, Docker Compose

## 5. Konfiguracja Docker

Środowisko Docker składa się z dwóch serwisów:

- `app` – aplikacja Node.js, domyślnie na porcie `3000`,
- `mysql` – baza MySQL 8.4, domyślnie na porcie `3306`.

Dane bazy oraz zależności aplikacji są przechowywane w wolumenach `mysql_data` i `node_modules`. Serwis `app` uruchamia się po pozytywnym wyniku healthchecka MySQL.

Schemat z pliku `database/schema.sql` jest importowany automatycznie podczas pierwszego utworzenia wolumenu MySQL. Zawiera tabele `users`, `appointments`, `recurrence_rules` i `notifications`.

### Konfiguracja

Lokalną konfigurację należy utworzyć bazując na `.env.example`:

```bash
cp .env.example .env
```

Plik `.env` zawiera lokalne porty i dane dostępowe do MySQL, dlatego nie jest wersjonowany.

### Uruchomienie

```bash
# sama baza danych
docker compose up -d mysql

# całe środowisko
docker compose up --build

# status i logi
docker compose ps
docker compose logs -f

# zatrzymanie środowiska
docker compose down

# usunięcie kontenerów oraz danych lokalnych
docker compose down --volumes
```

Po uruchomieniu stan serwera i połączenia z MySQL można sprawdzić pod adresem `http://localhost:3000/health`. Poprawne połączenie zwraca status HTTP `200` oraz odpowiedź:

```json
{
  "status": "ok",
  "database": "connected"
}
```

`Dockerfile` zawiera etapy `development`, `build` i `production`. Docker Compose korzysta z etapu deweloperskiego.

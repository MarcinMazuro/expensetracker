# ExpenseTracker - brief dla agenta

Aplikacja Marcina (mazuromarcin@gmail.com, gcloud mazuromarcin1@gmail.com) do
kontroli wydatków dla kilku osób na osobnych kontach. Rozmowy po polsku.
Docelowo publiczne repo `MarcinMazuro/expensetracker` (portfolio).

Stack i wzorce skopiowane z `../MarcinMazuro` i `../AgnieszkaBielawa` - ich
pułapki (`../AgnieszkaBielawa/.claude/docs/pulapki.md`) obowiązują też tu.
Własne pułapki: `.claude/docs/pulapki.md`. Stan: `.claude/docs/stan.md`.

## Stack
Next.js 16.3.8 + React 19.2 + Tailwind v4, Server Actions. Cloud Run
`expensetracker-web` (europe-west1), Firestore `(default)` eur3 + baza
`development` do pracy lokalnej, kubełek `expensetracker-mm-receipts`,
Gemini `gemini-3.8-flash` przez Vertex AI (lokalizacja `global`). Wszystko
w Terraform (`terraform/`, stan `gs://expensetracker-mm-tfstate/production`).
Projekt GCP `expensetracker-mm` (nr 183279256871), konto próbne.

## Mapa kodu
Kod, komentarze, testy, Terraform, commity PO ANGIELSKU; UI po polsku.
- `src/lib/` - czyste funkcje (money, dates, stats, csv, filters, text,
  validation, recurring-schedule, ai/receipt-schema, token, access,
  google-oauth, household, products) mają
  testy w `tests/`. Moduły z `import "server-only"` gadają z GCP.
- Dane per użytkownik pod `users/{uid}/...` - własność wynika ze ścieżki.
  Każda strona i akcja woła `requireUser()` (session.ts); `proxy.ts` to tylko
  szybkie przekierowanie bez ciasteczka.
- Logowanie tylko Google (`api/auth/google`, `.../callback`, `lib/google-oauth.ts`),
  lista dostępu `allowed_emails` w Terraformie. Hasła usunięte (2026-11-05).
  Lokalnie `DEV_LOGIN=true` + baza development = przyciski „zaloguj jako”
  (`api/auth/dev`, blokada w `devLoginEnabled`). Dane demo: `npm run seed-demo`.
- Widok „Razem” (`/together`, `lib/household.ts`): wszyscy aktywni użytkownicy
  to jedno gospodarstwo. Kategorie łączone po nazwie. Kolor i awatar osoby
  (`user.color`, `user.avatar` lion/puma, `public/avatars`) wszędzie te same.
- Wydatki wspólne (`lib/expense-writer.ts` `writeExpense`, czysta logika w
  `lib/sharing.ts` `divide`): kopia u każdego uczestnika pod TYM SAMYM id z jego
  częścią kwoty i pozycji. Pełna wersja (wszystkie pozycje w `shared.items`,
  ukryte też) tylko na koncie „home” (`shared.home`, kto dodał; stare kopie:
  płacący). Podział: `shared.weights` (procenty) albo pozycja przypisana jednej
  osobie (`item.assign`). Grosz reszty dostaje płacący. Kopia dłużnika ma
  `unsettled: true`, aż ktoś kliknie „Oddane” (`setSettled`, `shared.settled`);
  lista „Do oddania” w `/together` jest za cały czas (`listUnsettled`, `settlement`).
- Pełny dostęp w gospodarstwie (decyzja Marcina 2026-11-05): każdy aktywny
  użytkownik widzi, edytuje i usuwa wydatki drugiego. Czyje dane - `?u=<id>`
  rozwiązywane przez `resolveOwner` (`lib/people.ts`), akcje dostają `owner`
  z formularza. `updatedBy` pokazuje, kto zmienił cudzy wydatek.
- Pozycje wpisywane ręcznie: `parseItemsJson`, produkt/grupa z pamięci
  produktów albo `classifyItems` (Gemini) w `completeItems`.
- Ukryte wydatki i ukryte pozycje (`lib/visibility.ts`, pola `hidden`,
  `hiddenUntil`, `item.hidden`): druga osoba nie widzi ich nigdzie, a cena
  ukrytej pozycji schodzi z każdej kwoty, którą widzi. Każdy odczyt cudzych
  danych MUSI iść przez `listVisibleExpenses`/`getVisibleExpense`/`loadWhole`/
  `loadHousehold(viewer, ...)` (wszystkie przez `projectFor`). Ukrywać może
  tylko konto „home”; ukryta pozycja jest zawsze jego. Odkrycie o czasie
  liczone przy odczycie i utrwalane przez `revealDue` w layoucie, ręczne
  `revealExpense`. Cały wspólny wydatek nie może być ukryty (pozycje mogą).
  Ukryte nie trafiają do pamięci sklepów i produktów. Zdjęcie paragonu
  zostaje bez zmian (decyzja Marcina).
- Motywy (`lib/theme.ts`): ciasteczko `et_theme`, na urządzenie, `data-theme` na
  `html`; auto, jasny, ciemny, serduszka, święta (śnieg, lampki, czapki -
  `Ambient.tsx`, `SantaHat.tsx`). Animacje i klasy w `globals.css`.
- Lew i puma w pozach: `lib/animals.ts`, `components/Animal.tsx`, zdjęcia z
  Wikimedia Commons w `public/animals` (w repo, licencje w `CREDITS.md` i w
  Ustawieniach). Komunikat po zapisie: `lib/flash.ts` + `Toast.tsx`.
- Prognozy (`pace`, `budgets` w `lib/stats.ts`): tempo liczone tylko z wydatków
  bieżących, cykliczne (`source: "recurring"`) wchodzą raz, razem z jeszcze
  niezaksięgowanymi (`upcomingCharges`). Średnia dzienna = prognoza / dni miesiąca.
- Kwoty zawsze w groszach (int). `amountPln` liczone kursem NBP z dnia wydatku.
- Akcje w `src/app/actions/`, strony w `src/app/(app)/`.
- Skaner: `scan/ReceiptScanner.tsx` -> `scanReceipt` -> `lib/ai/gemini.ts`.
- Produkty: pozycje paragonu (`expense.items`) mają `product`, `quantity`,
  `unit` (kg/l/szt), `group` (`lib/product-groups.ts`). Statystyki liczy
  `lib/products.ts` w pamięci; katalog nazw `users/{uid}/products` idzie do
  promptu, żeby nazwy się nie rozjeżdżały. Paragony sprzed tej zmiany mają
  tylko `name` i `amount` - liczą się jako 1 szt., grupa „Inne”.

## Zasady
- Bez pauz i półpauz w treściach: tylko `-`.
- Zmiany najpierw lokalnie (`PORT=3002 npm run start` po build, baza
  development), wdrożenie dopiero na słowo Marcina.
- Commity po angielsku, bez `Co-Authored-By` i wzmianek o AI.

## Polecenia
```bash
npm run lint && npm test && npm run build
npm run seed-demo && node scripts/browser-test.mjs http://localhost:3002 /tmp/shots paragon.jpg
cd terraform && terraform plan   # oczekiwane: No changes
```
Konta demo w bazie development: Marcin (lew) i Agnieszka (puma), z seed-demo.

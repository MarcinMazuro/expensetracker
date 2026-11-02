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
  validation, recurring-schedule, ai/receipt-schema, token, password) mają
  testy w `tests/`. Moduły z `import "server-only"` gadają z GCP.
- Dane per użytkownik pod `users/{uid}/...` - własność wynika ze ścieżki.
  Każda strona i akcja woła `requireUser()` (session.ts); `proxy.ts` to tylko
  szybkie przekierowanie bez ciasteczka.
- Kwoty zawsze w groszach (int). `amountPln` liczone kursem NBP z dnia wydatku.
- Akcje w `src/app/actions/`, strony w `src/app/(app)/`.
- Skaner: `scan/ReceiptScanner.tsx` -> `scanReceipt` -> `lib/ai/gemini.ts`.

## Zasady
- Bez pauz i półpauz w treściach: tylko `-`.
- Zmiany najpierw lokalnie (`PORT=3002 npm run start` po build, baza
  development), wdrożenie dopiero na słowo Marcina.
- Commity po angielsku, bez `Co-Authored-By` i wzmianek o AI.

## Polecenia
```bash
npm run lint && npm test && npm run build
EMAIL=test@example.com PASSWORD=... node scripts/browser-test.mjs http://localhost:3002 /tmp/shots paragon.jpg
cd terraform && terraform plan   # oczekiwane: No changes
```
Konto testowe w bazie development: test@example.com (hasło w pamięci agenta, nie w repo).

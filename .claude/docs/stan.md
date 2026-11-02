# Stan projektu

Ostatnia aktualizacja: 2026-11-02.

## Zrobione
- Projekt GCP `expensetracker-mm`, billing, stan Terraform, cała
  infrastruktura zastosowana (plan: No changes).
- Na produkcji: `c56a9fb`, https://expensetracker-web-btybm7xf3a-ew.a.run.app
  (repo publiczne https://github.com/MarcinMazuro/expensetracker, CI zielone).
- Aplikacja: logowanie, admin kont, pulpit, wydatki, skaner paragonów,
  podpowiedzi kategorii, budżety, cykliczne, raporty, CSV, waluty (NBP).
- 66 testów jednostkowych + test e2e w Chrome (przechodzi lokalnie).

## Czeka
1. Pierwszy admin w produkcji: `npm run create-user -- --email ... --role admin`
   (hasło wpisuje Marcin).
2. Opcjonalnie: domena, PWA offline, wspólne budżety/gospodarstwa domowe.

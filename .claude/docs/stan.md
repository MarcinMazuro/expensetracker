# Stan projektu

Ostatnia aktualizacja: 2026-11-02.

## Zrobione
- Projekt GCP `expensetracker-mm`, billing, stan Terraform, cała
  infrastruktura zastosowana (plan: No changes). Cloud Run stoi na obrazie
  startowym Google - aplikacja jeszcze NIE wdrożona.
- Aplikacja: logowanie, admin kont, pulpit, wydatki, skaner paragonów,
  podpowiedzi kategorii, budżety, cykliczne, raporty, CSV, waluty (NBP).
- 66 testów jednostkowych + test e2e w Chrome (przechodzi lokalnie).

## Czeka
1. Repo GitHub `MarcinMazuro/expensetracker` + pierwszy push (wdrożenie przez CI).
2. Pierwszy admin w produkcji: `npm run create-user -- --email ... --role admin`
   (hasło wpisuje Marcin).
3. Opcjonalnie: domena, PWA offline, wspólne budżety/gospodarstwa domowe.

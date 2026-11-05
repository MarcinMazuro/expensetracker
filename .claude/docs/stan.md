# Stan projektu

Ostatnia aktualizacja: 2026-11-02.

## Zrobione
- Projekt GCP `expensetracker-mm`, billing, stan Terraform, cała
  infrastruktura zastosowana (plan: No changes).
- Na produkcji: `c56a9fb`, https://expensetracker-web-btybm7xf3a-ew.a.run.app
  (repo publiczne https://github.com/MarcinMazuro/expensetracker, CI zielone).
- Aplikacja: logowanie, admin kont, pulpit, wydatki, skaner paragonów,
  podpowiedzi kategorii, budżety, cykliczne, raporty, CSV, waluty (NBP).
- Statystyki produktów (2026-11-02): ilości kg/l/szt., grupy, cena za kg,
  najtańszy sklep. Ręczne wydatki nie mają pozycji, więc ich tu nie ma.
- 77 testów jednostkowych + test e2e w Chrome (przechodzi lokalnie).

- 2026-11-05 (lokalnie, niewdrożone): logowanie Google + lista dostępu,
  widok „Razem”, awatary lew/puma, dane demo.

## Czeka
1. Klient OAuth w konsoli, sekret, `terraform apply -var google_oauth_client_id=...`
   (po zielonym CI), pierwsze logowanie obojga.
2. Opcjonalnie: domena, PWA offline, wspólne budżety/gospodarstwa domowe.

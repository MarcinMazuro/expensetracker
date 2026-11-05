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

- 2026-11-05 na produkcji (`f96ccdf`, wdrożone ręcznie przez Cloud Build):
  logowanie Google + lista dostępu, widok „Razem”, awatary lew/puma.
  Klient OAuth i sekret ustawione, Google akceptuje adres powrotu.

## Czeka
1. Pierwsze logowanie Marcina i Agnieszki przez Google (konta powstaną same).
2. Konto GitHub zablokowane przez płatności - Actions nie startują. Do czasu
   naprawy wdrożenie ręcznie (patrz pułapka 12).
2. Opcjonalnie: domena, PWA offline, wspólne budżety/gospodarstwa domowe.

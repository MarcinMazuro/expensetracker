# Pułapki ExpenseTracker

1. **Nowy projekt GCP:** przed pierwszym `terraform apply` włączyć ręcznie
   `cloudresourcemanager` i `iam`. Potem przez kilka minut apply potrafi
   dawać 403 „API has not been used” mimo włączonego API - po prostu ponowić.
2. **Gemini tylko w `global`.** W europe-west1 modele 3.x dają 404.
3. **`thinkingLevel: MINIMAL`** - `gemini-3.8-flash` odrzuca (400). Używać `LOW`.
4. **Nazwa bazy Firestore** min. 4 znaki (`dev` odpada -> `development`).
5. **zsh i `$VAR:costam`** - `:g`, `:h` itd. to modyfikatory; w URL-ach pisać `${VAR}`.
6. **Sekret sesji musi mieć wersję** przed utworzeniem usługi Cloud Run.
7. **Cloud Run `scaling` na poziomie usługi** - w `ignore_changes`, inaczej wieczny diff.
8. **Formularze z akcją w React 19 resetują się** po wysłaniu - wartości do
   zachowania zwracać w stanie akcji (patrz `LoginState`).
9. **Klienta OAuth Google nie da się utworzyć z CLI ani Terraformu** - tylko
   w konsoli (Google Auth Platform). Terraform trzyma ID (zmienna) i pusty
   sekret; `GOOGLE_CLIENT_*` wchodzą do Cloud Run dopiero, gdy
   `google_oauth_client_id` jest ustawione, a sekret ma wersję.
10. **Porównania „m-c do m-ca” w bieżącym miesiącu** liczyć do tego samego dnia
    (`personTotals(..., today)`), inaczej 5 dni listopada wygląda jak -88%.
11. **Zdjęcia lwa i pumy** to prawdopodobnie zdjęcia stockowe, a repo jest
    publiczne - są w `.gitignore`. Źródło prawdy: `gs://expensetracker-mm-assets/avatars`
    (Cloud Build kopiuje je do `public/avatars` przed buildem). Po zmianie
    awatara lokalnie: `gcloud storage cp public/avatars/*.webp gs://expensetracker-mm-assets/avatars/`.

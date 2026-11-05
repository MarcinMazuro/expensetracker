/*
  Terraform creates only the secret container. The value is added with
  gcloud (see README), so it never lands in the Terraform state, which
  anyone with access to the state bucket can read.
*/
resource "google_secret_manager_secret" "session" {
  project   = var.project
  secret_id = "session-secret"

  replication {
    auto {}
  }

  depends_on = [google_project_service.enabled]
}

resource "google_secret_manager_secret_iam_member" "app_reads_session" {
  project   = var.project
  secret_id = google_secret_manager_secret.session.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.web_app.email}"
}

# Client secret of the Google OAuth web client - value added with gcloud,
# like the session key
resource "google_secret_manager_secret" "google_oauth" {
  project   = var.project
  secret_id = "google-oauth-client-secret"

  replication {
    auto {}
  }

  depends_on = [google_project_service.enabled]
}

resource "google_secret_manager_secret_iam_member" "app_reads_google_oauth" {
  project   = var.project
  secret_id = google_secret_manager_secret.google_oauth.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.web_app.email}"
}

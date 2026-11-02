# Production data. eur3 is a European multi-region - keeps data in the EU
# and survives a regional outage.
resource "google_firestore_database" "default" {
  project     = var.project
  name        = "(default)"
  location_id = "eur3"
  type        = "FIRESTORE_NATIVE"

  delete_protection_state = "DELETE_PROTECTION_ENABLED"
  deletion_policy         = "ABANDON"

  depends_on = [google_project_service.enabled]
}

# Separate database for local development (FIRESTORE_DATABASE=development), so
# experiments never touch real expenses. Single region - it is disposable.
resource "google_firestore_database" "dev" {
  project     = var.project
  name        = "development"
  location_id = var.region
  type        = "FIRESTORE_NATIVE"

  delete_protection_state = "DELETE_PROTECTION_DISABLED"
  deletion_policy         = "DELETE"

  depends_on = [google_project_service.enabled]
}

# Daily managed backup of production, kept for 14 days, restored with one
# gcloud command (gcloud firestore databases restore ...)
resource "google_firestore_backup_schedule" "daily" {
  project   = var.project
  database  = google_firestore_database.default.name
  retention = "1209600s" # 14 days

  daily_recurrence {}
}

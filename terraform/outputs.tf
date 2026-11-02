output "service_url" {
  description = "Cloud Run URL serving the app"
  value       = google_cloud_run_v2_service.web.uri
}

output "app_service_account" {
  description = "Service account the app runs as"
  value       = google_service_account.web_app.email
}

output "receipts_bucket" {
  description = "Private bucket with receipt photos"
  value       = google_storage_bucket.receipts.name
}

output "wif_provider" {
  description = "Identity provider for GitHub Actions"
  value       = google_iam_workload_identity_pool_provider.github.name
}

resource "google_artifact_registry_repository" "web" {
  project       = var.project
  location      = var.region
  repository_id = "web"
  format        = "DOCKER"
  description   = "Web application images"

  # Every push to main adds an image; keep the last 10 for rollbacks and
  # delete the rest so storage does not grow forever
  cleanup_policy_dry_run = false
  cleanup_policies {
    id     = "keep-recent"
    action = "KEEP"
    most_recent_versions {
      keep_count = 10
    }
  }
  cleanup_policies {
    id     = "delete-old"
    action = "DELETE"
    condition {
      older_than = "2592000s" # 30 days
    }
  }

  depends_on = [google_project_service.enabled]
}

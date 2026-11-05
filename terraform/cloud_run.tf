# Identity the app runs as - only what it needs: its database, its bucket,
# the session secret and calling Gemini
resource "google_service_account" "web_app" {
  project      = var.project
  account_id   = "web-app"
  display_name = "Web app on Cloud Run"
}

resource "google_project_iam_member" "web_app" {
  for_each = toset([
    "roles/datastore.user",
    "roles/aiplatform.user",
  ])

  project = var.project
  role    = each.value
  member  = "serviceAccount:${google_service_account.web_app.email}"
}

resource "google_storage_bucket_iam_member" "web_app_receipts" {
  bucket = google_storage_bucket.receipts.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.web_app.email}"
}

resource "google_cloud_run_v2_service" "web" {
  project             = var.project
  name                = "expensetracker-web"
  location            = var.region
  deletion_protection = false
  ingress             = "INGRESS_TRAFFIC_ALL"

  template {
    service_account = google_service_account.web_app.email
    # Reading a receipt takes up to a minute
    timeout = "120s"

    scaling {
      # A handful of users - a cold start of a few seconds is fine, and an
      # idle service costs nothing
      min_instance_count = 0
      max_instance_count = 2
    }

    containers {
      # Google's starter image; the pipeline swaps in the real one on deploy
      image = "us-docker.pkg.dev/cloudrun/container/hello"

      ports {
        container_port = 8080
      }

      resources {
        limits = {
          cpu = "1"
          # Receipt photos are held in memory while they go to Storage and Gemini
          memory = "1Gi"
        }
        cpu_idle          = true
        startup_cpu_boost = true
      }

      env {
        name  = "GOOGLE_CLOUD_PROJECT"
        value = var.project
      }

      env {
        name  = "RECEIPTS_BUCKET"
        value = google_storage_bucket.receipts.name
      }

      env {
        name  = "GEMINI_MODEL"
        value = var.gemini_model
      }

      # Current Gemini models are served from the global endpoint only
      env {
        name  = "GEMINI_LOCATION"
        value = "global"
      }

      # Key that signs session cookies. The secret must have a version
      # before this is applied, otherwise the revision will not start
      env {
        name = "SESSION_SECRET"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.session.secret_id
            version = "latest"
          }
        }
      }

      env {
        name  = "APP_URL"
        value = var.app_url
      }

      # Who may sign in - granting access is a reviewed change here, not a button in the app
      env {
        name  = "ALLOWED_EMAILS"
        value = join(",", var.allowed_emails)
      }

      env {
        name  = "ADMIN_EMAILS"
        value = join(",", var.admin_emails)
      }

      env {
        name  = "DEFAULT_AVATARS"
        value = join(",", [for email, avatar in var.default_avatars : "${email}=${avatar}"])
      }

      # Google sign-in, only once the OAuth client exists and its secret has a
      # version - otherwise the new revision would not start
      dynamic "env" {
        for_each = var.google_oauth_client_id != "" ? [var.google_oauth_client_id] : []
        content {
          name  = "GOOGLE_CLIENT_ID"
          value = env.value
        }
      }

      dynamic "env" {
        for_each = var.google_oauth_client_id != "" ? ["GOOGLE_CLIENT_SECRET"] : []
        content {
          name = env.value
          value_source {
            secret_key_ref {
              secret  = google_secret_manager_secret.google_oauth.secret_id
              version = "latest"
            }
          }
        }
      }

      startup_probe {
        http_get {
          path = "/api/health"
        }
        initial_delay_seconds = 2
        period_seconds        = 5
        failure_threshold     = 6
      }
    }
  }

  lifecycle {
    # The pipeline replaces the image on every deploy. If Terraform managed
    # it, it would roll production back to the version in this file.
    ignore_changes = [
      template[0].containers[0].image,
      template[0].revision,
      template[0].labels,
      client,
      client_version,
      # Service-level scaling Google fills in by itself (not template.scaling)
      scaling,
    ]
  }

  depends_on = [
    google_project_service.enabled,
    google_secret_manager_secret_iam_member.app_reads_session,
    google_secret_manager_secret_iam_member.app_reads_google_oauth,
  ]
}

# The app has its own login, so Cloud Run itself is public
resource "google_cloud_run_v2_service_iam_member" "public" {
  project  = var.project
  location = var.region
  name     = google_cloud_run_v2_service.web.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

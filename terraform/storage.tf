# Receipt photos. Private - the app streams them to their owner after
# checking the session. Same region as Cloud Run: no egress cost between them.
resource "google_storage_bucket" "receipts" {
  name                        = "${var.project}-receipts"
  project                     = var.project
  location                    = upper(var.region)
  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"
  force_destroy               = false

  # Photos taken during local development are deleted after a month
  lifecycle_rule {
    condition {
      age            = 30
      matches_prefix = ["dev/"]
    }
    action {
      type = "Delete"
    }
  }

  # Older photos move to cheaper storage - they are rarely opened again
  lifecycle_rule {
    condition {
      age                   = 90
      matches_prefix        = ["receipts/"]
      matches_storage_class = ["STANDARD"]
    }
    action {
      type          = "SetStorageClass"
      storage_class = "NEARLINE"
    }
  }

  depends_on = [google_project_service.enabled]
}

# Terraform state. Created by hand because it had to exist before the first
# run - described here so its settings are visible and kept.
resource "google_storage_bucket" "tfstate" {
  name                        = "${var.project}-tfstate"
  project                     = var.project
  location                    = upper(var.region)
  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"
  force_destroy               = false

  versioning {
    enabled = true
  }
}

import {
  to = google_storage_bucket.tfstate
  id = "expensetracker-mm-tfstate"
}

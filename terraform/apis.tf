locals {
  enabled_apis = [
    # These two must be enabled by hand on a brand-new project before the
    # first apply (gcloud services enable ...) - Terraform needs them to manage the rest
    "cloudresourcemanager.googleapis.com",
    "iam.googleapis.com",
    "run.googleapis.com",
    "cloudbuild.googleapis.com",
    "artifactregistry.googleapis.com",
    "firestore.googleapis.com",
    "iamcredentials.googleapis.com",
    "sts.googleapis.com",
    "storage.googleapis.com",
    "secretmanager.googleapis.com",
    "aiplatform.googleapis.com",
    "monitoring.googleapis.com",
    "billingbudgets.googleapis.com",
    # Creates the default Compute service account Cloud Build builds and deploys with
    "compute.googleapis.com",
  ]
}

resource "google_project_service" "enabled" {
  for_each = toset(local.enabled_apis)

  project = var.project
  service = each.value

  # Disabling an API when a Terraform resource is removed could take down
  # production, so we never do it
  disable_on_destroy = false
}

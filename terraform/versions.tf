terraform {
  required_version = ">= 1.8"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 6.0"
    }
  }

  # The bucket was created by hand before the first run - see storage.tf
  backend "gcs" {
    bucket = "expensetracker-mm-tfstate"
    prefix = "production"
  }
}

provider "google" {
  project = var.project
  region  = var.region
  # The budget API is billed to and checked against this project
  billing_project       = var.project
  user_project_override = true
}

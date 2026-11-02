variable "project" {
  description = "GCP project ID"
  type        = string
  default     = "expensetracker-mm"
}

variable "project_number" {
  description = "GCP project number, used by Workload Identity Federation"
  type        = string
  default     = "183279256871"
}

variable "billing_account" {
  description = "Billing account the project is linked to (for the cost budget)"
  type        = string
  default     = "0198A7-7713A1-EE89F7"
}

variable "region" {
  description = "Service region. europe-central2 is out: it does not allow Cloud Run domain mappings"
  type        = string
  default     = "europe-west1"
}

variable "github_repository" {
  description = "The only repository allowed to deploy via OIDC"
  type        = string
  default     = "MarcinMazuro/expensetracker"
}

variable "alert_email" {
  description = "Where outage and budget alerts go"
  type        = string
  default     = "mazuromarcin@gmail.com"
}

variable "gemini_model" {
  description = "Gemini model that reads receipts and suggests categories"
  type        = string
  default     = "gemini-3.8-flash"
}

variable "monthly_budget_pln" {
  description = "Monthly cloud spend that triggers budget e-mails (50%, 90%, 100%)"
  type        = number
  default     = 30
}

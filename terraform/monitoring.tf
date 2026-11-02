/*
  Monitoring: Google checks /api/health (app + database) every 5 minutes
  from several places. An e-mail arrives when it fails, and when the cloud
  bill heads past the monthly budget.
*/
resource "google_monitoring_notification_channel" "email" {
  project      = var.project
  display_name = "ExpenseTracker alerts"
  type         = "email"
  labels = {
    email_address = var.alert_email
  }
  depends_on = [google_project_service.enabled]
}

locals {
  service_host = trimprefix(google_cloud_run_v2_service.web.uri, "https://")
}

resource "google_monitoring_uptime_check_config" "health" {
  project      = var.project
  display_name = "ExpenseTracker health"
  timeout      = "10s"
  period       = "300s"

  http_check {
    path         = "/api/health"
    port         = 443
    use_ssl      = true
    validate_ssl = true
  }

  content_matchers {
    content = "\"ok\":true"
    matcher = "CONTAINS_STRING"
  }

  monitored_resource {
    type = "uptime_url"
    labels = {
      project_id = var.project
      host       = local.service_host
    }
  }
  depends_on = [google_project_service.enabled]
}

resource "google_monitoring_alert_policy" "down" {
  project      = var.project
  display_name = "ExpenseTracker is down"
  combiner     = "OR"

  conditions {
    display_name = "Health check failing"
    condition_threshold {
      filter          = "metric.type=\"monitoring.googleapis.com/uptime_check/check_passed\" AND metric.label.check_id=\"${google_monitoring_uptime_check_config.health.uptime_check_id}\" AND resource.type=\"uptime_url\""
      duration        = "300s"
      comparison      = "COMPARISON_GT"
      threshold_value = 1
      aggregations {
        alignment_period     = "1200s"
        per_series_aligner   = "ALIGN_NEXT_OLDER"
        cross_series_reducer = "REDUCE_COUNT_FALSE"
        group_by_fields      = ["resource.label.*"]
      }
      trigger {
        count = 1
      }
    }
  }

  documentation {
    content = "/api/health has been failing from more than one location for 5 minutes. Logs: Cloud Run > expensetracker-web > Logs."
  }

  notification_channels = [google_monitoring_notification_channel.email.id]
}

# An expense tracker should watch its own costs too
resource "google_billing_budget" "monthly" {
  billing_account = var.billing_account
  display_name    = "ExpenseTracker monthly"

  budget_filter {
    projects = ["projects/${var.project_number}"]
  }

  amount {
    specified_amount {
      currency_code = "PLN"
      units         = tostring(var.monthly_budget_pln)
    }
  }

  dynamic "threshold_rules" {
    for_each = [0.5, 0.9, 1.0]
    content {
      threshold_percent = threshold_rules.value
    }
  }

  all_updates_rule {
    monitoring_notification_channels = [google_monitoring_notification_channel.email.id]
    disable_default_iam_recipients   = false
  }

  depends_on = [google_project_service.enabled]
}

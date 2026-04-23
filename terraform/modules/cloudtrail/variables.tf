variable "project_name" {
  description = "Project name prefix"
}

variable "aws_region" {
  description = "AWS region"
}

variable "audit_bucket_name" {
  description = "Audit bucket name"
}

variable "primary_bucket_arn" {
  description = "Primary bucket ARN"
}

variable "kms_key_arn" {
  description = "KMS key ARN"
}

variable "lambda_anomaly_arn" {
  description = "Anomaly Lambda ARN"
}

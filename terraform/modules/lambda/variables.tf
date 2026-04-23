variable "project_name" {
  description = "Project name prefix"
}

variable "aws_region" {
  description = "AWS region"
}

variable "s3_primary_bucket" {
  description = "Primary S3 bucket name"
}

variable "sagemaker_nlp_endpoint_name" {
  description = "SageMaker NLP endpoint name"
}

variable "sagemaker_anomaly_endpoint_name" {
  description = "SageMaker anomaly endpoint name"
}

variable "sns_alert_topic_arn" {
  description = "SNS alert topic ARN"
}

variable "lambda_presign_role_arn" {
  description = "Pre-sign Lambda role ARN"
}

variable "lambda_ml_classify_role_arn" {
  description = "ML classify Lambda role ARN"
}

variable "lambda_anomaly_role_arn" {
  description = "Anomaly Lambda role ARN"
}

variable "s3_bucket_arn" {
  description = "S3 bucket ARN for S3 invoke permission"
}

variable "event_rule_arn" {
  description = "EventBridge rule ARN for EventBridge invoke permission"
}

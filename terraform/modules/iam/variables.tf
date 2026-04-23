variable "project_name" {
  description = "Project name prefix"
}

variable "aws_region" {
  description = "AWS region"
}

variable "cognito_user_pool_id" {
  description = "Cognito user pool ID"
}

variable "s3_primary_bucket" {
  description = "Primary S3 bucket name"
}

variable "s3_audit_bucket" {
  description = "Audit S3 bucket name"
}

variable "lambda_presign_arn" {
  description = "Pre-sign Lambda ARN"
}

variable "lambda_ml_classify_arn" {
  description = "ML classify Lambda ARN"
}

variable "lambda_anomaly_arn" {
  description = "Anomaly Lambda ARN"
}

variable "dr_bucket_name" {
  description = "DR bucket name"
}

variable "sagemaker_nlp_endpoint_arn" {
  description = "SageMaker NLP endpoint ARN"
}

variable "sagemaker_anomaly_endpoint_arn" {
  description = "SageMaker anomaly endpoint ARN"
}

variable "sns_alert_topic_arn" {
  description = "SNS alert topic ARN"
}

variable "project_name" {
  description = "Project name prefix"
}

variable "aws_region" {
  description = "AWS region"
}

variable "dr_region" {
  description = "DR region"
}

variable "dr_bucket_name" {
  description = "DR bucket name"
}

variable "kms_key_arn" {
  description = "KMS key ARN for encryption"
}

variable "lambda_ml_classify_arn" {
  description = "ML classify Lambda ARN"
}

variable "cloudfront_distribution_arn" {
  description = "CloudFront distribution ARN"
}

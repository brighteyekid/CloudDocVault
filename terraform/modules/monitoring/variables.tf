variable "project_name" {
  description = "Project name prefix"
}

variable "aws_region" {
  description = "AWS region"
}

variable "sagemaker_role_arn" {
  description = "SageMaker execution role ARN"
}

variable "alert_email" {
  description = "Email address for SNS alerts"
  default     = "admin@example.com"
}

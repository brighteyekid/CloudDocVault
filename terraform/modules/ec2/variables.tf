variable "project_name" {
  description = "Project name prefix"
}

variable "aws_region" {
  description = "AWS region"
}

variable "allowed_cidr" {
  description = "CIDR allowed for SSH/HTTP/HTTPS"
}

variable "key_name" {
  description = "EC2 key pair name"
}

variable "instance_profile_arn" {
  description = "EC2 instance profile ARN"
}

variable "vpc_id" {
  description = "VPC ID"
  default     = "vpc-0123456789abcdef0"
}

variable "vpc_cidr" {
  description = "VPC CIDR for internal services"
  default     = "10.0.0.0/16"
}

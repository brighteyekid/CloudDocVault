variable "aws_region" {
  default     = "us-east-1"
  description = "AWS region for primary resources"
}

variable "dr_region" {
  default     = "ap-south-1"
  description = "AWS region for disaster recovery"
}

variable "environment" {
  default     = "prod"
  description = "Environment name (dev, prod)"
}

variable "project_name" {
  default     = "clouddocvault"
  description = "Project name prefix for all resources"
}

variable "ec2_key_name" {
  description = "Name of EC2 key pair for SSH access"
}

variable "allowed_cidr" {
  default     = "0.0.0.0/0"
  description = "CIDR allowed to reach port 80/443"
}

variable "github_org" {
  default     = "clouddocvault"
  description = "GitHub organization for CI/CD"
}

variable "github_repo" {
  default     = "clouddocvault"
  description = "GitHub repository for CI/CD"
}

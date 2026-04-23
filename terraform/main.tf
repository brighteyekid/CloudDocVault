provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "CloudDocVault"
      Environment = var.environment
      ManagedBy   = "Terraform"
    }
  }
}

provider "aws" {
  alias  = "dr"
  region = var.dr_region
}

module "iam" {
  source = "./modules/iam"

  project_name     = var.project_name
  aws_region       = var.aws_region
  cognito_user_pool_id = module.cognito.user_pool_id
  s3_primary_bucket    = module.s3.primary_bucket_name
  s3_audit_bucket      = module.s3.audit_bucket_name
  lambda_presign_arn   = module.lambda.presign_arn
  lambda_ml_classify_arn = module.lambda.ml_classify_arn
  lambda_anomaly_arn   = module.lambda.anomaly_name
}

module "s3" {
  source = "./modules/s3"

  project_name     = var.project_name
  aws_region       = var.aws_region
  dr_region        = var.dr_region
  dr_bucket_name   = "${var.project_name}-dr-${data.aws_caller_identity.current.account_id}"
  kms_key_arn      = module.iam.kms_key_arn
  lambda_ml_classify_arn = module.lambda.ml_classify_arn
}

module "cognito" {
  source = "./modules/cognito"

  project_name = var.project_name
  aws_region   = var.aws_region
}

module "lambda" {
  source = "./modules/lambda"

  project_name          = var.project_name
  aws_region            = var.aws_region
  s3_primary_bucket     = module.s3.primary_bucket_name
  sagemaker_nlp_endpoint_name = module.monitoring.sagemaker_nlp_endpoint_name
  sagemaker_anomaly_endpoint_name = module.monitoring.sagemaker_anomaly_endpoint_name
  sns_alert_topic_arn   = module.monitoring.sns_alert_topic_arn
}

module "cloudfront" {
  source = "./modules/cloudfront"

  project_name          = var.project_name
  s3_primary_regional_domain = module.s3.primary_regional_domain
  ec2_public_dns        = module.ec2.public_dns
}

module "ec2" {
  source = "./modules/ec2"

  project_name     = var.project_name
  aws_region       = var.aws_region
  allowed_cidr     = var.allowed_cidr
  key_name         = var.ec2_key_name
  instance_profile_arn = module.iam.ec2_instance_profile_arn
  cognito_user_pool_id = module.cognito.user_pool_id
  cognito_client_id    = module.cognito.client_id
  s3_primary_bucket    = module.s3.primary_bucket_name
  s3_audit_bucket      = module.s3.audit_bucket_name
  cloudfront_domain    = module.cloudfront.domain_name
  lambda_presign_name  = module.lambda.presign_name
  lambda_ml_classify_name = module.lambda.ml_classify_name
  lambda_anomaly_name  = module.lambda.anomaly_name
}

module "cloudtrail" {
  source = "./modules/cloudtrail"

  project_name     = var.project_name
  aws_region       = var.aws_region
  audit_bucket_name = module.s3.audit_bucket_name
  primary_bucket_arn = module.s3.primary_bucket_arn
  kms_key_arn      = module.iam.kms_key_arn
  lambda_anomaly_arn = module.lambda.anomaly_arn
}

module "monitoring" {
  source = "./modules/monitoring"

  project_name     = var.project_name
  aws_region       = var.aws_region
  sagemaker_role_arn = module.iam.sagemaker_role_arn
}

data "aws_caller_identity" "current" {}

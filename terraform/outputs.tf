output "ec2_public_ip" {
  value = module.ec2.public_ip
}

output "s3_primary_bucket" {
  value = module.s3.primary_bucket_name
}

output "s3_audit_bucket" {
  value = module.s3.audit_bucket_name
}

output "cloudfront_domain" {
  value = module.cloudfront.domain_name
}

output "cognito_user_pool_id" {
  value = module.cognito.user_pool_id
}

output "cognito_client_id" {
  value = module.cognito.client_id
}

output "lambda_presign_name" {
  value = module.lambda.presign_name
}

output "lambda_ml_classify_name" {
  value = module.lambda.ml_classify_name
}

output "lambda_anomaly_name" {
  value = module.lambda.anomaly_name
}

output "sagemaker_nlp_endpoint_name" {
  value = module.monitoring.sagemaker_nlp_endpoint_name
}

output "sagemaker_anomaly_endpoint_name" {
  value = module.monitoring.sagemaker_anomaly_endpoint_name
}

output "prometheus_url" {
  value = "http://${module.ec2.public_ip}:9090"
}

output "grafana_url" {
  value = "http://${module.ec2.public_ip}:3000"
}

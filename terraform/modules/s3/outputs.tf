output "primary_bucket_name" {
  value = aws_s3_bucket.primary.id
}

output "primary_bucket_arn" {
  value = aws_s3_bucket.primary.arn
}

output "primary_regional_domain" {
  value = aws_s3_bucket.primary.bucket_regional_domain_name
}

output "audit_bucket_name" {
  value = aws_s3_bucket.audit.id
}

output "dr_bucket_name" {
  value = aws_s3_bucket.dr_replica.id
}

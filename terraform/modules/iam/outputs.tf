output "kms_key_arn" {
  value = aws_kms_key.main.arn
}

output "ec2_instance_profile_arn" {
  value = aws_iam_instance_profile.ec2_profile.arn
}

output "lambda_presign_role_arn" {
  value = aws_iam_role.lambda_presign.arn
}

output "lambda_ml_classify_role_arn" {
  value = aws_iam_role.lambda_ml_classify.arn
}

output "lambda_anomaly_role_arn" {
  value = aws_iam_role.lambda_anomaly.arn
}

output "sagemaker_role_arn" {
  value = aws_iam_role.sagemaker.arn
}

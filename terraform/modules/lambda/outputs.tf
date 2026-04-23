output "presign_name" {
  value = aws_lambda_function.presign.function_name
}

output "presign_arn" {
  value = aws_lambda_function.presign.arn
}

output "ml_classify_name" {
  value = aws_lambda_function.ml_classify.function_name
}

output "ml_classify_arn" {
  value = aws_lambda_function.ml_classify.arn
}

output "anomaly_name" {
  value = aws_lambda_function.anomaly.function_name
}

output "anomaly_arn" {
  value = aws_lambda_function.anomaly.arn
}

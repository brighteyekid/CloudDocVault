output "sagemaker_nlp_endpoint_name" {
  value = aws_sagemaker_endpoint.nlp.name
}

output "sagemaker_anomaly_endpoint_name" {
  value = aws_sagemaker_endpoint.anomaly.name
}

output "sagemaker_nlp_endpoint_arn" {
  value = aws_sagemaker_endpoint.nlp.arn
}

output "sagemaker_anomaly_endpoint_arn" {
  value = aws_sagemaker_endpoint.anomaly.arn
}

output "sns_alert_topic_arn" {
  value = aws_sns_topic.alerts.arn
}

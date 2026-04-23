output "trail_name" {
  value = aws_cloudtrail.main.name
}

output "log_group_name" {
  value = aws_cloudwatch_log_group.cloudtrail.name
}

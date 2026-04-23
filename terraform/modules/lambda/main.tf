resource "aws_lambda_function" "presign" {
  function_name = "${var.project_name}-presign"
  role          = var.lambda_presign_role_arn
  runtime       = "python3.11"
  handler       = "handler.lambda_handler"
  filename      = "${path.module}/../../lambda/presign/presign.zip"
  timeout       = 10
  memory_size   = 128

  environment {
    variables = {
      AWS_REGION     = var.aws_region
      PRIMARY_BUCKET = var.s3_primary_bucket
    }
  }
}

resource "aws_lambda_function" "ml_classify" {
  function_name = "${var.project_name}-ml-classify"
  role          = var.lambda_ml_classify_role_arn
  runtime       = "python3.11"
  handler       = "handler.lambda_handler"
  filename      = "${path.module}/../../lambda/ml_classify/ml_classify.zip"
  timeout       = 300
  memory_size   = 512

  environment {
    variables = {
      AWS_REGION               = var.aws_region
      PRIMARY_BUCKET           = var.s3_primary_bucket
      SAGEMAKER_ENDPOINT_NAME  = var.sagemaker_nlp_endpoint_name
    }
  }
}

resource "aws_lambda_function" "anomaly" {
  function_name = "${var.project_name}-anomaly"
  role          = var.lambda_anomaly_role_arn
  runtime       = "python3.11"
  handler       = "handler.lambda_handler"
  filename      = "${path.module}/../../lambda/anomaly/anomaly.zip"
  timeout       = 30
  memory_size   = 256

  environment {
    variables = {
      AWS_REGION               = var.aws_region
      SAGEMAKER_ENDPOINT_NAME  = var.sagemaker_anomaly_endpoint_name
      ANOMALY_THRESHOLD        = "0.75"
      SNS_ALERT_TOPIC_ARN      = var.sns_alert_topic_arn
    }
  }
}

resource "aws_lambda_permission" "allow_s3_invoke_ml" {
  statement_id  = "AllowS3InvokeML"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.ml_classify.function_name
  principal     = "s3.amazonaws.com"
  source_arn    = var.s3_bucket_arn
}

resource "aws_lambda_permission" "allow_eventbridge_invoke_anomaly" {
  statement_id  = "AllowEventBridgeInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.anomaly.function_name
  principal     = "events.amazonaws.com"
  source_arn    = var.event_rule_arn
}

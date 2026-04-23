resource "aws_sagemaker_model" "nlp_classifier" {
  name               = "${var.project_name}-nlp-classifier"
  execution_role_arn = var.sagemaker_role_arn

  primary_container {
    image = "763104351884.dkr.ecr.us-east-1.amazonaws.com/huggingface-pytorch-inference:2.1.0-transformers4.37.0-cpu-py310-ubuntu22.04"
    environment = {
      HF_MODEL_ID   = "cross-encoder/nli-MiniLM2-L6-H768"
      HF_TASK       = "text-classification"
    }
  }
}

resource "aws_sagemaker_endpoint_configuration" "nlp" {
  name = "${var.project_name}-nlp-config"
  production_variants {
    variant_name           = "primary"
    model_name             = aws_sagemaker_model.nlp_classifier.name
    initial_instance_count = 1
    instance_type          = "ml.m5.large"
  }
}

resource "aws_sagemaker_endpoint" "nlp" {
  name                 = "${var.project_name}-nlp-endpoint"
  endpoint_config_name = aws_sagemaker_endpoint_configuration.nlp.name
}

resource "aws_sagemaker_model" "anomaly_detector" {
  name               = "${var.project_name}-anomaly-detector"
  execution_role_arn = var.sagemaker_role_arn

  primary_container {
    image = "382416733822.dkr.ecr.us-east-1.amazonaws.com/randomcutforest:1"
  }
}

resource "aws_sagemaker_endpoint_configuration" "anomaly" {
  name = "${var.project_name}-anomaly-config"
  production_variants {
    variant_name           = "primary"
    model_name             = aws_sagemaker_model.anomaly_detector.name
    initial_instance_count = 1
    instance_type          = "ml.m4.xlarge"
  }
}

resource "aws_sagemaker_endpoint" "anomaly" {
  name                 = "${var.project_name}-anomaly-endpoint"
  endpoint_config_name = aws_sagemaker_endpoint_configuration.anomaly.name
}

resource "aws_sns_topic" "alerts" {
  name = "${var.project_name}-alerts"
}

resource "aws_sns_topic_subscription" "email_alerts" {
  topic_arn = aws_sns_topic.alerts.arn
  protocol  = "email"
  endpoint  = var.alert_email
}

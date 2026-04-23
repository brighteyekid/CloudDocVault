resource "aws_kms_key" "main" {
  description             = "CloudDocVault master key — S3, Lambda, CloudTrail"
  deletion_window_in_days = 14
  enable_key_rotation     = true

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "RootFullAccess"
        Effect = "Allow"
        Principal = { AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root" }
        Action    = "kms:*"
        Resource  = "*"
      },
      {
        Sid    = "EC2RoleDecrypt"
        Effect = "Allow"
        Principal = { AWS = aws_iam_role.ec2_app_role.arn }
        Action    = ["kms:Decrypt", "kms:GenerateDataKey"]
        Resource  = "*"
      },
      {
        Sid    = "LambdaDecrypt"
        Effect = "Allow"
        Principal = { AWS = [
          aws_iam_role.lambda_presign.arn,
          aws_iam_role.lambda_ml_classify.arn,
          aws_iam_role.lambda_anomaly.arn
        ]}
        Action    = ["kms:Decrypt", "kms:GenerateDataKey"]
        Resource  = "*"
      },
      {
        Sid    = "CloudTrailEncrypt"
        Effect = "Allow"
        Principal = { Service = "cloudtrail.amazonaws.com" }
        Action    = ["kms:GenerateDataKey", "kms:Decrypt"]
        Resource  = "*"
      }
    ]
  })
}

resource "aws_kms_alias" "main" {
  name          = "alias/${var.project_name}-main"
  target_key_id = aws_kms_key.main.key_id
}

resource "aws_kms_key" "tfstate" {
  description             = "Terraform state encryption key"
  deletion_window_in_days = 14
  enable_key_rotation     = true
}

resource "aws_kms_alias" "tfstate" {
  name          = "alias/${var.project_name}-tfstate"
  target_key_id = aws_kms_key.tfstate.key_id
}

resource "aws_iam_role" "ec2_app_role" {
  name = "${var.project_name}-ec2-role"
  assume_role_policy = jsonencode({
    Version   = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ec2.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy" "ec2_s3_policy" {
  name = "s3-access"
  role = aws_iam_role.ec2_app_role.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "S3PrimaryBucketAccess"
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject",
          "s3:ListBucket",
          "s3:GetObjectVersion"
        ]
        Resource = [
          "arn:aws:s3:::${var.s3_primary_bucket}",
          "arn:aws:s3:::${var.s3_primary_bucket}/*"
        ]
      },
      {
        Sid    = "S3AuditBucketReadOnly"
        Effect = "Allow"
        Action = ["s3:GetObject", "s3:ListBucket"]
        Resource = [
          "arn:aws:s3:::${var.s3_audit_bucket}",
          "arn:aws:s3:::${var.s3_audit_bucket}/*"
        ]
      }
    ]
  })
}

resource "aws_iam_role_policy" "ec2_cognito_policy" {
  name = "cognito-access"
  role = aws_iam_role.ec2_app_role.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "cognito-idp:AdminGetUser",
        "cognito-idp:AdminListGroupsForUser",
        "cognito-idp:ListUsers"
      ]
      Resource = "arn:aws:cognito-idp:${var.aws_region}:*:userpool/${var.cognito_user_pool_id}"
    }]
  })
}

resource "aws_iam_role_policy" "ec2_cloudwatch_policy" {
  name = "cloudwatch-access"
  role = aws_iam_role.ec2_app_role.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "cloudwatch:PutMetricData",
        "cloudwatch:GetMetricStatistics",
        "cloudwatch:ListMetrics",
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents",
        "logs:DescribeLogStreams"
      ]
      Resource = "*"
    }]
  })
}

resource "aws_iam_role_policy" "ec2_lambda_invoke_policy" {
  name = "lambda-invoke"
  role = aws_iam_role.ec2_app_role.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["lambda:InvokeFunction"]
      Resource = [
        var.lambda_presign_arn,
        var.lambda_ml_classify_arn,
        var.lambda_anomaly_arn
      ]
    }]
  })
}

resource "aws_iam_instance_profile" "ec2_profile" {
  name = "${var.project_name}-ec2-profile"
  role = aws_iam_role.ec2_app_role.name
}

resource "aws_iam_role" "lambda_presign" {
  name = "${var.project_name}-lambda-presign-role"
  assume_role_policy = jsonencode({
    Version   = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy" "lambda_presign_policy" {
  name = "lambda-presign-policy"
  role = aws_iam_role.lambda_presign.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "S3Access"
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject"
        ]
        Resource = [
          "arn:aws:s3:::${var.s3_primary_bucket}",
          "arn:aws:s3:::${var.s3_primary_bucket}/*"
        ]
      },
      {
        Sid    = "CloudWatchLogs"
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:*:*:log-group:/aws/lambda/${var.project_name}-presign:*"
      }
    ]
  })
}

resource "aws_iam_role" "lambda_ml_classify" {
  name = "${var.project_name}-lambda-ml-classify-role"
  assume_role_policy = jsonencode({
    Version   = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy" "lambda_ml_classify_policy" {
  name = "lambda-ml-classify-policy"
  role = aws_iam_role.lambda_ml_classify.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "TextractAccess"
        Effect = "Allow"
        Action = [
          "textract:DetectDocumentText",
          "textract:GetDocumentAnalysis"
        ]
        Resource = "*"
      },
      {
        Sid    = "SageMakerInvoke"
        Effect = "Allow"
        Action = ["sagemaker:InvokeEndpoint"]
        Resource = [
          var.sagemaker_nlp_endpoint_arn
        ]
      },
      {
        Sid    = "S3Access"
        Effect = "Allow"
        Action = ["s3:GetObject"]
        Resource = [
          "arn:aws:s3:::${var.s3_primary_bucket}",
          "arn:aws:s3:::${var.s3_primary_bucket}/*"
        ]
      },
      {
        Sid    = "CloudWatchLogs"
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:*:*:log-group:/aws/lambda/${var.project_name}-ml-classify:*"
      }
    ]
  })
}

resource "aws_iam_role" "lambda_anomaly" {
  name = "${var.project_name}-lambda-anomaly-role"
  assume_role_policy = jsonencode({
    Version   = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy" "lambda_anomaly_policy" {
  name = "lambda-anomaly-policy"
  role = aws_iam_role.lambda_anomaly.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "SageMakerInvoke"
        Effect = "Allow"
        Action = ["sagemaker:InvokeEndpoint"]
        Resource = [
          var.sagemaker_anomaly_endpoint_arn
        ]
      },
      {
        Sid    = "CloudWatchMetrics"
        Effect = "Allow"
        Action = ["cloudwatch:PutMetricData"]
        Resource = "*"
      },
      {
        Sid    = "SNSPublish"
        Effect = "Allow"
        Action = ["sns:Publish"]
        Resource = var.sns_alert_topic_arn
      },
      {
        Sid    = "CloudWatchLogs"
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:*:*:log-group:/aws/lambda/${var.project_name}-anomaly:*"
      }
    ]
  })
}

resource "aws_iam_role" "sagemaker" {
  name = "${var.project_name}-sagemaker-role"
  assume_role_policy = jsonencode({
    Version   = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "sagemaker.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy" "sagemaker_policy" {
  name = "sagemaker-policy"
  role = aws_iam_role.sagemaker.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "S3Access"
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject"
        ]
        Resource = [
          "arn:aws:s3:::${var.s3_primary_bucket}",
          "arn:aws:s3:::${var.s3_primary_bucket}/*"
        ]
      },
      {
        Sid    = "CloudWatchLogs"
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:*:*:log-group:/aws/sagemaker/*"
      }
    ]
  })
}

resource "aws_iam_role" "replication" {
  name = "${var.project_name}-replication-role"
  assume_role_policy = jsonencode({
    Version   = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "s3.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy" "replication_policy" {
  name = "replication-policy"
  role = aws_iam_role.replication.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "ReplicationAccess"
        Effect = "Allow"
        Action = [
          "s3:GetObjectVersionForReplication",
          "s3:GetObjectVersionMetadata",
          "s3:ReplicateObject",
          "s3:ReplicateDelete"
        ]
        Resource = [
          "arn:aws:s3:::${var.s3_primary_bucket}/*",
          "arn:aws:s3:::${var.dr_bucket_name}/*"
        ]
      }
    ]
  })
}

data "aws_caller_identity" "current" {}

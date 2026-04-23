# CloudDocVault — Missing Features & Integration Specification

**Document type:** Gap-fill supplement to `CLOUDDOCVAULT_AGENT_SPEC.md` v1.0  
**Purpose:** Define everything absent from the existing spec — Terraform IaC, AWS Lambda functions, ML pipeline (Textract + SageMaker), Prometheus + Grafana observability stack, CloudTrail WORM audit, IAM security hardening, CI/CD pipeline, and the full one-command deploy script extensions.  
**Read order:** Complete the original spec first, then layer every section of this document on top of it.  
**Agent instruction:** Treat this document as mandatory addenda. Every section below describes a gap in the original spec. Build it in the order listed in Section 14.

---

## Table of Contents

1. [Gap Summary](#1-gap-summary)
2. [Terraform Infrastructure as Code](#2-terraform-infrastructure-as-code)
3. [AWS IAM — Least-Privilege Roles & Policies](#3-aws-iam--least-privilege-roles--policies)
4. [AWS S3 — Full Bucket Configuration](#4-aws-s3--full-bucket-configuration)
5. [AWS Lambda Functions](#5-aws-lambda-functions)
6. [ML Pipeline — Textract + SageMaker](#6-ml-pipeline--textract--sagemaker)
7. [CloudTrail + S3 Object Lock — Audit & Compliance](#7-cloudtrail--s3-object-lock--audit--compliance)
8. [AWS CloudFront — Origin Access Control](#8-aws-cloudfront--origin-access-control)
9. [AWS Cognito — Full Configuration](#9-aws-cognito--full-configuration)
10. [Prometheus — Deployment & Custom Metrics](#10-prometheus--deployment--custom-metrics)
11. [Grafana — Five Production Dashboards](#11-grafana--five-production-dashboards)
12. [GitHub Actions CI/CD Pipeline](#12-github-actions-cicd-pipeline)
13. [Deploy Script Extensions](#13-deploy-script-extensions)
14. [Build Order Addendum](#14-build-order-addendum)
15. [Environment Variables — Full Reference](#15-environment-variables--full-reference)
16. [Security Hardening Checklist](#16-security-hardening-checklist)

---

## 1. Gap Summary

The following table lists every missing layer. The agent must build all of them.

| Layer | Status in v1.0 spec | What is missing |
|-------|--------------------|--------------------|
| Terraform IaC | Not mentioned | All AWS resources are described as manual setup. Every resource must be declared in Terraform and provisioned by `deploy.sh` before the application starts. |
| IAM roles and policies | Not mentioned | The spec passes raw `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` to the Node.js process. These must be replaced with scoped IAM roles. The backend must assume a role at runtime, not use root credentials. |
| S3 bucket hardening | Partial | Versioning, SSE-KMS, lifecycle rules, cross-region replication, bucket policies, and VPC endpoint restriction are all absent. |
| Lambda functions | Referenced | Three Lambda functions are referenced but never defined: pre-signed URL generator, ML classification orchestrator, anomaly detection scorer. |
| ML pipeline | Not mentioned | Amazon Textract + SageMaker NLP classification and isolation forest anomaly detection are not present anywhere in the spec. |
| CloudTrail + WORM | Not mentioned | Audit logging and S3 Object Lock are entirely absent. |
| CloudFront OAC | Implied | CloudFront is listed as a service but Origin Access Control restricting S3 is not configured. |
| Prometheus | Listed in observability page | Prometheus is listed as a data source but never installed, configured, or fed with custom metrics. |
| Grafana | Listed in observability page | Grafana is listed as a UI but never installed, provisioned, or connected to Prometheus. |
| GitHub Actions | Not mentioned | No CI/CD pipeline exists. The deploy script in the original spec is manual SSH. |
| Deploy script | Partial | The original deploy script covers only Node.js application startup. It does not provision AWS resources, install Prometheus/Grafana, configure IAM, or validate infrastructure. |

---

## 2. Terraform Infrastructure as Code

### 2.1 Directory structure

The agent must create the following Terraform directory alongside the existing `/server` and `/client` directories:

```
/terraform
  main.tf
  variables.tf
  outputs.tf
  backend.tf
  /modules
    /s3
      main.tf
      variables.tf
      outputs.tf
    /iam
      main.tf
      variables.tf
      outputs.tf
    /lambda
      main.tf
      variables.tf
      outputs.tf
    /cognito
      main.tf
      variables.tf
      outputs.tf
    /cloudfront
      main.tf
      variables.tf
      outputs.tf
    /ec2
      main.tf
      variables.tf
      outputs.tf
    /monitoring
      main.tf
      variables.tf
      outputs.tf
    /cloudtrail
      main.tf
      variables.tf
      outputs.tf
  /environments
    dev.tfvars
    prod.tfvars
```

### 2.2 Backend configuration (`backend.tf`)

```hcl
terraform {
  required_version = ">= 1.6.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  backend "s3" {
    bucket         = "clouddocvault-tfstate"
    key            = "terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "clouddocvault-tfstate-lock"
    kms_key_id     = "alias/clouddocvault-tfstate"
  }
}
```

The deploy script must bootstrap this backend before running `terraform init`. Bootstrap steps:

1. Create the state S3 bucket with versioning and SSE-KMS.
2. Create the DynamoDB table for state locking (`PAY_PER_REQUEST` billing, partition key `LockID` of type `S`).
3. Create a KMS key aliased `alias/clouddocvault-tfstate`.
4. Only after these three resources exist, run `terraform init`.

All three bootstrap resources must be created using AWS CLI commands in `deploy.sh`, not Terraform (to avoid the chicken-and-egg problem of Terraform needing state before it can create its own state bucket).

### 2.3 Root `main.tf`

```hcl
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

# Secondary region provider for cross-region replication
provider "aws" {
  alias  = "dr"
  region = var.dr_region
}

module "iam"        { source = "./modules/iam";        ... }
module "s3"         { source = "./modules/s3";         ... }
module "cognito"    { source = "./modules/cognito";     ... }
module "lambda"     { source = "./modules/lambda";      ... }
module "cloudfront" { source = "./modules/cloudfront";  ... }
module "ec2"        { source = "./modules/ec2";         ... }
module "cloudtrail" { source = "./modules/cloudtrail";  ... }
module "monitoring" { source = "./modules/monitoring";  ... }
```

### 2.4 Root `variables.tf`

```hcl
variable "aws_region"    { default = "us-east-1" }
variable "dr_region"     { default = "ap-south-1" }
variable "environment"   { default = "prod" }
variable "project_name"  { default = "clouddocvault" }
variable "ec2_key_name"  { description = "Name of EC2 key pair for SSH access" }
variable "allowed_cidr"  { default = "0.0.0.0/0"; description = "CIDR allowed to reach port 80/443" }
```

### 2.5 Root `outputs.tf`

```hcl
output "ec2_public_ip"           { value = module.ec2.public_ip }
output "s3_primary_bucket"       { value = module.s3.primary_bucket_name }
output "s3_audit_bucket"         { value = module.s3.audit_bucket_name }
output "cloudfront_domain"       { value = module.cloudfront.domain_name }
output "cognito_user_pool_id"    { value = module.cognito.user_pool_id }
output "cognito_client_id"       { value = module.cognito.client_id }
output "lambda_presign_arn"      { value = module.lambda.presign_arn }
output "lambda_ml_classify_arn"  { value = module.lambda.ml_classify_arn }
output "lambda_anomaly_arn"      { value = module.lambda.anomaly_arn }
output "sagemaker_endpoint_name" { value = module.monitoring.sagemaker_endpoint_name }
output "prometheus_url"          { value = "http://${module.ec2.public_ip}:9090" }
output "grafana_url"             { value = "http://${module.ec2.public_ip}:3000" }
```

---

## 3. AWS IAM — Least-Privilege Roles & Policies

### 3.1 EC2 instance role

The Node.js backend running on EC2 must NOT use `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` passed as environment variables. It must use the EC2 instance profile. The deploy script attaches the following role to the EC2 instance at launch.

Terraform resource in `modules/iam/main.tf`:

```hcl
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
          "arn:aws:s3:::${var.primary_bucket_name}",
          "arn:aws:s3:::${var.primary_bucket_name}/*"
        ]
      },
      {
        Sid    = "S3AuditBucketReadOnly"
        Effect = "Allow"
        Action = ["s3:GetObject", "s3:ListBucket"]
        Resource = [
          "arn:aws:s3:::${var.audit_bucket_name}",
          "arn:aws:s3:::${var.audit_bucket_name}/*"
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
```

### 3.2 Lambda execution roles

Each Lambda function gets its own scoped IAM role. The agent must create one role per function — do not share a role across functions.

**Pre-sign Lambda role:** Allows `s3:GetObject`, `s3:PutObject` on primary bucket only. No other permissions.

**ML classify Lambda role:** Allows `textract:StartDocumentAnalysis`, `textract:GetDocumentAnalysis`, `sagemaker:InvokeEndpoint` on the NLP endpoint only, `s3:GetObject` on primary bucket to read the uploaded file.

**Anomaly Lambda role:** Allows `sagemaker:InvokeEndpoint` on the anomaly endpoint only, `cloudwatch:PutMetricData` to emit anomaly scores.

All three Lambda roles also get `logs:CreateLogGroup`, `logs:CreateLogStream`, `logs:PutLogEvents` for CloudWatch Logs.

### 3.3 KMS key policy

```hcl
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
  name          = "alias/clouddocvault-main"
  target_key_id = aws_kms_key.main.key_id
}
```

---

## 4. AWS S3 — Full Bucket Configuration

The original spec mentions S3 as a storage service but does not configure it. The agent must create and fully configure three S3 buckets via Terraform.

### 4.1 Primary document bucket

```hcl
resource "aws_s3_bucket" "primary" {
  bucket = "${var.project_name}-documents-${data.aws_caller_identity.current.account_id}"
  force_destroy = false
}

resource "aws_s3_bucket_versioning" "primary" {
  bucket = aws_s3_bucket.primary.id
  versioning_configuration { status = "Enabled" }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "primary" {
  bucket = aws_s3_bucket.primary.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = aws_kms_key.main.arn
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_public_access_block" "primary" {
  bucket                  = aws_s3_bucket.primary.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_lifecycle_configuration" "primary" {
  bucket = aws_s3_bucket.primary.id
  rule {
    id     = "tiering"
    status = "Enabled"
    filter {}
    transition {
      days          = 30
      storage_class = "STANDARD_IA"
    }
    transition {
      days          = 90
      storage_class = "GLACIER"
    }
    transition {
      days          = 365
      storage_class = "DEEP_ARCHIVE"
    }
    noncurrent_version_transition {
      noncurrent_days = 30
      storage_class   = "GLACIER"
    }
    noncurrent_version_expiration {
      noncurrent_days = 365
    }
  }
}

resource "aws_s3_bucket_notification" "primary" {
  bucket = aws_s3_bucket.primary.id
  lambda_function {
    lambda_function_arn = var.lambda_ml_classify_arn
    events              = ["s3:ObjectCreated:*"]
    filter_prefix       = "documents/"
  }
  depends_on = [aws_lambda_permission.allow_s3_invoke_ml]
}

resource "aws_s3_bucket_policy" "primary" {
  bucket = aws_s3_bucket.primary.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "DenyNonTLS"
        Effect    = "Deny"
        Principal = "*"
        Action    = "s3:*"
        Resource  = [
          "${aws_s3_bucket.primary.arn}",
          "${aws_s3_bucket.primary.arn}/*"
        ]
        Condition = {
          Bool = { "aws:SecureTransport" = "false" }
        }
      },
      {
        Sid       = "AllowCloudFrontOAC"
        Effect    = "Allow"
        Principal = { Service = "cloudfront.amazonaws.com" }
        Action    = "s3:GetObject"
        Resource  = "${aws_s3_bucket.primary.arn}/*"
        Condition = {
          StringEquals = {
            "AWS:SourceArn" = aws_cloudfront_distribution.main.arn
          }
        }
      },
      {
        Sid       = "AllowEC2Role"
        Effect    = "Allow"
        Principal = { AWS = aws_iam_role.ec2_app_role.arn }
        Action    = ["s3:GetObject","s3:PutObject","s3:DeleteObject","s3:ListBucket","s3:GetObjectVersion"]
        Resource  = [
          "${aws_s3_bucket.primary.arn}",
          "${aws_s3_bucket.primary.arn}/*"
        ]
      }
    ]
  })
}
```

### 4.2 Cross-region replication (disaster recovery)

```hcl
# DR bucket in secondary region
resource "aws_s3_bucket" "dr_replica" {
  provider = aws.dr
  bucket   = "${var.project_name}-dr-${data.aws_caller_identity.current.account_id}"
}

resource "aws_s3_bucket_versioning" "dr_replica" {
  provider = aws.dr
  bucket   = aws_s3_bucket.dr_replica.id
  versioning_configuration { status = "Enabled" }
}

resource "aws_s3_bucket_replication_configuration" "primary_to_dr" {
  bucket = aws_s3_bucket.primary.id
  role   = aws_iam_role.replication.arn
  rule {
    id     = "full-replication"
    status = "Enabled"
    filter {}
    destination {
      bucket        = aws_s3_bucket.dr_replica.arn
      storage_class = "STANDARD_IA"
    }
    delete_marker_replication { status = "Enabled" }
  }
}
```

### 4.3 Audit bucket (separate, WORM-locked)

```hcl
resource "aws_s3_bucket" "audit" {
  bucket        = "${var.project_name}-audit-${data.aws_caller_identity.current.account_id}"
  force_destroy = false
}

resource "aws_s3_bucket_object_lock_configuration" "audit" {
  bucket = aws_s3_bucket.audit.id
  object_lock_enabled = "Enabled"
  rule {
    default_retention {
      mode = "COMPLIANCE"
      days = 2555    # 7 years
    }
  }
}

resource "aws_s3_bucket_versioning" "audit" {
  bucket = aws_s3_bucket.audit.id
  versioning_configuration { status = "Enabled" }
}

resource "aws_s3_bucket_public_access_block" "audit" {
  bucket                  = aws_s3_bucket.audit.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}
```

### 4.4 Backend changes required — remove AWS credentials from `.env`

The original spec writes `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` into the backend `.env`. This must be removed. The Node.js backend must use the EC2 instance profile. The AWS SDK resolves credentials automatically from the instance metadata service when no static credentials are present.

Remove these two lines from the `.env` template in the original spec Section 10, Step 6:

```
# REMOVE THESE — credentials come from EC2 instance profile
# AWS_ACCESS_KEY_ID=${AWS_ACCESS_KEY_ID}
# AWS_SECRET_ACCESS_KEY=${AWS_SECRET_ACCESS_KEY}
```

Replace the backend S3 client instantiation in `server/src/services/s3.js`:

```javascript
// Before (original spec — unsafe):
const client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

// After (correct — uses EC2 instance profile automatically):
const client = new S3Client({ region: process.env.AWS_REGION });
```

---

## 5. AWS Lambda Functions

The original spec references Lambda but provides no function code. The agent must create three Lambda functions.

### 5.1 Directory structure

```
/lambda
  /presign
    handler.py
    requirements.txt
  /ml_classify
    handler.py
    requirements.txt
  /anomaly
    handler.py
    requirements.txt
  build_lambdas.sh    # packages each function into a ZIP for Terraform to upload
```

### 5.2 Pre-signed URL generator (`lambda/presign/handler.py`)

```python
import json
import os
import boto3
from botocore.exceptions import ClientError

s3_client = boto3.client("s3", region_name=os.environ["AWS_REGION"])
BUCKET     = os.environ["PRIMARY_BUCKET"]
EXPIRY     = int(os.environ.get("URL_EXPIRY_SECONDS", "900"))  # 15 minutes


def lambda_handler(event, context):
    operation = event.get("operation")          # "put" or "get"
    object_key = event.get("object_key")        # sanitised before reaching Lambda
    content_type = event.get("content_type", "application/octet-stream")

    if not operation or not object_key:
        return {"statusCode": 400, "body": json.dumps({"error": "Missing required fields"})}

    # Sanitise key — prevent path traversal
    safe_key = object_key.replace("..", "").lstrip("/")
    if not safe_key.startswith("documents/"):
        safe_key = f"documents/{safe_key}"

    try:
        if operation == "put":
            url = s3_client.generate_presigned_url(
                "put_object",
                Params={"Bucket": BUCKET, "Key": safe_key, "ContentType": content_type},
                ExpiresIn=EXPIRY,
                HttpMethod="PUT"
            )
        elif operation == "get":
            url = s3_client.generate_presigned_url(
                "get_object",
                Params={"Bucket": BUCKET, "Key": safe_key},
                ExpiresIn=EXPIRY,
                HttpMethod="GET"
            )
        else:
            return {"statusCode": 400, "body": json.dumps({"error": "Invalid operation"})}

        return {
            "statusCode": 200,
            "body": json.dumps({
                "url": url,
                "key": safe_key,
                "expires_in": EXPIRY,
                "operation": operation
            })
        }
    except ClientError as e:
        return {"statusCode": 500, "body": json.dumps({"error": str(e)})}
```

The Node.js backend invokes this Lambda directly instead of calling S3 SDK:

```javascript
// server/src/services/presign.js
import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";

const lambda = new LambdaClient({ region: process.env.AWS_REGION });

export async function getPresignedUrl(operation, objectKey, contentType) {
  const payload = JSON.stringify({ operation, object_key: objectKey, content_type: contentType });
  const cmd     = new InvokeCommand({
    FunctionName: process.env.LAMBDA_PRESIGN_NAME,
    Payload:      Buffer.from(payload)
  });
  const response = await lambda.send(cmd);
  const body     = JSON.parse(Buffer.from(response.Payload).toString());
  return JSON.parse(body.body);
}
```

### 5.3 Terraform Lambda module (`modules/lambda/main.tf`)

```hcl
resource "aws_lambda_function" "presign" {
  function_name = "${var.project_name}-presign"
  role          = aws_iam_role.lambda_presign.arn
  runtime       = "python3.11"
  handler       = "handler.lambda_handler"
  filename      = "${path.module}/../../lambda/presign/presign.zip"
  timeout       = 10
  memory_size   = 128

  environment {
    variables = {
      AWS_REGION     = var.aws_region
      PRIMARY_BUCKET = var.primary_bucket_name
    }
  }
}

resource "aws_lambda_function" "ml_classify" {
  function_name = "${var.project_name}-ml-classify"
  role          = aws_iam_role.lambda_ml_classify.arn
  runtime       = "python3.11"
  handler       = "handler.lambda_handler"
  filename      = "${path.module}/../../lambda/ml_classify/ml_classify.zip"
  timeout       = 300
  memory_size   = 512

  environment {
    variables = {
      AWS_REGION               = var.aws_region
      PRIMARY_BUCKET           = var.primary_bucket_name
      SAGEMAKER_ENDPOINT_NAME  = var.sagemaker_nlp_endpoint
    }
  }
}

resource "aws_lambda_function" "anomaly" {
  function_name = "${var.project_name}-anomaly"
  role          = aws_iam_role.lambda_anomaly.arn
  runtime       = "python3.11"
  handler       = "handler.lambda_handler"
  filename      = "${path.module}/../../lambda/anomaly/anomaly.zip"
  timeout       = 30
  memory_size   = 256

  environment {
    variables = {
      AWS_REGION               = var.aws_region
      SAGEMAKER_ENDPOINT_NAME  = var.sagemaker_anomaly_endpoint
      ANOMALY_THRESHOLD        = "0.75"
      SNS_ALERT_TOPIC_ARN      = var.sns_alert_topic_arn
    }
  }
}
```

---

## 6. ML Pipeline — Textract + SageMaker

### 6.1 Classification Lambda (`lambda/ml_classify/handler.py`)

This Lambda is triggered automatically by S3 on every `PutObject` to `documents/`. It extracts text via Textract, classifies it via SageMaker, then writes the classification label and confidence score back to the S3 object as metadata tags.

```python
import json
import os
import boto3
import urllib.parse

textract = boto3.client("textract",   region_name=os.environ["AWS_REGION"])
sm       = boto3.client("sagemaker-runtime", region_name=os.environ["AWS_REGION"])
s3       = boto3.client("s3",         region_name=os.environ["AWS_REGION"])

ENDPOINT = os.environ["SAGEMAKER_ENDPOINT_NAME"]
BUCKET   = os.environ["PRIMARY_BUCKET"]

LABELS   = ["invoice", "contract", "medical_record", "legal_filing",
            "compliance_report", "hr_document", "research_paper", "other"]


def lambda_handler(event, context):
    record     = event["Records"][0]
    bucket     = record["s3"]["bucket"]["name"]
    key        = urllib.parse.unquote_plus(record["s3"]["object"]["key"])

    # Step 1 — Extract text via Textract (synchronous for files <5 MB, async otherwise)
    try:
        response = textract.detect_document_text(
            Document={"S3Object": {"Bucket": bucket, "Name": key}}
        )
        text_blocks = [
            b["Text"] for b in response.get("Blocks", [])
            if b["BlockType"] == "LINE"
        ]
        extracted_text = " ".join(text_blocks)[:5000]   # truncate to SageMaker input limit
    except Exception as e:
        _tag_object(bucket, key, "unknown", 0.0, f"textract_error: {str(e)}")
        return

    # Step 2 — Classify via SageMaker NLP endpoint
    try:
        sm_response  = sm.invoke_endpoint(
            EndpointName=ENDPOINT,
            ContentType="text/plain",
            Body=extracted_text.encode("utf-8")
        )
        result       = json.loads(sm_response["Body"].read())
        label_idx    = result.get("label_index", len(LABELS) - 1)
        confidence   = float(result.get("confidence", 0.0))
        label        = LABELS[label_idx] if label_idx < len(LABELS) else "other"
    except Exception as e:
        label, confidence = "unknown", 0.0

    # Step 3 — Write classification back to S3 object tags
    _tag_object(bucket, key, label, confidence, "success")


def _tag_object(bucket, key, label, confidence, status):
    s3.put_object_tagging(
        Bucket=bucket,
        Key=key,
        Tagging={
            "TagSet": [
                {"Key": "ml_label",      "Value": label},
                {"Key": "ml_confidence", "Value": str(round(confidence, 4))},
                {"Key": "ml_status",     "Value": status},
            ]
        }
    )
```

### 6.2 SageMaker NLP model

The agent must create a SageMaker model using the Hugging Face container. The model is a fine-tuned `distilbert-base-uncased` document classifier. The Terraform resource provisions this using a pre-built HuggingFace container — no custom training job is required for the base deployment.

```hcl
# modules/monitoring/main.tf (SageMaker section)

resource "aws_sagemaker_model" "nlp_classifier" {
  name               = "${var.project_name}-nlp-classifier"
  execution_role_arn = aws_iam_role.sagemaker.arn

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
```

### 6.3 Anomaly detection Lambda (`lambda/anomaly/handler.py`)

This Lambda is triggered by EventBridge. Every S3 `GetObject` event from CloudTrail is forwarded to this function through an EventBridge rule.

```python
import json
import os
import boto3
import time

sm    = boto3.client("sagemaker-runtime", region_name=os.environ["AWS_REGION"])
cw    = boto3.client("cloudwatch",        region_name=os.environ["AWS_REGION"])
sns   = boto3.client("sns",               region_name=os.environ["AWS_REGION"])

ENDPOINT  = os.environ["SAGEMAKER_ENDPOINT_NAME"]
THRESHOLD = float(os.environ.get("ANOMALY_THRESHOLD", "0.75"))
SNS_ARN   = os.environ["SNS_ALERT_TOPIC_ARN"]


def lambda_handler(event, context):
    detail     = event.get("detail", {})
    user_arn   = detail.get("userIdentity", {}).get("arn", "unknown")
    source_ip  = detail.get("sourceIPAddress", "unknown")
    event_name = detail.get("eventName", "unknown")
    timestamp  = detail.get("eventTime",  str(time.time()))

    # Feature vector for isolation forest:
    # [hour_of_day, is_weekend, download_count_1h, unique_docs_1h, new_ip_flag]
    # In production this is computed from DynamoDB rolling window counters.
    # For the base build, extract available features from the event.
    hour_of_day = int(timestamp[11:13]) if len(timestamp) > 13 else 12
    is_weekend  = 0    # compute from timestamp date

    feature_csv = f"{hour_of_day},{is_weekend},1,1,0"

    try:
        sm_response = sm.invoke_endpoint(
            EndpointName=ENDPOINT,
            ContentType="text/csv",
            Body=feature_csv.encode()
        )
        score  = float(sm_response["Body"].read().decode().strip())
    except Exception:
        score  = 0.0

    # Emit score as CloudWatch metric regardless of threshold
    cw.put_metric_data(
        Namespace="CloudDocVault",
        MetricData=[{
            "MetricName": "AnomalyScore",
            "Dimensions": [{"Name": "UserARN", "Value": user_arn}],
            "Value":      score,
            "Unit":       "None"
        }]
    )

    # Alert if above threshold
    if score >= THRESHOLD:
        sns.publish(
            TopicArn=SNS_ARN,
            Subject=f"CloudDocVault — Anomaly Detected [{score:.2f}]",
            Message=json.dumps({
                "score":     score,
                "threshold": THRESHOLD,
                "user":      user_arn,
                "source_ip": source_ip,
                "event":     event_name,
                "timestamp": timestamp
            }, indent=2)
        )

    return {"score": score, "alerted": score >= THRESHOLD}
```

### 6.4 SageMaker Isolation Forest endpoint

```hcl
resource "aws_sagemaker_model" "anomaly_detector" {
  name               = "${var.project_name}-anomaly-detector"
  execution_role_arn = aws_iam_role.sagemaker.arn

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
```

---

## 7. CloudTrail + S3 Object Lock — Audit & Compliance

The original spec has no CloudTrail configuration at all. The agent must create this.

### 7.1 Terraform (`modules/cloudtrail/main.tf`)

```hcl
resource "aws_cloudtrail" "main" {
  name                          = "${var.project_name}-trail"
  s3_bucket_name                = var.audit_bucket_name
  include_global_service_events = true
  is_multi_region_trail         = true
  enable_log_file_validation    = true
  kms_key_id                    = var.kms_key_arn

  event_selector {
    read_write_type           = "All"
    include_management_events = true

    data_resource {
      type   = "AWS::S3::Object"
      values = ["${var.primary_bucket_arn}/"]
    }
  }

  insight_selector {
    insight_type = "ApiCallRateInsight"
  }

  cloud_watch_logs_group_arn = "${aws_cloudwatch_log_group.cloudtrail.arn}:*"
  cloud_watch_logs_role_arn  = aws_iam_role.cloudtrail_cw.arn
}

resource "aws_cloudwatch_log_group" "cloudtrail" {
  name              = "/aws/cloudtrail/${var.project_name}"
  retention_in_days = 90
}

# EventBridge rule to forward S3 GetObject events to anomaly Lambda
resource "aws_cloudwatch_event_rule" "s3_access" {
  name        = "${var.project_name}-s3-access"
  description = "Forward S3 data access events to anomaly detector"
  event_pattern = jsonencode({
    source       = ["aws.s3"]
    "detail-type" = ["AWS API Call via CloudTrail"]
    detail = {
      eventSource = ["s3.amazonaws.com"]
      eventName   = ["GetObject", "DeleteObject"]
    }
  })
}

resource "aws_cloudwatch_event_target" "anomaly_lambda" {
  rule      = aws_cloudwatch_event_rule.s3_access.name
  target_id = "AnomalyLambda"
  arn       = var.lambda_anomaly_arn
}

resource "aws_lambda_permission" "allow_eventbridge_invoke_anomaly" {
  statement_id  = "AllowEventBridgeInvoke"
  action        = "lambda:InvokeFunction"
  function_name = var.lambda_anomaly_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.s3_access.arn
}
```

### 7.2 Backend `cloudtrail.js` service (replacing original stub)

The original spec lists a `cloudtrail.js` service but does not implement it. This is the implementation:

```javascript
// server/src/services/cloudtrail.js
import { CloudTrailClient, LookupEventsCommand } from "@aws-sdk/client-cloudtrail";

const client = new CloudTrailClient({ region: process.env.AWS_REGION });

/**
 * Returns the last N access events for the primary S3 bucket.
 * Used by the Access Logs page in the frontend.
 */
export async function getRecentAccessEvents({ limit = 50, startTime, endTime } = {}) {
  const cmd = new LookupEventsCommand({
    LookupAttributes: [{
      AttributeKey:   "ResourceName",
      AttributeValue: process.env.S3_BUCKET_PRIMARY
    }],
    StartTime:  startTime ? new Date(startTime) : new Date(Date.now() - 24 * 60 * 60 * 1000),
    EndTime:    endTime   ? new Date(endTime)   : new Date(),
    MaxResults: limit
  });
  const response = await client.send(cmd);
  return (response.Events || []).map(e => ({
    eventId:    e.EventId,
    eventName:  e.EventName,
    eventTime:  e.EventTime,
    username:   e.Username,
    sourceIp:   e.CloudTrailEvent
                  ? JSON.parse(e.CloudTrailEvent).sourceIPAddress
                  : "unknown",
    resources:  (e.Resources || []).map(r => r.ResourceName)
  }));
}
```

---

## 8. AWS CloudFront — Origin Access Control

The original spec lists CloudFront as a service but does not configure OAC. Without OAC, S3 documents are accessible without CloudFront, bypassing all security controls.

```hcl
# modules/cloudfront/main.tf

resource "aws_cloudfront_origin_access_control" "s3_oac" {
  name                              = "${var.project_name}-oac"
  description                       = "OAC for CloudDocVault primary S3 bucket"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_cloudfront_distribution" "main" {
  enabled             = true
  is_ipv6_enabled     = true
  default_root_object = "index.html"
  price_class         = "PriceClass_100"

  origin {
    domain_name              = var.s3_primary_regional_domain
    origin_id                = "S3Primary"
    origin_access_control_id = aws_cloudfront_origin_access_control.s3_oac.id
  }

  # EC2 backend origin — for /api/* requests
  origin {
    domain_name = var.ec2_public_dns
    origin_id   = "EC2Backend"
    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "http-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  default_cache_behavior {
    target_origin_id       = "S3Primary"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET","HEAD","OPTIONS"]
    cached_methods         = ["GET","HEAD"]
    compress               = true
    cache_policy_id        = data.aws_cloudfront_cache_policy.optimised.id
  }

  # API calls bypass S3 and go to EC2
  ordered_cache_behavior {
    path_pattern           = "/api/*"
    target_origin_id       = "EC2Backend"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["DELETE","GET","HEAD","OPTIONS","PATCH","POST","PUT"]
    cached_methods         = ["GET","HEAD"]
    cache_policy_id        = data.aws_cloudfront_cache_policy.disabled.id
    origin_request_policy_id = data.aws_cloudfront_origin_request_policy.all_viewer.id
  }

  restrictions {
    geo_restriction { restriction_type = "none" }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }
}
```

---

## 9. AWS Cognito — Full Configuration

The original spec mentions Cognito but does not configure it. The agent must create a full Cognito User Pool with the required password policy, MFA settings, and an App Client.

```hcl
# modules/cognito/main.tf

resource "aws_cognito_user_pool" "main" {
  name = "${var.project_name}-users"

  password_policy {
    minimum_length                   = 12
    require_lowercase                = true
    require_numbers                  = true
    require_symbols                  = true
    require_uppercase                = true
    temporary_password_validity_days = 7
  }

  mfa_configuration = "OPTIONAL"
  software_token_mfa_configuration {
    enabled = true
  }

  account_recovery_setting {
    recovery_mechanism {
      name     = "verified_email"
      priority = 1
    }
  }

  admin_create_user_config {
    allow_admin_create_user_only = true
  }

  schema {
    name                = "department"
    attribute_data_type = "String"
    mutable             = true
    string_attribute_constraints {
      min_length = 1
      max_length = 64
    }
  }

  user_pool_add_ons {
    advanced_security_mode = "ENFORCED"
  }
}

resource "aws_cognito_user_pool_client" "app" {
  name         = "${var.project_name}-app-client"
  user_pool_id = aws_cognito_user_pool.main.id

  explicit_auth_flows = [
    "ALLOW_USER_SRP_AUTH",
    "ALLOW_REFRESH_TOKEN_AUTH"
  ]

  token_validity_units {
    access_token  = "hours"
    id_token      = "hours"
    refresh_token = "days"
  }
  access_token_validity  = 1
  id_token_validity      = 1
  refresh_token_validity = 30

  prevent_user_existence_errors = "ENABLED"
  generate_secret               = false
}

resource "aws_cognito_user_group" "admins" {
  name         = "Admins"
  user_pool_id = aws_cognito_user_pool.main.id
  description  = "Administrator users with full access"
}

resource "aws_cognito_user_group" "users" {
  name         = "Users"
  user_pool_id = aws_cognito_user_pool.main.id
  description  = "Standard users with document access"
}
```

The backend `cognito.js` service must verify JWT tokens using the Cognito JWKS endpoint:

```javascript
// server/src/services/cognito.js
import { CognitoJwtVerifier } from "aws-jwt-verify";

const verifier = CognitoJwtVerifier.create({
  userPoolId: process.env.COGNITO_USER_POOL_ID,
  tokenUse:   "access",
  clientId:   process.env.COGNITO_CLIENT_ID
});

export async function verifyToken(token) {
  try {
    const payload = await verifier.verify(token);
    return { valid: true, payload };
  } catch (err) {
    return { valid: false, error: err.message };
  }
}

export function extractGroups(payload) {
  return payload["cognito:groups"] || [];
}

export function isAdmin(payload) {
  return extractGroups(payload).includes("Admins");
}
```

---

## 10. Prometheus — Deployment & Custom Metrics

### 10.1 Installation script (`scripts/install_monitoring.sh`)

This script must be called by `deploy.sh` after the application is running. It runs on the EC2 instance.

```bash
#!/usr/bin/env bash
set -euo pipefail

PROM_VERSION="2.47.0"
GRAFANA_VERSION="10.2.3"
EXPORTER_PORT="8000"
NODE_EXPORTER_VERSION="1.7.0"

# ── Install Prometheus ─────────────────────────────────────────────────────────
cd /tmp
wget -q "https://github.com/prometheus/prometheus/releases/download/v${PROM_VERSION}/prometheus-${PROM_VERSION}.linux-amd64.tar.gz"
tar xzf "prometheus-${PROM_VERSION}.linux-amd64.tar.gz"
sudo mv "prometheus-${PROM_VERSION}.linux-amd64/prometheus" /usr/local/bin/
sudo mv "prometheus-${PROM_VERSION}.linux-amd64/promtool"   /usr/local/bin/
sudo mkdir -p /etc/prometheus /var/lib/prometheus
sudo useradd --no-create-home --shell /bin/false prometheus 2>/dev/null || true
sudo chown prometheus:prometheus /var/lib/prometheus

# Copy config
sudo cp /home/ubuntu/clouddocvault/monitoring/prometheus/prometheus.yml /etc/prometheus/
sudo cp /home/ubuntu/clouddocvault/monitoring/prometheus/alerts.yml      /etc/prometheus/
sudo chown -R prometheus:prometheus /etc/prometheus

# Systemd unit
sudo tee /etc/systemd/system/prometheus.service > /dev/null <<EOF
[Unit]
Description=Prometheus
After=network.target

[Service]
User=prometheus
ExecStart=/usr/local/bin/prometheus \
  --config.file=/etc/prometheus/prometheus.yml \
  --storage.tsdb.path=/var/lib/prometheus \
  --storage.tsdb.retention.time=30d \
  --web.listen-address=0.0.0.0:9090
Restart=always

[Install]
WantedBy=multi-user.target
EOF
sudo systemctl daemon-reload
sudo systemctl enable --now prometheus

# ── Install node_exporter ──────────────────────────────────────────────────────
wget -q "https://github.com/prometheus/node_exporter/releases/download/v${NODE_EXPORTER_VERSION}/node_exporter-${NODE_EXPORTER_VERSION}.linux-amd64.tar.gz"
tar xzf "node_exporter-${NODE_EXPORTER_VERSION}.linux-amd64.tar.gz"
sudo mv "node_exporter-${NODE_EXPORTER_VERSION}.linux-amd64/node_exporter" /usr/local/bin/
sudo useradd --no-create-home --shell /bin/false node_exporter 2>/dev/null || true
sudo tee /etc/systemd/system/node_exporter.service > /dev/null <<EOF
[Unit]
Description=Node Exporter
After=network.target

[Service]
User=node_exporter
ExecStart=/usr/local/bin/node_exporter
Restart=always

[Install]
WantedBy=multi-user.target
EOF
sudo systemctl daemon-reload
sudo systemctl enable --now node_exporter

# ── Install Grafana ────────────────────────────────────────────────────────────
sudo apt-get install -y -qq adduser libfontconfig1 musl
wget -q "https://dl.grafana.com/oss/release/grafana_${GRAFANA_VERSION}_amd64.deb"
sudo dpkg -i "grafana_${GRAFANA_VERSION}_amd64.deb"
sudo systemctl enable --now grafana-server

# Copy provisioning configs
sudo cp -r /home/ubuntu/clouddocvault/monitoring/grafana/provisioning/. /etc/grafana/provisioning/
sudo cp -r /home/ubuntu/clouddocvault/monitoring/grafana/dashboards/.   /var/lib/grafana/dashboards/
sudo chown -R grafana:grafana /etc/grafana/provisioning /var/lib/grafana/dashboards
sudo systemctl restart grafana-server

# ── Install custom CloudDocVault exporter ──────────────────────────────────────
pip3 install prometheus_client boto3 --quiet
sudo tee /etc/systemd/system/cdv-exporter.service > /dev/null <<EOF
[Unit]
Description=CloudDocVault Prometheus Exporter
After=network.target

[Service]
User=ubuntu
WorkingDirectory=/home/ubuntu/clouddocvault
ExecStart=/usr/bin/python3 monitoring/exporters/clouddocvault_exporter.py
Environment="AWS_DEFAULT_REGION=${AWS_DEFAULT_REGION}"
Environment="PRIMARY_BUCKET=${S3_BUCKET_PRIMARY}"
Environment="EXPORTER_PORT=${EXPORTER_PORT}"
Restart=always

[Install]
WantedBy=multi-user.target
EOF
sudo systemctl daemon-reload
sudo systemctl enable --now cdv-exporter

echo "Monitoring stack installed — Prometheus:9090 | Grafana:3000 | Exporter:${EXPORTER_PORT}"
```

### 10.2 Prometheus configuration (`monitoring/prometheus/prometheus.yml`)

```yaml
global:
  scrape_interval:     15s
  evaluation_interval: 15s

rule_files:
  - /etc/prometheus/alerts.yml

alerting:
  alertmanagers:
    - static_configs:
        - targets: ["localhost:9093"]

scrape_configs:
  - job_name: "clouddocvault_app"
    static_configs:
      - targets: ["localhost:8000"]
    metrics_path: "/metrics"
    scrape_interval: 15s

  - job_name: "node"
    static_configs:
      - targets: ["localhost:9100"]

  - job_name: "cloudwatch"
    static_configs:
      - targets: ["localhost:9106"]

  - job_name: "nginx"
    static_configs:
      - targets: ["localhost:9113"]
```

### 10.3 Alerting rules (`monitoring/prometheus/alerts.yml`)

```yaml
groups:
  - name: clouddocvault
    rules:
      - alert: HighUploadErrorRate
        expr: rate(cdv_uploads_total{status="error"}[5m]) / rate(cdv_uploads_total[5m]) > 0.05
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Upload error rate exceeds 5%"

      - alert: PresignLatencyHigh
        expr: histogram_quantile(0.95, rate(cdv_presign_duration_seconds_bucket[10m])) > 0.5
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "Pre-signed URL generation p95 > 500ms"

      - alert: AnomalyScoreHigh
        expr: cdv_anomaly_score > 0.8
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Anomaly score above threshold — possible insider threat"

      - alert: LambdaErrorRateHigh
        expr: rate(cdv_lambda_errors_total[5m]) / rate(cdv_lambda_invocations_total[5m]) > 0.02
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Lambda error rate exceeds 2%"

      - alert: S3StorageGrowthRapid
        expr: increase(cdv_s3_bucket_size_bytes[1d]) / cdv_s3_bucket_size_bytes > 0.10
        for: 30m
        labels:
          severity: warning
        annotations:
          summary: "S3 bucket growing more than 10% per day"
```

### 10.4 Custom exporter (`monitoring/exporters/clouddocvault_exporter.py`)

```python
#!/usr/bin/env python3
"""
CloudDocVault Prometheus exporter.
Scrapes CloudWatch metrics and application state, exposes on :8000/metrics.
"""
import os
import time
import boto3
from prometheus_client import start_http_server, Gauge, Counter, Histogram, REGISTRY
from prometheus_client.core import CounterMetricFamily, GaugeMetricFamily

PORT   = int(os.environ.get("EXPORTER_PORT", "8000"))
REGION = os.environ.get("AWS_DEFAULT_REGION", "us-east-1")
BUCKET = os.environ.get("PRIMARY_BUCKET", "")

cw = boto3.client("cloudwatch", region_name=REGION)
s3 = boto3.client("s3",         region_name=REGION)

# ── Application metrics (updated by backend via /internal/metrics POST) ────────
cdv_uploads_total          = Counter("cdv_uploads_total",         "Total upload requests",      ["status"])
cdv_downloads_total        = Counter("cdv_downloads_total",       "Total download requests",    ["status"])
cdv_presign_duration       = Histogram("cdv_presign_duration_seconds", "Pre-signed URL generation latency",
                                        buckets=[0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0])
cdv_s3_errors_total        = Counter("cdv_s3_errors_total",       "S3 API errors",              ["error_code"])
cdv_active_sessions        = Gauge("cdv_active_sessions",         "Active authenticated sessions")
cdv_anomaly_score          = Gauge("cdv_anomaly_score",           "Latest anomaly score",        ["user"])
cdv_classification_total   = Counter("cdv_classification_total",  "ML classification requests", ["label", "status"])
cdv_classification_latency = Histogram("cdv_classification_latency_seconds", "Classification latency",
                                        buckets=[0.5, 1.0, 2.0, 5.0, 10.0, 30.0])

# ── CloudWatch-sourced metrics (polled from AWS) ───────────────────────────────
cdv_s3_bucket_size_bytes   = Gauge("cdv_s3_bucket_size_bytes",   "S3 bucket size in bytes")
cdv_s3_object_count        = Gauge("cdv_s3_object_count",        "Number of objects in primary bucket")
cdv_lambda_errors_total    = Gauge("cdv_lambda_errors_total",    "Lambda error count (1h window)",  ["function"])
cdv_lambda_invocations     = Gauge("cdv_lambda_invocations_total","Lambda invocations (1h window)", ["function"])


def collect_cloudwatch_metrics():
    now   = __import__("datetime").datetime.utcnow()
    start = now - __import__("datetime").timedelta(hours=1)

    def _get(metric_name, namespace, dimensions, stat="Sum"):
        r = cw.get_metric_statistics(
            Namespace=namespace, MetricName=metric_name,
            Dimensions=dimensions, StartTime=start, EndTime=now,
            Period=3600, Statistics=[stat]
        )
        pts = r.get("Datapoints", [])
        return pts[0][stat] if pts else 0.0

    # S3 storage metrics (daily granularity)
    size = _get("BucketSizeBytes", "AWS/S3",
                [{"Name": "BucketName", "Value": BUCKET},
                 {"Name": "StorageType", "Value": "StandardStorage"}], "Average")
    objs = _get("NumberOfObjects", "AWS/S3",
                [{"Name": "BucketName", "Value": BUCKET},
                 {"Name": "StorageType", "Value": "AllStorageTypes"}], "Average")
    cdv_s3_bucket_size_bytes.set(size)
    cdv_s3_object_count.set(objs)

    # Lambda metrics for each function
    for fn in ["presign", "ml-classify", "anomaly"]:
        fn_name = f"clouddocvault-{fn}"
        errors  = _get("Errors",      "AWS/Lambda", [{"Name":"FunctionName","Value":fn_name}])
        invocs  = _get("Invocations", "AWS/Lambda", [{"Name":"FunctionName","Value":fn_name}])
        cdv_lambda_errors_total.labels(function=fn).set(errors)
        cdv_lambda_invocations.labels(function=fn).set(invocs)


if __name__ == "__main__":
    start_http_server(PORT)
    print(f"CloudDocVault exporter running on :{PORT}/metrics")
    while True:
        try:
            collect_cloudwatch_metrics()
        except Exception as e:
            print(f"Collection error: {e}")
        time.sleep(60)
```

---

## 11. Grafana — Five Production Dashboards

### 11.1 Datasource provisioning (`monitoring/grafana/provisioning/datasources/prometheus.yml`)

```yaml
apiVersion: 1
datasources:
  - name:      Prometheus
    type:      prometheus
    access:    proxy
    url:       http://localhost:9090
    isDefault: true
    version:   1
    editable:  false
```

### 11.2 Dashboard provisioning (`monitoring/grafana/provisioning/dashboards/dashboards.yml`)

```yaml
apiVersion: 1
providers:
  - name:    CloudDocVault
    orgId:   1
    type:    file
    options:
      path: /var/lib/grafana/dashboards
    updateIntervalSeconds: 30
    allowUiUpdates:        false
```

### 11.3 Five dashboard JSON files

The agent must create these five JSON files in `monitoring/grafana/dashboards/`. Each must be a valid Grafana dashboard JSON object. The agent must produce the full JSON — these are not stubs.

**Dashboard 1 — `document_ops.json`**  
Title: "Document Operations"  
Refresh: 30s  
Panels:
- Upload rate per minute (time series) — query: `rate(cdv_uploads_total{status="success"}[1m])*60`
- Download rate per minute (time series) — query: `rate(cdv_downloads_total{status="success"}[1m])*60`
- Upload error rate % (gauge, 0–100, red above 5) — query: `rate(cdv_uploads_total{status="error"}[5m]) / rate(cdv_uploads_total[5m]) * 100`
- Pre-signed URL p95 latency ms (stat) — query: `histogram_quantile(0.95, rate(cdv_presign_duration_seconds_bucket[5m])) * 1000`
- Active sessions (stat) — query: `cdv_active_sessions`
- Classification throughput (time series) — query: `rate(cdv_classification_total[1m])*60`

**Dashboard 2 — `s3_health.json`**  
Title: "S3 Storage Health"  
Refresh: 5m  
Panels:
- Bucket size GB over 30 days (time series) — query: `cdv_s3_bucket_size_bytes / 1024 / 1024 / 1024`
- Object count trend (time series) — query: `cdv_s3_object_count`
- S3 error count by code (bar chart) — query: `cdv_s3_errors_total`
- Lambda invocations by function (bar chart) — query: `cdv_lambda_invocations_total`

**Dashboard 3 — `ml_intelligence.json`**  
Title: "ML Intelligence"  
Refresh: 15s  
Panels:
- Classification requests per minute (time series) — query: `rate(cdv_classification_total[1m])*60`
- Classification label distribution (pie) — query: `sum by (label)(cdv_classification_total{status="success"})`
- Classification p95 latency seconds (stat) — query: `histogram_quantile(0.95, rate(cdv_classification_latency_seconds_bucket[5m]))`
- Anomaly score over time (time series, threshold line at 0.75) — query: `cdv_anomaly_score`
- Active anomaly alerts (stat, red when >0) — query: `count(cdv_anomaly_score > 0.75) or vector(0)`

**Dashboard 4 — `security_access.json`**  
Title: "Security and Access"  
Refresh: 1m  
Panels:
- S3 error rate (time series) — query: `rate(cdv_s3_errors_total[5m])`
- Anomaly events total (stat) — query: `cdv_anomaly_score`
- Lambda errors per function (bar chart) — query: `cdv_lambda_errors_total`
- Upload errors vs successes (time series dual) — queries: `rate(cdv_uploads_total{status="success"}[1m])` and `rate(cdv_uploads_total{status="error"}[1m])`

**Dashboard 5 — `infra_health.json`**  
Title: "Infrastructure Health"  
Refresh: 15s  
Panels:
- EC2 CPU utilisation % (time series) — query: `100 - (avg by (instance)(rate(node_cpu_seconds_total{mode="idle"}[1m]))*100)`
- EC2 memory used % (stat) — query: `(1 - node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes) * 100`
- EC2 disk used % (stat) — query: `(1 - node_filesystem_avail_bytes{mountpoint="/"} / node_filesystem_size_bytes{mountpoint="/"}) * 100`
- Lambda p95 duration (stat per function) — from CloudWatch via Prometheus
- SageMaker endpoint invocations (time series) — from CloudWatch via Prometheus

---

## 12. GitHub Actions CI/CD Pipeline

The original spec has no CI/CD pipeline — deployment is purely manual. The agent must create the following workflow.

### 12.1 File: `.github/workflows/deploy.yml`

```yaml
name: Deploy CloudDocVault

on:
  push:
    branches: [main]
  workflow_dispatch:

env:
  AWS_REGION:   us-east-1
  TF_VERSION:   1.6.6
  NODE_VERSION: 20

jobs:

  lint-and-test:
    name: Lint and test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: npm
          cache-dependency-path: server/package-lock.json

      - name: Install backend deps
        run: cd server && npm ci

      - name: Run backend tests
        run: cd server && npm test

      - name: Setup Terraform
        uses: hashicorp/setup-terraform@v3
        with:
          terraform_version: ${{ env.TF_VERSION }}

      - name: Terraform fmt check
        run: cd terraform && terraform fmt -check -recursive

      - name: Run tfsec
        uses: aquasecurity/tfsec-action@v1.0.3
        with:
          working_directory: terraform

      - name: Run checkov
        uses: bridgecrewio/checkov-action@v12
        with:
          directory: terraform
          soft_fail: false

  deploy-infra:
    name: Deploy infrastructure
    needs: lint-and-test
    runs-on: ubuntu-latest
    environment: production
    permissions:
      id-token: write
      contents: read

    steps:
      - uses: actions/checkout@v4

      - name: Configure AWS credentials (OIDC)
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume:    ${{ secrets.AWS_DEPLOY_ROLE_ARN }}
          aws-region:        ${{ env.AWS_REGION }}
          role-session-name: GitHubActionsDeploySession

      - name: Setup Terraform
        uses: hashicorp/setup-terraform@v3
        with:
          terraform_version: ${{ env.TF_VERSION }}

      - name: Build Lambda packages
        run: bash lambda/build_lambdas.sh

      - name: Terraform init
        run: cd terraform && terraform init

      - name: Terraform plan
        run: cd terraform && terraform plan -var-file=environments/prod.tfvars -out=tfplan -no-color
        env:
          TF_VAR_ec2_key_name: ${{ secrets.EC2_KEY_NAME }}

      - name: Terraform apply
        run: cd terraform && terraform apply -auto-approve tfplan

      - name: Capture Terraform outputs
        id: tf_outputs
        run: |
          cd terraform
          echo "ec2_ip=$(terraform output -raw ec2_public_ip)"                   >> $GITHUB_OUTPUT
          echo "s3_bucket=$(terraform output -raw s3_primary_bucket)"            >> $GITHUB_OUTPUT
          echo "cloudfront=$(terraform output -raw cloudfront_domain)"           >> $GITHUB_OUTPUT
          echo "cognito_pool=$(terraform output -raw cognito_user_pool_id)"      >> $GITHUB_OUTPUT
          echo "cognito_client=$(terraform output -raw cognito_client_id)"       >> $GITHUB_OUTPUT

  deploy-app:
    name: Deploy application
    needs: deploy-infra
    runs-on: ubuntu-latest
    environment: production
    permissions:
      id-token: write
      contents: read

    steps:
      - uses: actions/checkout@v4

      - name: Configure AWS credentials (OIDC)
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume:    ${{ secrets.AWS_DEPLOY_ROLE_ARN }}
          aws-region:        ${{ env.AWS_REGION }}
          role-session-name: GitHubActionsAppDeploySession

      - name: SSH and deploy to EC2
        uses: appleboy/ssh-action@v1.0.3
        with:
          host:        ${{ needs.deploy-infra.outputs.ec2_ip }}
          username:    ubuntu
          key:         ${{ secrets.EC2_SSH_PRIVATE_KEY }}
          timeout:     600s
          script: |
            set -euo pipefail
            cd /home/ubuntu/clouddocvault
            git fetch origin main
            git reset --hard origin/main
            bash deploy.sh
```

### 12.2 Required GitHub Actions secrets

The agent must document these in `README.md`:

| Secret name | Description |
|-------------|-------------|
| `AWS_DEPLOY_ROLE_ARN` | ARN of the IAM role assumed via OIDC by GitHub Actions |
| `EC2_KEY_NAME` | Name of the EC2 key pair in AWS |
| `EC2_SSH_PRIVATE_KEY` | Private key PEM for SSH access to EC2 |

### 12.3 GitHub OIDC IAM role (Terraform)

```hcl
# modules/iam/github_oidc.tf

resource "aws_iam_openid_connect_provider" "github" {
  url             = "https://token.actions.githubusercontent.com"
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = ["6938fd4d98bab03faadb97b34396831e3780aea1"]
}

resource "aws_iam_role" "github_actions_deploy" {
  name = "${var.project_name}-github-actions-deploy"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Federated = aws_iam_openid_connect_provider.github.arn }
      Action    = "sts:AssumeRoleWithWebIdentity"
      Condition = {
        StringEquals = {
          "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
        }
        StringLike = {
          "token.actions.githubusercontent.com:sub" = "repo:${var.github_org}/${var.github_repo}:*"
        }
      }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "github_terraform" {
  role       = aws_iam_role.github_actions_deploy.name
  policy_arn = aws_iam_policy.terraform_deploy.arn
}
```

---

## 13. Deploy Script Extensions

The original `deploy.sh` script in the existing spec handles only application startup. The agent must extend it to do everything in order. The final `deploy.sh` must be a single file that runs the full sequence below without any human input.

The AWS credentials are pre-exported by the user (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_DEFAULT_REGION`) before running the script. The script uses them only for the Terraform bootstrap phase and then immediately stops using static credentials — all application runtime credential use comes from the EC2 instance profile.

```bash
#!/usr/bin/env bash
# =============================================================================
# CloudDocVault — One-command deploy script
# Prerequisites:
#   1. git clone of this repo on the EC2 instance (or run locally — the script
#      SSHes into EC2 for the application deployment steps)
#   2. AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_DEFAULT_REGION exported
#   3. Terraform 1.6+ installed
#   4. AWS CLI v2 installed
# =============================================================================
set -euo pipefail

PROJECT="clouddocvault"
REGION="${AWS_DEFAULT_REGION:-us-east-1}"

log()  { echo "[$(date '+%H:%M:%S')] $*"; }
die()  { echo "[ERROR] $*" >&2; exit 1; }
check_dep() { command -v "$1" >/dev/null 2>&1 || die "$1 is required but not installed."; }

# ── Preflight checks ──────────────────────────────────────────────────────────
check_dep terraform
check_dep aws
check_dep node
check_dep npm
check_dep python3

[[ -n "${AWS_ACCESS_KEY_ID:-}"     ]] || die "AWS_ACCESS_KEY_ID not set"
[[ -n "${AWS_SECRET_ACCESS_KEY:-}" ]] || die "AWS_SECRET_ACCESS_KEY not set"
[[ -n "${AWS_DEFAULT_REGION:-}"    ]] || die "AWS_DEFAULT_REGION not set"

aws sts get-caller-identity > /dev/null 2>&1 || die "AWS credentials are invalid"

ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
log "Deploying to AWS account ${ACCOUNT_ID} in ${REGION}"

# ── Step 1: Bootstrap Terraform state backend ─────────────────────────────────
log "Bootstrapping Terraform state backend..."

STATE_BUCKET="${PROJECT}-tfstate-${ACCOUNT_ID}"
LOCK_TABLE="${PROJECT}-tfstate-lock"
KMS_ALIAS="alias/${PROJECT}-tfstate"

# Create KMS key if not exists
KMS_KEY_ID=$(aws kms list-aliases --query "Aliases[?AliasName=='${KMS_ALIAS}'].TargetKeyId" --output text 2>/dev/null || echo "")
if [[ -z "${KMS_KEY_ID}" ]]; then
  log "Creating KMS key..."
  KMS_KEY_ID=$(aws kms create-key --description "CloudDocVault Terraform state key" --query KeyMetadata.KeyId --output text)
  aws kms create-alias --alias-name "${KMS_ALIAS}" --target-key-id "${KMS_KEY_ID}"
fi

# Create state bucket if not exists
if ! aws s3api head-bucket --bucket "${STATE_BUCKET}" 2>/dev/null; then
  log "Creating Terraform state bucket..."
  if [[ "${REGION}" == "us-east-1" ]]; then
    aws s3api create-bucket --bucket "${STATE_BUCKET}" --region "${REGION}"
  else
    aws s3api create-bucket --bucket "${STATE_BUCKET}" --region "${REGION}" \
      --create-bucket-configuration LocationConstraint="${REGION}"
  fi
  aws s3api put-bucket-versioning --bucket "${STATE_BUCKET}" \
    --versioning-configuration Status=Enabled
  aws s3api put-bucket-encryption --bucket "${STATE_BUCKET}" \
    --server-side-encryption-configuration "{\"Rules\":[{\"ApplyServerSideEncryptionByDefault\":{\"SSEAlgorithm\":\"aws:kms\",\"KMSMasterKeyID\":\"${KMS_KEY_ID}\"}}]}"
  aws s3api put-public-access-block --bucket "${STATE_BUCKET}" \
    --public-access-block-configuration "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"
fi

# Create DynamoDB lock table if not exists
if ! aws dynamodb describe-table --table-name "${LOCK_TABLE}" 2>/dev/null; then
  log "Creating DynamoDB lock table..."
  aws dynamodb create-table \
    --table-name "${LOCK_TABLE}" \
    --attribute-definitions AttributeName=LockID,AttributeType=S \
    --key-schema AttributeName=LockID,KeyType=HASH \
    --billing-mode PAY_PER_REQUEST \
    --region "${REGION}"
  aws dynamodb wait table-exists --table-name "${LOCK_TABLE}"
fi

# Patch backend.tf with actual bucket name and account
sed -i "s/bucket\s*=\s*\"clouddocvault-tfstate\"/bucket = \"${STATE_BUCKET}\"/" terraform/backend.tf

# ── Step 2: Build Lambda ZIP packages ─────────────────────────────────────────
log "Building Lambda packages..."
bash lambda/build_lambdas.sh

# ── Step 3: Terraform init, plan, apply ──────────────────────────────────────
log "Running Terraform..."
cd terraform
terraform init -reconfigure -input=false
terraform validate
terraform plan -var-file=environments/prod.tfvars -out=tfplan -input=false -no-color
terraform apply -auto-approve tfplan

# ── Step 4: Capture Terraform outputs ─────────────────────────────────────────
log "Reading Terraform outputs..."
EC2_PUBLIC_IP=$(terraform output -raw ec2_public_ip)
S3_BUCKET_PRIMARY=$(terraform output -raw s3_primary_bucket)
S3_BUCKET_AUDIT=$(terraform output -raw s3_audit_bucket)
CLOUDFRONT_DOMAIN=$(terraform output -raw cloudfront_domain)
COGNITO_USER_POOL_ID=$(terraform output -raw cognito_user_pool_id)
COGNITO_CLIENT_ID=$(terraform output -raw cognito_client_id)
LAMBDA_PRESIGN_NAME=$(terraform output -raw lambda_presign_name)
LAMBDA_ML_NAME=$(terraform output -raw lambda_ml_classify_name)
LAMBDA_ANOMALY_NAME=$(terraform output -raw lambda_anomaly_name)
cd ..

log "EC2: ${EC2_PUBLIC_IP}"
log "S3:  ${S3_BUCKET_PRIMARY}"
log "CF:  ${CLOUDFRONT_DOMAIN}"

# ── Step 5: Wait for EC2 SSH readiness ────────────────────────────────────────
log "Waiting for EC2 SSH..."
for i in $(seq 1 30); do
  ssh -o StrictHostKeyChecking=no -o ConnectTimeout=5 \
    ubuntu@"${EC2_PUBLIC_IP}" "echo ok" 2>/dev/null && break
  sleep 10
  [[ $i -eq 30 ]] && die "EC2 not reachable after 5 minutes"
done

# ── Step 6: Deploy application to EC2 ─────────────────────────────────────────
log "Deploying application to EC2..."
ssh -o StrictHostKeyChecking=no ubuntu@"${EC2_PUBLIC_IP}" bash -s << REMOTE
set -euo pipefail

# Install system packages
sudo apt-get update -qq
sudo apt-get install -y -qq git nginx nodejs npm python3 python3-pip

# Install PM2
sudo npm install -g pm2 --silent

# Clone or pull repo
if [ ! -d /home/ubuntu/clouddocvault ]; then
  git clone \$(git remote get-url origin) /home/ubuntu/clouddocvault
else
  cd /home/ubuntu/clouddocvault
  git fetch origin main
  git reset --hard origin/main
fi

cd /home/ubuntu/clouddocvault

# Write backend .env (NO static AWS credentials — uses instance profile)
JWT_SECRET=\$(openssl rand -hex 32)
cat > server/.env << ENV
PORT=3001
NODE_ENV=production
AWS_REGION=${REGION}
S3_BUCKET_PRIMARY=${S3_BUCKET_PRIMARY}
S3_BUCKET_AUDIT=${S3_BUCKET_AUDIT}
CLOUDFRONT_DOMAIN=${CLOUDFRONT_DOMAIN}
COGNITO_USER_POOL_ID=${COGNITO_USER_POOL_ID}
COGNITO_CLIENT_ID=${COGNITO_CLIENT_ID}
COGNITO_REGION=${REGION}
LAMBDA_PRESIGN_NAME=${LAMBDA_PRESIGN_NAME}
LAMBDA_ML_NAME=${LAMBDA_ML_NAME}
LAMBDA_ANOMALY_NAME=${LAMBDA_ANOMALY_NAME}
CLOUDWATCH_NAMESPACE=CloudDocVault
PROMETHEUS_URL=http://localhost:9090
CORS_ORIGIN=http://${EC2_PUBLIC_IP}
JWT_COOKIE_SECRET=\${JWT_SECRET}
ENV

# Write frontend .env
cat > client/.env << ENV
VITE_API_BASE_URL=/api
VITE_APP_NAME=CloudDocVault
VITE_CLOUDFRONT_DOMAIN=${CLOUDFRONT_DOMAIN}
VITE_COGNITO_USER_POOL_ID=${COGNITO_USER_POOL_ID}
VITE_COGNITO_CLIENT_ID=${COGNITO_CLIENT_ID}
VITE_COGNITO_REGION=${REGION}
ENV

# Install and build
cd server  && npm ci --omit=dev --silent && cd ..
cd client  && npm ci --silent && npm run build --silent && cd ..

# Install Nginx config
sudo cp scripts/nginx.conf /etc/nginx/sites-available/clouddocvault
sudo ln -sf /etc/nginx/sites-available/clouddocvault /etc/nginx/sites-enabled/clouddocvault
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx
sudo systemctl enable nginx

# Start application via PM2
mkdir -p logs
pm2 delete clouddocvault-api 2>/dev/null || true
pm2 start server/ecosystem.config.js --env production
pm2 save
pm2 startup systemd -u ubuntu --hp /home/ubuntu | tail -1 | sudo bash

# Install monitoring stack
bash scripts/install_monitoring.sh

REMOTE

# ── Step 7: Health check ───────────────────────────────────────────────────────
log "Running health check..."
sleep 8
HTTP=$(curl -s -o /dev/null -w "%{http_code}" "http://${EC2_PUBLIC_IP}/api/health" || echo "000")
[[ "${HTTP}" == "200" ]] || die "Health check failed — HTTP ${HTTP}. Check: ssh ubuntu@${EC2_PUBLIC_IP} pm2 logs"

log "Health check passed."

# ── Step 8: Print deployment summary ──────────────────────────────────────────
cat << SUMMARY

================================================================================
  CloudDocVault — Deployment Complete
================================================================================
  Application          http://${EC2_PUBLIC_IP}
  CloudFront (CDN)     https://${CLOUDFRONT_DOMAIN}
  API health           http://${EC2_PUBLIC_IP}/api/health
  Prometheus           http://${EC2_PUBLIC_IP}:9090
  Grafana              http://${EC2_PUBLIC_IP}:3000  (default: admin / admin)
  PM2 status           ssh ubuntu@${EC2_PUBLIC_IP} pm2 status
  Backend logs         ssh ubuntu@${EC2_PUBLIC_IP} pm2 logs clouddocvault-api
  Nginx access log     ssh ubuntu@${EC2_PUBLIC_IP} sudo tail -f /var/log/nginx/access.log
================================================================================
  S3 Primary bucket    ${S3_BUCKET_PRIMARY}
  CloudFront OAC       Active — S3 not directly accessible
  CloudTrail           Active — all S3 data events logged to ${S3_BUCKET_AUDIT}
  Object Lock (WORM)   7-year Compliance mode on audit bucket
  KMS encryption       SSE-KMS on all S3 objects and Lambda env vars
  Anomaly detection    SageMaker Isolation Forest — EventBridge → Lambda
================================================================================
SUMMARY
```

### 13.1 Lambda build script (`lambda/build_lambdas.sh`)

```bash
#!/usr/bin/env bash
set -euo pipefail

for fn in presign ml_classify anomaly; do
  echo "Building lambda/${fn}..."
  cd "lambda/${fn}"
  pip3 install -r requirements.txt -t package/ --quiet
  cp handler.py package/
  cd package
  zip -r9 "../${fn}.zip" . --quiet
  cd ../..
  echo "  -> lambda/${fn}/${fn}.zip"
done
echo "All Lambda packages built."
```

---

## 14. Build Order Addendum

The agent must extend the build order from the original spec Section 12 with these additional steps. Insert after original Step 14 (last step):

```
15. Create /terraform directory tree with all module subdirectories.
16. Write terraform/backend.tf with S3 backend configuration.
17. Write terraform/variables.tf and terraform/outputs.tf.
18. Write terraform/modules/iam/main.tf — EC2 instance role, Lambda roles, KMS policy, GitHub OIDC role.
19. Write terraform/modules/s3/main.tf — primary bucket (versioning, SSE-KMS, lifecycle, notification, replication, bucket policy), DR bucket, audit bucket (Object Lock, WORM).
20. Write terraform/modules/cognito/main.tf — user pool, password policy, MFA, app client, groups.
21. Write terraform/modules/lambda/main.tf — three Lambda functions with scoped roles and environment variables.
22. Write terraform/modules/cloudfront/main.tf — distribution with OAC, S3 origin, EC2 API origin, HTTPS redirect.
23. Write terraform/modules/cloudtrail/main.tf — multi-region trail, log group, EventBridge rule for anomaly scoring.
24. Write terraform/modules/ec2/main.tf — EC2 instance with instance profile, security group (80, 443, 9090, 3000 inbound), key pair.
25. Write terraform/modules/monitoring/main.tf — SageMaker NLP model, NLP endpoint, Isolation Forest model, anomaly endpoint, SNS topic for alerts.
26. Write terraform/environments/dev.tfvars and prod.tfvars.
27. Write all three Lambda function files (lambda/presign/handler.py, lambda/ml_classify/handler.py, lambda/anomaly/handler.py) and their requirements.txt.
28. Write lambda/build_lambdas.sh.
29. Replace server/src/services/s3.js to remove static credential instantiation (use instance profile).
30. Write server/src/services/presign.js using Lambda invocation instead of direct S3 SDK.
31. Write server/src/services/cloudtrail.js with getRecentAccessEvents() fully implemented.
32. Write monitoring/prometheus/prometheus.yml and alerts.yml.
33. Write monitoring/exporters/clouddocvault_exporter.py.
34. Write monitoring/grafana/provisioning/datasources/prometheus.yml.
35. Write monitoring/grafana/provisioning/dashboards/dashboards.yml.
36. Write all five Grafana dashboard JSON files (full valid JSON, not stubs).
37. Write scripts/install_monitoring.sh.
38. Write .github/workflows/deploy.yml.
39. Overwrite deploy.sh with the full extended version from Section 13.
40. Verify: mentally trace — git push → GitHub Actions runs → Terraform provisions S3/IAM/Lambda/Cognito/CloudFront/SageMaker → EC2 starts → PM2 starts backend → Prometheus scrapes → Grafana shows data → health check passes.
```

---

## 15. Environment Variables — Full Reference

Complete list of all environment variables required. Update server `.env` template to include all of these.

| Variable | Source | Description |
|----------|--------|-------------|
| `PORT` | Static | Express server port (3001) |
| `NODE_ENV` | Static | production |
| `AWS_REGION` | Terraform output | Primary AWS region |
| `S3_BUCKET_PRIMARY` | Terraform output | Primary document bucket name |
| `S3_BUCKET_AUDIT` | Terraform output | Audit/CloudTrail bucket name |
| `CLOUDFRONT_DOMAIN` | Terraform output | CloudFront distribution domain |
| `COGNITO_USER_POOL_ID` | Terraform output | Cognito user pool ID |
| `COGNITO_CLIENT_ID` | Terraform output | Cognito app client ID |
| `COGNITO_REGION` | Terraform output | Region of Cognito user pool |
| `LAMBDA_PRESIGN_NAME` | Terraform output | Pre-sign Lambda function name |
| `LAMBDA_ML_NAME` | Terraform output | ML classify Lambda function name |
| `LAMBDA_ANOMALY_NAME` | Terraform output | Anomaly Lambda function name |
| `CLOUDWATCH_NAMESPACE` | Static | CloudDocVault |
| `PROMETHEUS_URL` | Static | http://localhost:9090 |
| `CORS_ORIGIN` | deploy.sh | EC2 public IP or CloudFront domain |
| `JWT_COOKIE_SECRET` | Generated | openssl rand -hex 32 |

**Removed variables** (delete from original spec — these are no longer used):

- `AWS_ACCESS_KEY_ID` — replaced by EC2 instance profile
- `AWS_SECRET_ACCESS_KEY` — replaced by EC2 instance profile

---

## 16. Security Hardening Checklist

The agent must verify all of these before marking the build complete. Each item that is not yet implemented must be implemented.

| Check | Required action |
|-------|----------------|
| S3 Block Public Access | Enable on all three buckets via Terraform |
| S3 bucket policy denies HTTP | `aws:SecureTransport = false` → Deny on primary bucket |
| S3 primary bucket policy denies non-CloudFront access | OAC condition on GetObject |
| SSE-KMS on all S3 buckets | `server_side_encryption_configuration` in Terraform |
| KMS key rotation | `enable_key_rotation = true` |
| EC2 does not use static AWS credentials | Remove from `.env`, use instance profile |
| Lambda does not use static credentials | IAM execution role provides credentials |
| CloudFront enforces HTTPS | `viewer_protocol_policy = "redirect-to-https"` |
| CloudTrail enabled and multi-region | `is_multi_region_trail = true` |
| CloudTrail log integrity validation | `enable_log_file_validation = true` |
| Audit bucket Object Lock | `COMPLIANCE` mode, 2555 days |
| Cognito password policy minimum 12 chars | `minimum_length = 12` |
| JWT tokens not in localStorage | Tokens in React memory, refresh in httpOnly cookie |
| No user input interpolated directly into S3 keys | Sanitise in pre-sign Lambda before generating URL |
| Prometheus not exposed to public internet | Security group allows 9090 only from VPC CIDR |
| Grafana not exposed to public internet | Security group allows 3000 only from VPC CIDR |
| SageMaker endpoints not publicly accessible | VPC-internal endpoints, no public endpoint |
| GitHub Actions uses OIDC not static keys | `role-to-assume` with OIDC, no `AWS_ACCESS_KEY_ID` in secrets |
| deploy.sh is idempotent | PM2 delete + start, `ln -sf`, conditional resource creation |
| `.gitignore` excludes secrets | `.env`, `*.pem`, `terraform.tfstate`, `*.zip` all excluded |

---


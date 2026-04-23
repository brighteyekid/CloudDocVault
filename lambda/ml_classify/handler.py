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

import json
import os
import boto3
import urllib.parse

textract = boto3.client("textract",   region_name=os.environ["AWS_REGION"])
sm       = boto3.client("sagemaker-runtime", region_name=os.environ["AWS_REGION"])
s3       = boto3.client("s3",         region_name=os.environ["AWS_REGION"])
comp     = boto3.client("comprehend", region_name=os.environ["AWS_REGION"])

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

    # Step 2.5 - Extract Entities using AWS Comprehend for VaultGraph
    try:
        # Comprehend has a 5000 byte limit for DetectEntities
        comp_text = extracted_text.encode("utf-8")[:4900].decode("utf-8", "ignore")
        if comp_text.strip():
            comp_resp = comp.detect_entities(Text=comp_text, LanguageCode="en")
            entities = [e["Text"].replace(",", "").replace(" ", "_") for e in comp_resp["Entities"] if e["Type"] in ["ORGANIZATION", "PERSON", "LOCATION"]]
            # Get top 3 unique entities
            unique_entities = list(dict.fromkeys(entities))[:3]
            entities_str = ",".join(unique_entities)
        else:
            entities_str = "none"
    except Exception as e:
        entities_str = "error"

    # Step 3 — Write classification back to S3 object tags
    _tag_object(bucket, key, label, confidence, "success", entities_str)


def _tag_object(bucket, key, label, confidence, status, entities="none"):
    s3.put_object_tagging(
        Bucket=bucket,
        Key=key,
        Tagging={
            "TagSet": [
                {"Key": "ml_label",      "Value": label},
                {"Key": "ml_confidence", "Value": str(round(confidence, 4))},
                {"Key": "ml_status",     "Value": status},
                {"Key": "ml_entities",   "Value": entities[:255]} # Max 256 chars for tag value
            ]
        }
    )

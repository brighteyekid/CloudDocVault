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

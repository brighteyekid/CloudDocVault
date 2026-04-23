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

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

# Application metrics (updated by backend via /internal/metrics POST)
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

# CloudWatch-sourced metrics (polled from AWS)
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

const {
  CloudWatchClient,
  GetMetricStatisticsCommand,
  DescribeAlarmsCommand
} = require('@aws-sdk/client-cloudwatch');

class CloudWatchService {
  constructor() {
    this.client = new CloudWatchClient({
      region: process.env.AWS_REGION || 'us-east-1'
    });
    this.namespace = process.env.CLOUDWATCH_NAMESPACE || 'CloudDocVault';
  }

  async getMetricStatistics(params) {
    try {
      const command = new GetMetricStatisticsCommand(params);
      const response = await this.client.send(command);
      return response.Datapoints || [];
    } catch (error) {
      console.error('CloudWatch getMetricStatistics error:', error);
      throw new Error('Failed to get metric statistics');
    }
  }

  async getLambdaErrors(startTime, endTime, period = 86400) {
    return this.getMetricStatistics({
      Namespace: 'AWS/Lambda',
      MetricName: 'Errors',
      Dimensions: [
        {
          Name: 'FunctionName',
          Value: 'clouddocvault-*'
        }
      ],
      StartTime: startTime,
      EndTime: endTime,
      Period: period,
      Statistics: ['Sum']
    });
  }

  async getLambdaDuration(startTime, endTime, period = 3600) {
    return this.getMetricStatistics({
      Namespace: 'AWS/Lambda',
      MetricName: 'Duration',
      Dimensions: [
        {
          Name: 'FunctionName',
          Value: 'clouddocvault-*'
        }
      ],
      StartTime: startTime,
      EndTime: endTime,
      Period: period,
      Statistics: ['Average'],
      ExtendedStatistics: ['p95']
    });
  }

  async getCloudFrontCacheHitRate(startTime, endTime, period = 3600) {
    return this.getMetricStatistics({
      Namespace: 'AWS/CloudFront',
      MetricName: 'CacheHitRate',
      StartTime: startTime,
      EndTime: endTime,
      Period: period,
      Statistics: ['Average']
    });
  }

  async getS3BucketSize(bucketName, startTime, endTime, period = 86400) {
    return this.getMetricStatistics({
      Namespace: 'AWS/S3',
      MetricName: 'BucketSizeBytes',
      Dimensions: [
        {
          Name: 'BucketName',
          Value: bucketName
        },
        {
          Name: 'StorageType',
          Value: 'StandardStorage'
        }
      ],
      StartTime: startTime,
      EndTime: endTime,
      Period: period,
      Statistics: ['Average']
    });
  }

  async getS3NumberOfObjects(bucketName, startTime, endTime, period = 86400) {
    return this.getMetricStatistics({
      Namespace: 'AWS/S3',
      MetricName: 'NumberOfObjects',
      Dimensions: [
        {
          Name: 'BucketName',
          Value: bucketName
        },
        {
          Name: 'StorageType',
          Value: 'AllStorageTypes'
        }
      ],
      StartTime: startTime,
      EndTime: endTime,
      Period: period,
      Statistics: ['Average']
    });
  }

  async getActiveAlarms() {
    try {
      const command = new DescribeAlarmsCommand({
        StateValue: 'ALARM',
        MaxRecords: 100
      });

      const response = await this.client.send(command);
      return (response.MetricAlarms || []).map(alarm => ({
        name: alarm.AlarmName,
        description: alarm.AlarmDescription,
        severity: this.mapAlarmSeverity(alarm.AlarmName),
        triggeredAt: alarm.StateUpdatedTimestamp,
        source: 'CloudWatch'
      }));
    } catch (error) {
      console.error('CloudWatch getActiveAlarms error:', error);
      throw new Error('Failed to get active alarms');
    }
  }

  mapAlarmSeverity(alarmName) {
    const name = alarmName.toLowerCase();
    if (name.includes('critical') || name.includes('error')) {
      return 'Critical';
    }
    if (name.includes('warning') || name.includes('warn')) {
      return 'Warning';
    }
    return 'Info';
  }

  async getSummaryMetrics() {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    try {
      const [
        lambdaErrors,
        lambdaDuration,
        cloudFrontCacheHit,
        bucketSize,
        numberOfObjects
      ] = await Promise.allSettled([
        this.getLambdaErrors(oneDayAgo, now),
        this.getLambdaDuration(oneHourAgo, now),
        this.getCloudFrontCacheHitRate(oneHourAgo, now),
        this.getS3BucketSize(process.env.S3_BUCKET_PRIMARY, oneDayAgo, now),
        this.getS3NumberOfObjects(process.env.S3_BUCKET_PRIMARY, oneDayAgo, now)
      ]);

      return {
        lambdaErrors: lambdaErrors.status === 'fulfilled' ? lambdaErrors.value : [],
        lambdaDuration: lambdaDuration.status === 'fulfilled' ? lambdaDuration.value : [],
        cloudFrontCacheHit: cloudFrontCacheHit.status === 'fulfilled' ? cloudFrontCacheHit.value : [],
        bucketSize: bucketSize.status === 'fulfilled' ? bucketSize.value : [],
        numberOfObjects: numberOfObjects.status === 'fulfilled' ? numberOfObjects.value : []
      };
    } catch (error) {
      console.error('CloudWatch getSummaryMetrics error:', error);
      throw new Error('Failed to get summary metrics');
    }
  }

  formatBytesToGB(bytes) {
    return (bytes / (1024 * 1024 * 1024)).toFixed(2);
  }

  calculateErrorRate(errors, total) {
    if (total === 0) return 0;
    return ((errors / total) * 100).toFixed(1);
  }
}

module.exports = new CloudWatchService();
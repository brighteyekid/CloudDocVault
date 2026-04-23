const {
  CloudTrailClient,
  LookupEventsCommand
} = require('@aws-sdk/client-cloudtrail');

class CloudTrailService {
  constructor() {
    this.client = new CloudTrailClient({
      region: process.env.AWS_REGION || 'us-east-1'
    });
  }

  async lookupEvents(params) {
    try {
      const command = new LookupEventsCommand(params);
      const response = await this.client.send(command);
      return response.Events || [];
    } catch (error) {
      console.error('CloudTrail lookupEvents error:', error);
      throw new Error('Failed to lookup CloudTrail events');
    }
  }

  async getAccessLogs(startTime, endTime, filters = {}) {
    const lookupAttributes = [];

    // Add resource name filter if provided
    if (filters.resourceName) {
      lookupAttributes.push({
        AttributeKey: 'ResourceName',
        AttributeValue: filters.resourceName
      });
    }

    // Add event name filter if provided
    if (filters.eventName) {
      lookupAttributes.push({
        AttributeKey: 'EventName',
        AttributeValue: filters.eventName
      });
    }

    // Add username filter if provided
    if (filters.username) {
      lookupAttributes.push({
        AttributeKey: 'Username',
        AttributeValue: filters.username
      });
    }

    const params = {
      StartTime: startTime,
      EndTime: endTime,
      MaxItems: 50
    };

    if (lookupAttributes.length > 0) {
      params.LookupAttributes = lookupAttributes;
    }

    const events = await this.lookupEvents(params);
    return this.formatEvents(events);
  }

  async getObjectAccessHistory(bucketName, objectKey, limit = 5) {
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 days ago

    const params = {
      StartTime: startTime,
      EndTime: endTime,
      LookupAttributes: [
        {
          AttributeKey: 'ResourceName',
          AttributeValue: `${bucketName}/${objectKey}`
        }
      ],
      MaxItems: limit
    };

    const events = await this.lookupEvents(params);
    return this.formatEvents(events);
  }

  async getRecentActivity(limit = 10) {
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - 24 * 60 * 60 * 1000); // 24 hours ago

    const params = {
      StartTime: startTime,
      EndTime: endTime,
      MaxItems: limit
    };

    const events = await this.lookupEvents(params);
    return this.formatEvents(events);
  }

  formatEvents(events) {
    return events.map(event => {
      const eventName = event.EventName;
      const resources = event.Resources || [];
      const resourceName = resources.length > 0 ? resources[0].ResourceName : '';
      
      return {
        timestamp: event.EventTime,
        user: event.Username || 'System',
        action: this.mapEventNameToAction(eventName),
        resource: resourceName,
        sourceIp: event.SourceIPAddress || 'Unknown',
        result: event.ErrorCode ? 'Failed' : 'Success',
        errorCode: event.ErrorCode,
        eventName: eventName,
        description: this.generateEventDescription(eventName, event.Username, resourceName)
      };
    });
  }

  mapEventNameToAction(eventName) {
    const eventMap = {
      'PutObject': 'Upload',
      'GetObject': 'Download',
      'DeleteObject': 'Delete',
      'HeadObject': 'View',
      'ListObjects': 'List',
      'ListObjectsV2': 'List',
      'CreateBucket': 'Create Bucket',
      'DeleteBucket': 'Delete Bucket',
      'GetBucketPolicy': 'View Policy',
      'PutBucketPolicy': 'Update Policy'
    };

    return eventMap[eventName] || eventName;
  }

  generateEventDescription(eventName, username, resourceName) {
    const action = this.mapEventNameToAction(eventName);
    const user = username || 'System';
    const resource = resourceName ? ` on ${resourceName.split('/').pop()}` : '';
    
    return `${user} performed ${action}${resource}`;
  }

  async exportEvents(startTime, endTime, filters = {}, format = 'json') {
    const events = await this.getAccessLogs(startTime, endTime, filters);
    
    if (format === 'csv') {
      return this.formatAsCSV(events);
    }
    
    return JSON.stringify(events, null, 2);
  }

  formatAsCSV(events) {
    if (events.length === 0) {
      return 'timestamp,user,action,resource,sourceIp,result\n';
    }

    const headers = 'timestamp,user,action,resource,sourceIp,result\n';
    const rows = events.map(event => {
      return [
        event.timestamp.toISOString(),
        event.user,
        event.action,
        event.resource,
        event.sourceIp,
        event.result
      ].map(field => `"${field}"`).join(',');
    }).join('\n');

    return headers + rows;
  }

  async getUploadCount(startTime, endTime) {
    const params = {
      StartTime: startTime,
      EndTime: endTime,
      LookupAttributes: [
        {
          AttributeKey: 'EventName',
          AttributeValue: 'PutObject'
        }
      ],
      MaxItems: 1000
    };

    const events = await this.lookupEvents(params);
    return events.length;
  }

  async getAccessDeniedCount(startTime, endTime) {
    const params = {
      StartTime: startTime,
      EndTime: endTime,
      MaxItems: 1000
    };

    const events = await this.lookupEvents(params);
    return events.filter(event => event.ErrorCode === 'AccessDenied').length;
  }
}

module.exports = new CloudTrailService();
const { 
  S3Client, 
  ListObjectsV2Command, 
  HeadObjectCommand, 
  DeleteObjectCommand,
  PutObjectCommand,
  GetObjectCommand
} = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const crypto = require('crypto');

class S3Service {
  constructor() {
    this.client = new S3Client({
      region: process.env.AWS_REGION || 'us-east-1'
    });
    this.primaryBucket = process.env.S3_BUCKET_PRIMARY;
    this.auditBucket = process.env.S3_BUCKET_AUDIT;
  }

  async listObjects(prefix = '', maxKeys = 1000) {
    try {
      const command = new ListObjectsV2Command({
        Bucket: this.primaryBucket,
        Prefix: prefix,
        MaxKeys: maxKeys
      });

      const response = await this.client.send(command);
      return response.Contents || [];
    } catch (error) {
      console.error('S3 listObjects error:', error);
      throw new Error('Failed to list objects from S3');
    }
  }

  async getObjectMetadata(key) {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.primaryBucket,
        Key: key
      });

      const response = await this.client.send(command);
      return {
        key,
        size: response.ContentLength,
        lastModified: response.LastModified,
        etag: response.ETag,
        storageClass: response.StorageClass || 'STANDARD',
        metadata: response.Metadata || {}
      };
    } catch (error) {
      if (error.name === 'NotFound') {
        return null;
      }
      console.error('S3 getObjectMetadata error:', error);
      throw new Error('Failed to get object metadata');
    }
  }

  async getObjectsMetadata(keys) {
    const batchSize = 10;
    const results = [];

    for (let i = 0; i < keys.length; i += batchSize) {
      const batch = keys.slice(i, i + batchSize);
      const promises = batch.map(key => this.getObjectMetadata(key));
      const batchResults = await Promise.allSettled(promises);
      
      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value) {
          results.push(result.value);
        } else {
          console.warn(`Failed to get metadata for key: ${batch[index]}`);
        }
      });
    }

    return results;
  }

  async deleteObject(key) {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.primaryBucket,
        Key: key
      });

      await this.client.send(command);
      return true;
    } catch (error) {
      console.error('S3 deleteObject error:', error);
      throw new Error('Failed to delete object from S3');
    }
  }

  async generatePresignedGetUrl(key, expiresIn = 900) {
    try {
      const command = new GetObjectCommand({
        Bucket: this.primaryBucket,
        Key: key
      });

      const url = await getSignedUrl(this.client, command, { expiresIn });
      return url;
    } catch (error) {
      console.error('S3 generatePresignedGetUrl error:', error);
      throw new Error('Failed to generate presigned GET URL');
    }
  }

  async generatePresignedPutUrl(key, contentType, metadata = {}, expiresIn = 1800) {
    try {
      const metadataHeaders = {};
      Object.keys(metadata).forEach(metaKey => {
        metadataHeaders[`x-amz-meta-${metaKey}`] = metadata[metaKey];
      });

      const command = new PutObjectCommand({
        Bucket: this.primaryBucket,
        Key: key,
        ContentType: contentType,
        Metadata: metadataHeaders
      });

      const url = await getSignedUrl(this.client, command, { expiresIn });
      return url;
    } catch (error) {
      console.error('S3 generatePresignedPutUrl error:', error);
      throw new Error('Failed to generate presigned PUT URL');
    }
  }

  sanitizeFilename(filename) {
    return filename.replace(/[^a-zA-Z0-9.-_]/g, '_');
  }

  generateS3Key(userSub, filename) {
    const uuid = crypto.randomUUID();
    const sanitizedFilename = this.sanitizeFilename(filename);
    return `users/${userSub}/${uuid}/${sanitizedFilename}`;
  }

  parseS3Key(key) {
    const parts = key.split('/');
    if (parts.length >= 4 && parts[0] === 'users') {
      return {
        userSub: parts[1],
        uuid: parts[2],
        filename: parts.slice(3).join('/')
      };
    }
    return null;
  }
}

module.exports = new S3Service();
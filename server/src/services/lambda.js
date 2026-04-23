const { LambdaClient, InvokeCommand } = require('@aws-sdk/client-lambda');

const lambda = new LambdaClient({ region: process.env.AWS_REGION });

async function invokeFunction(functionName, payload) {
  const cmd = new InvokeCommand({
    FunctionName: functionName,
    Payload: Buffer.from(JSON.stringify(payload))
  });
  
  const response = await lambda.send(cmd);
  const body = JSON.parse(Buffer.from(response.Payload).toString());
  return JSON.parse(body.body);
}

module.exports = {
  invokeFunction,
  
  async generatePresignedUrl(operation, objectKey, contentType) {
    const functionName = process.env.LAMBDA_PRESIGN_NAME;
    if (!functionName) {
      throw new Error('LAMBDA_PRESIGN_NAME not configured');
    }
    
    return invokeFunction(functionName, {
      operation,
      object_key: objectKey,
      content_type: contentType
    });
  }
};

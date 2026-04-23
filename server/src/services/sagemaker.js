const { SageMakerRuntimeClient, InvokeEndpointCommand } = require('@aws-sdk/client-sagemaker-runtime');

const sagemaker = new SageMakerRuntimeClient({ region: process.env.AWS_REGION });

async function invokeEndpoint(endpointName, contentType, body) {
  const cmd = new InvokeEndpointCommand({
    EndpointName: endpointName,
    ContentType: contentType,
    Body: body
  });
  
  const response = await sagemaker.send(cmd);
  return JSON.parse(Buffer.from(response.Body).toString());
}

module.exports = {
  invokeEndpoint,
  
  async classifyDocument(text) {
    const endpointName = process.env.SAGEMAKER_NLP_ENDPOINT_NAME;
    if (!endpointName) {
      throw new Error('SAGEMAKER_NLP_ENDPOINT_NAME not configured');
    }
    
    return invokeEndpoint(endpointName, 'text/plain', text);
  },
  
  async scoreAnomaly(featureVector) {
    const endpointName = process.env.SAGEMAKER_ANOMALY_ENDPOINT_NAME;
    if (!endpointName) {
      throw new Error('SAGEMAKER_ANOMALY_ENDPOINT_NAME not configured');
    }
    
    return invokeEndpoint(endpointName, 'text/csv', featureVector);
  }
};

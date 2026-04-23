const {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  GlobalSignOutCommand,
  UpdateUserAttributesCommand,
  ListUsersCommand,
  ListDevicesCommand,
  ForgetDeviceCommand
} = require('@aws-sdk/client-cognito-identity-provider');
const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');

class CognitoService {
  constructor() {
    this.client = new CognitoIdentityProviderClient({
      region: process.env.COGNITO_REGION || process.env.AWS_REGION || 'us-east-1'
    });
    this.userPoolId = process.env.COGNITO_USER_POOL_ID;
    this.clientId = process.env.COGNITO_CLIENT_ID;
    
    // JWKS client for token verification
    this.jwksClient = jwksClient({
      jwksUri: `https://cognito-idp.${process.env.COGNITO_REGION || process.env.AWS_REGION}.amazonaws.com/${this.userPoolId}/.well-known/jwks.json`,
      cache: true,
      cacheMaxAge: 3600000, // 1 hour
      rateLimit: true
    });
  }

  async login(email, password) {
    try {
      const command = new InitiateAuthCommand({
        AuthFlow: 'USER_PASSWORD_AUTH',
        ClientId: this.clientId,
        AuthParameters: {
          USERNAME: email,
          PASSWORD: password
        }
      });

      const response = await this.client.send(command);
      
      if (!response.AuthenticationResult) {
        throw new Error('Authentication failed');
      }

      const { AccessToken, IdToken, RefreshToken } = response.AuthenticationResult;
      
      // Decode the ID token to get user info
      const decodedToken = jwt.decode(IdToken);
      const user = {
        sub: decodedToken.sub,
        email: decodedToken.email,
        name: decodedToken.name || decodedToken.email,
        groups: decodedToken['cognito:groups'] || []
      };

      return {
        accessToken: AccessToken,
        idToken: IdToken,
        refreshToken: RefreshToken,
        user
      };
    } catch (error) {
      console.error('Cognito login error:', error);
      
      if (error.name === 'NotAuthorizedException' || error.name === 'UserNotFoundException') {
        throw new Error('Invalid credentials');
      }
      
      throw new Error('Authentication failed');
    }
  }

  async refreshToken(refreshToken) {
    try {
      const command = new InitiateAuthCommand({
        AuthFlow: 'REFRESH_TOKEN_AUTH',
        ClientId: this.clientId,
        AuthParameters: {
          REFRESH_TOKEN: refreshToken
        }
      });

      const response = await this.client.send(command);
      
      if (!response.AuthenticationResult) {
        throw new Error('Token refresh failed');
      }

      const { AccessToken, IdToken } = response.AuthenticationResult;
      
      return {
        accessToken: AccessToken,
        idToken: IdToken
      };
    } catch (error) {
      console.error('Cognito refresh token error:', error);
      throw new Error('Session expired');
    }
  }

  async logout(accessToken) {
    try {
      const command = new GlobalSignOutCommand({
        AccessToken: accessToken
      });

      await this.client.send(command);
      return true;
    } catch (error) {
      console.error('Cognito logout error:', error);
      // Don't throw error for logout - best effort
      return false;
    }
  }

  async verifyToken(token) {
    try {
      // Get the key ID from the token header
      const decodedHeader = jwt.decode(token, { complete: true });
      if (!decodedHeader || !decodedHeader.header.kid) {
        throw new Error('Invalid token header');
      }

      // Get the signing key
      const key = await this.getSigningKey(decodedHeader.header.kid);
      
      // Verify the token - access tokens don't have audience, only token_use and client_id
      const decoded = jwt.verify(token, key, {
        algorithms: ['RS256'],
        issuer: `https://cognito-idp.${process.env.COGNITO_REGION || process.env.AWS_REGION}.amazonaws.com/${this.userPoolId}`
      });

      // Verify token_use is 'access' and client_id matches
      if (decoded.token_use !== 'access') {
        throw new Error('Invalid token type');
      }
      
      if (decoded.client_id !== this.clientId) {
        throw new Error('Invalid client');
      }

      return {
        sub: decoded.sub,
        email: decoded.email || decoded.username,
        groups: decoded['cognito:groups'] || []
      };
    } catch (error) {
      console.error('Token verification error:', error);
      throw new Error('Invalid token');
    }
  }

  async getSigningKey(kid) {
    return new Promise((resolve, reject) => {
      this.jwksClient.getSigningKey(kid, (err, key) => {
        if (err) {
          reject(err);
        } else {
          resolve(key.getPublicKey());
        }
      });
    });
  }

  async updateUserAttributes(accessToken, attributes) {
    try {
      const userAttributes = Object.keys(attributes).map(key => ({
        Name: key,
        Value: attributes[key]
      }));

      const command = new UpdateUserAttributesCommand({
        AccessToken: accessToken,
        UserAttributes: userAttributes
      });

      await this.client.send(command);
      return true;
    } catch (error) {
      console.error('Update user attributes error:', error);
      throw new Error('Failed to update user attributes');
    }
  }

  async listUsers(limit = 60) {
    try {
      const command = new ListUsersCommand({
        UserPoolId: this.userPoolId,
        Limit: limit
      });

      const response = await this.client.send(command);
      return response.Users || [];
    } catch (error) {
      console.error('List users error:', error);
      throw new Error('Failed to list users');
    }
  }

  async listDevices(accessToken) {
    try {
      const command = new ListDevicesCommand({
        AccessToken: accessToken
      });

      const response = await this.client.send(command);
      return response.Devices || [];
    } catch (error) {
      console.error('List devices error:', error);
      throw new Error('Failed to list devices');
    }
  }

  async forgetDevice(accessToken, deviceKey) {
    try {
      const command = new ForgetDeviceCommand({
        AccessToken: accessToken,
        DeviceKey: deviceKey
      });

      await this.client.send(command);
      return true;
    } catch (error) {
      console.error('Forget device error:', error);
      throw new Error('Failed to forget device');
    }
  }
}

module.exports = new CognitoService();
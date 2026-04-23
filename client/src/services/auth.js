import axios from 'axios';

class AuthService {
  constructor() {
    this.accessToken = null;
    this.idToken = null;
    this.user = null;
  }

  setTokens(accessToken, idToken, user) {
    this.accessToken = accessToken;
    this.idToken = idToken;
    this.user = user;
  }

  getAccessToken() {
    return this.accessToken;
  }

  getIdToken() {
    return this.idToken;
  }

  getUser() {
    return this.user;
  }

  clearTokens() {
    this.accessToken = null;
    this.idToken = null;
    this.user = null;
  }

  async login(email, password) {
    try {
      const response = await axios.post('/api/auth/login', {
        email,
        password
      }, {
        withCredentials: true
      });

      const { accessToken, idToken, user } = response.data;
      this.setTokens(accessToken, idToken, user);

      return { accessToken, idToken, user };
    } catch (error) {
      throw new Error(error.response?.data?.error || 'Login failed');
    }
  }

  async logout() {
    try {
      await axios.post('/api/auth/logout', {}, {
        withCredentials: true,
        headers: this.accessToken ? {
          Authorization: `Bearer ${this.accessToken}`
        } : {}
      });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      this.clearTokens();
    }
  }

  async refresh() {
    try {
      const response = await axios.post('/api/auth/refresh', {}, {
        withCredentials: true
      });

      const { accessToken, idToken } = response.data;
      this.accessToken = accessToken;
      this.idToken = idToken;
      
      // Decode the ID token to get user info
      const base64Url = idToken.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));
      
      const decoded = JSON.parse(jsonPayload);
      this.user = {
        sub: decoded.sub,
        email: decoded.email,
        name: decoded.name || decoded.email,
        groups: decoded['cognito:groups'] || []
      };

      return { accessToken, idToken, user: this.user };
    } catch (error) {
      this.clearTokens();
      throw new Error('Session expired');
    }
  }

  isAuthenticated() {
    return !!this.accessToken;
  }
}

export const authService = new AuthService();
export default authService;
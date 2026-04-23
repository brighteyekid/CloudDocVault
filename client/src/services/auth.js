import axios from 'axios';

class AuthService {
  constructor() {
    // Load tokens from localStorage on initialization
    this.accessToken = localStorage.getItem('accessToken');
    this.idToken = localStorage.getItem('idToken');
    const userStr = localStorage.getItem('user');
    this.user = userStr ? JSON.parse(userStr) : null;
  }

  setTokens(accessToken, idToken, user) {
    this.accessToken = accessToken;
    this.idToken = idToken;
    this.user = user;
    
    // Persist to localStorage
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('idToken', idToken);
    localStorage.setItem('user', JSON.stringify(user));
  }

  getAccessToken() {
    return this.accessToken || localStorage.getItem('accessToken');
  }

  getIdToken() {
    return this.idToken || localStorage.getItem('idToken');
  }

  getUser() {
    if (this.user) return this.user;
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
  }

  clearTokens() {
    this.accessToken = null;
    this.idToken = null;
    this.user = null;
    
    // Clear from localStorage
    localStorage.removeItem('accessToken');
    localStorage.removeItem('idToken');
    localStorage.removeItem('user');
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
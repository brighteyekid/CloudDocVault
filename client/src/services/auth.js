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

      return { accessToken, idToken };
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
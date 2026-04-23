import React, { useState, useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Lock, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import './Login.css';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const { login, isAuthenticated, loading, error } = useAuth();
  const { showError } = useToast();
  const location = useLocation();

  const from = location.state?.from?.pathname || '/dashboard';

  useEffect(() => {
    if (error) {
      showError(error);
    }
  }, [error, showError]);

  if (isAuthenticated) {
    return <Navigate to={from} replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!email || !password) {
      showError('Please enter both email and password');
      return;
    }

    try {
      await login(email, password);
    } catch (err) {
      // Error is handled by the auth context and displayed via useEffect
    }
  };

  return (
    <div className="login-page">
      <div className="login-page__left">
        <div className="login-page__branding">
          <div className="login-page__logo">
            <Lock size={24} />
            <span className="login-page__wordmark">CloudDocVault</span>
          </div>
          
          <blockquote className="login-page__quote">
            "Encrypted. Versioned. Auditable."
          </blockquote>
          
          <ul className="login-page__features">
            <li className="login-page__feature">
              <div className="login-page__feature-dot" />
              AWS S3 with SSE-KMS encryption
            </li>
            <li className="login-page__feature">
              <div className="login-page__feature-dot" />
              IAM least-privilege access control
            </li>
            <li className="login-page__feature">
              <div className="login-page__feature-dot" />
              Immutable CloudTrail audit log
            </li>
          </ul>
        </div>
      </div>

      <div className="login-page__right">
        <div className="login-form">
          <div className="login-form__header">
            <h1 className="login-form__title">Sign in to CloudDocVault</h1>
            <p className="login-form__subtitle">Use your organisation credentials.</p>
          </div>

          <form onSubmit={handleSubmit} className="login-form__form">
            <Input
              label="Email address"
              type="email"
              placeholder="you@organisation.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <div className="login-form__password-field">
              <Input
                label="Password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                className="login-form__password-toggle"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>

            <div className="login-form__forgot">
              <a href="#" className="login-form__forgot-link">
                Forgot password?
              </a>
            </div>

            <Button
              type="submit"
              variant="primary"
              className="login-form__submit"
              loading={loading}
              disabled={loading}
            >
              Sign in
            </Button>

            <div className="login-form__divider">
              <span>or</span>
            </div>

            <Button
              type="button"
              variant="secondary"
              className="login-form__sso"
            >
              Continue with SSO
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;
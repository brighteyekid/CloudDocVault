module.exports = {
  apps: [
    {
      name: 'clouddocvault-api',
      script: './src/server.js',
      cwd: '/home/ubuntu/CloudDocVault/server',
      instances: 2,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
      },
      env_file: '/home/ubuntu/CloudDocVault/server/.env',
      error_file: '/home/ubuntu/CloudDocVault/logs/api-error.log',
      out_file: '/home/ubuntu/CloudDocVault/logs/api-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      max_memory_restart: '512M',
      restart_delay: 5000,
      autorestart: true,
    },
  ],
};
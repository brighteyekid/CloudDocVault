# CloudDocVault

A secure, cloud-native document management portal built with React, Node.js, and AWS services.

## Features

- **Secure Authentication** - AWS Cognito integration with JWT tokens
- **Document Storage** - Direct S3 uploads with pre-signed URLs
- **Access Control** - User-based document isolation and permissions
- **Audit Logging** - Complete CloudTrail integration for compliance
- **Real-time Monitoring** - CloudWatch metrics and Prometheus support
- **Responsive UI** - Modern React interface with dark theme
- **Infrastructure as Code** - Terraform-managed AWS resources
- **Lambda Functions** - Pre-signed URL generation, ML classification, anomaly detection
- **ML Pipeline** - Textract + SageMaker for document classification
- **Prometheus + Grafana** - Production-grade observability stack
- **CI/CD Pipeline** - GitHub Actions for automated deployments

## Architecture

- **Frontend**: React 18 + Vite + React Router
- **Backend**: Node.js + Express + AWS SDK
- **Storage**: AWS S3 with SSE-KMS encryption
- **Authentication**: AWS Cognito User Pools
- **Monitoring**: CloudWatch + CloudTrail + Prometheus + Grafana
- **Infrastructure**: Terraform IaC with modular architecture
- **Lambda Functions**: Pre-sign, ML classify, anomaly detection
- **SageMaker**: NLP classification and Isolation Forest anomaly detection
- **Deployment**: Single EC2 instance with Nginx reverse proxy

## Quick Start

### Prerequisites

- Ubuntu 22.04 EC2 instance
- AWS credentials with appropriate permissions
- Domain name (optional, for SSL)

### Deployment

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd clouddocvault
   ```

2. **Export AWS credentials**
   ```bash
   export AWS_ACCESS_KEY_ID=your_access_key
   export AWS_SECRET_ACCESS_KEY=your_secret_key
   export AWS_DEFAULT_REGION=us-east-1
   ```

3. **Run the deployment script**
   ```bash
   bash deploy.sh
   ```

The deployment script will automatically:
- Install all dependencies (Node.js, Nginx, PM2)
- **Create all required AWS resources** (S3 buckets, Cognito User Pool, etc.)
- Provision **Terraform infrastructure** (IAM roles, Lambda functions, SageMaker endpoints)
- Build and configure the application
- Install **Prometheus and Grafana** monitoring stack
- Start all services
- Create a demo user for immediate testing
- Perform health checks

**Demo Login Credentials:**
- Email: `demo@clouddocvault.com`
- Password: `TempPass123!`

### Manual Setup (Development)

1. **Backend setup**
   ```bash
   cd server
   npm install
   cp .env.example .env
   # Edit .env with your AWS configuration
   npm run dev
   ```

2. **Frontend setup**
   ```bash
   cd client
   npm install
   npm run dev
   ```

## Configuration

### Required AWS Resources

The deployment script **automatically creates** all required AWS resources:

- **S3 Bucket** - Primary document storage (auto-created with encryption and CORS)
- **S3 Bucket** - Audit logs (auto-created with encryption and WORM Object Lock)
- **Cognito User Pool** - User authentication (auto-created with password policy)
- **Cognito User Pool Client** - Application client (auto-created)
- **Demo User** - Ready-to-use test account (auto-created)
- **IAM Roles** - EC2 instance profile, Lambda execution roles (auto-created)
- **Lambda Functions** - Pre-sign, ML classify, anomaly detection (auto-created)
- **SageMaker Endpoints** - NLP classifier and Isolation Forest (auto-created)
- **CloudTrail Trail** - Multi-region audit logging (auto-created)
- **CloudFront Distribution** - CDN with OAC (auto-created)

**No manual AWS setup required!** Just export your credentials and run the deploy script.

### Environment Variables

**Backend (.env)**
```
PORT=3001
NODE_ENV=production
AWS_REGION=us-east-1
S3_BUCKET_PRIMARY=your-clouddocvault-bucket
COGNITO_USER_POOL_ID=us-east-1_xxxxxxxxx
COGNITO_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxx
JWT_COOKIE_SECRET=your-secret-key
```

**Frontend (.env)**
```
VITE_API_BASE_URL=/api
VITE_APP_NAME=CloudDocVault
```

## Security Features

- **Encryption at Rest** - S3 SSE-KMS encryption
- **Encryption in Transit** - HTTPS/TLS for all communications
- **Access Control** - IAM policies and Cognito user pools
- **Audit Logging** - Complete CloudTrail integration with WORM Object Lock
- **Rate Limiting** - API rate limiting and DDoS protection
- **Input Validation** - Comprehensive request validation
- **Secure Headers** - Helmet.js security headers
- **Least-Privilege IAM** - Scoped roles for EC2, Lambda, and services
- **CloudFront OAC** - S3 not directly accessible, only via CloudFront
- **KMS Encryption** - Customer-managed keys for S3, Lambda, CloudTrail

## API Documentation

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `POST /api/auth/refresh` - Token refresh

### Documents
- `GET /api/documents` - List documents
- `GET /api/documents/:id` - Get document details
- `DELETE /api/documents/:id` - Delete document
- `GET /api/documents/:id/link` - Generate share link

### Upload
- `POST /api/upload/presign` - Get presigned upload URL
- `POST /api/upload/confirm` - Confirm upload completion

### Monitoring
- `GET /api/metrics/summary` - System metrics
- `GET /api/metrics/timeseries` - Time series data
- `GET /api/logs` - Access logs

## Monitoring & Observability

The application includes comprehensive monitoring:

- **Application Metrics** - API latency, error rates, throughput
- **Infrastructure Metrics** - CPU, memory, disk usage
- **Business Metrics** - Document counts, storage usage, user activity
- **Security Metrics** - Failed logins, access denied events
- **Custom Dashboards** - Real-time observability interface
- **Prometheus** - Metrics collection and alerting
- **Grafana** - 5 production dashboards for comprehensive visibility
- **Lambda Metrics** - Function execution, errors, duration
- **SageMaker Metrics** - Endpoint invocations, latency

## Troubleshooting

### Common Issues

1. **Health check fails**
   ```bash
   pm2 logs clouddocvault-api
   sudo tail -f /var/log/nginx/error.log
   ```

2. **AWS permissions errors**
   - Verify IAM policies include S3, Cognito, CloudWatch access
   - Check AWS credentials are correctly exported

3. **Upload failures**
   - Verify S3 bucket CORS configuration
   - Check presigned URL expiration times

### Logs

- **Application logs**: `pm2 logs clouddocvault-api`
- **Nginx logs**: `sudo tail -f /var/log/nginx/access.log`
- **System logs**: `journalctl -u nginx -f`
- **Prometheus**: `http://localhost:9090`
- **Grafana**: `http://localhost:3000` (admin/admin)

## Development

### Project Structure
```
clouddocvault/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/     # Reusable components
│   │   ├── pages/          # Page components
│   │   ├── contexts/       # React contexts
│   │   ├── services/       # API services
│   │   └── styles/         # CSS files
│   └── package.json
├── server/                 # Node.js backend
│   ├── src/
│   │   ├── routes/         # API routes
│   │   ├── services/       # AWS service integrations
│   │   └── middleware/     # Express middleware
│   └── package.json
├── terraform/              # Infrastructure as Code
│   ├── main.tf
│   ├── modules/            # Modular Terraform components
│   │   ├── iam/
│   │   ├── s3/
│   │   ├── lambda/
│   │   ├── cognito/
│   │   ├── cloudfront/
│   │   ├── ec2/
│   │   ├── monitoring/
│   │   └── cloudtrail/
│   └── environments/       # Environment-specific configs
├── lambda/                 # AWS Lambda functions
│   ├── presign/
│   ├── ml_classify/
│   └── anomaly/
├── monitoring/             # Prometheus and Grafana configs
│   ├── prometheus/
│   └── grafana/
├── scripts/                # Deployment scripts
├── .github/workflows/      # CI/CD pipeline
├── deploy.sh              # Deployment script
└── README.md
```

### Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Support

For support and questions:
- Check the troubleshooting section above
- Review application logs
- Consult AWS documentation for service-specific issues
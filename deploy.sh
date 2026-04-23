#!/bin/bash

# CloudDocVault Deployment Script
# This script deploys the CloudDocVault application to Ubuntu 22.04 EC2

set -euo pipefail

echo "============================================"
echo " CloudDocVault — Deployment Starting"
echo "============================================"

# Step 1 — Validate AWS credentials
echo "Step 1: Validating AWS credentials..."
if ! command -v aws &> /dev/null; then
    echo "Installing AWS CLI..."
    sudo apt-get update -qq
    sudo apt-get install -y -qq unzip
    curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
    unzip -q awscliv2.zip
    sudo ./aws/install
    rm -rf aws awscliv2.zip
fi

# Check for AWS credentials in environment
if [[ -z "${AWS_ACCESS_KEY_ID:-}" ]] || [[ -z "${AWS_SECRET_ACCESS_KEY:-}" ]] || [[ -z "${AWS_DEFAULT_REGION:-}" ]]; then
    echo "ERROR: AWS credentials not set. Please export:"
    echo "  AWS_ACCESS_KEY_ID"
    echo "  AWS_SECRET_ACCESS_KEY"
    echo "  AWS_DEFAULT_REGION"
    exit 1
fi

# Test AWS credentials
if ! aws sts get-caller-identity &> /dev/null; then
    echo "ERROR: Invalid AWS credentials. Please verify your credentials are correct."
    exit 1
fi

echo "✓ AWS credentials validated"

# Step 2 — Install system dependencies
echo "Step 2: Installing system dependencies..."
sudo apt-get update -qq
sudo apt-get install -y -qq nginx curl unzip

echo "✓ System dependencies installed"

# Step 3 — Install Node.js 20.x
echo "Step 3: Installing Node.js..."
if ! command -v node &> /dev/null || [[ $(node -v | cut -d'v' -f2 | cut -d'.' -f1) -lt 20 ]]; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

echo "✓ Node.js $(node -v) installed"

# Step 4 — Install PM2 globally
echo "Step 4: Installing PM2..."
sudo npm install -g pm2 --silent

echo "✓ PM2 installed"

# Step 5 — Create and configure AWS resources
echo "Step 5: Creating and configuring AWS resources..."

# Generate unique identifiers
TIMESTAMP=$(date +%s)
RANDOM_ID=$(openssl rand -hex 4)

# Get EC2 public IP using IMDSv2 (with token)
TOKEN=$(curl -s -X PUT "http://169.254.169.254/latest/api/token" -H "X-aws-ec2-metadata-token-ttl-seconds: 21600" 2>/dev/null)
if [ -n "$TOKEN" ]; then
    EC2_PUBLIC_IP=$(curl -s -H "X-aws-ec2-metadata-token: $TOKEN" http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null || echo "localhost")
else
    # Fallback to IMDSv1 or localhost
    EC2_PUBLIC_IP=$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null || echo "localhost")
fi

# Check for existing resources first
echo "Checking for existing AWS resources..."

S3_BUCKET_PRIMARY=$(aws s3api list-buckets --query "Buckets[?contains(Name,'clouddocvault') && !contains(Name,'audit') && !contains(Name,'state') && !contains(Name,'replica')].Name" --output text | head -1)

S3_BUCKET_AUDIT=$(aws s3api list-buckets --query "Buckets[?contains(Name,'audit')].Name" --output text | head -1)

COGNITO_USER_POOL_ID=$(aws cognito-idp list-user-pools --max-results 10 --query "UserPools[?contains(Name,'clouddocvault')].Id" --output text | head -1)

# Create S3 Primary Bucket if it doesn't exist
if [ -z "$S3_BUCKET_PRIMARY" ]; then
    echo "Creating primary S3 bucket..."
    S3_BUCKET_PRIMARY="clouddocvault-primary-${RANDOM_ID}"
    
    if [ "$AWS_DEFAULT_REGION" = "us-east-1" ]; then
        aws s3api create-bucket --bucket "$S3_BUCKET_PRIMARY"
    else
        aws s3api create-bucket --bucket "$S3_BUCKET_PRIMARY" --create-bucket-configuration LocationConstraint="$AWS_DEFAULT_REGION"
    fi
    
    # Enable versioning
    aws s3api put-bucket-versioning --bucket "$S3_BUCKET_PRIMARY" --versioning-configuration Status=Enabled
    
    # Enable server-side encryption
    aws s3api put-bucket-encryption --bucket "$S3_BUCKET_PRIMARY" --server-side-encryption-configuration '{
        "Rules": [
            {
                "ApplyServerSideEncryptionByDefault": {
                    "SSEAlgorithm": "AES256"
                }
            }
        ]
    }'
    
    # Configure CORS for direct uploads
    aws s3api put-bucket-cors --bucket "$S3_BUCKET_PRIMARY" --cors-configuration '{
        "CORSRules": [
            {
                "AllowedHeaders": ["*"],
                "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
                "AllowedOrigins": ["*"],
                "ExposeHeaders": ["ETag"],
                "MaxAgeSeconds": 3000
            }
        ]
    }'
    
    # Block public access (security)
    aws s3api put-public-access-block --bucket "$S3_BUCKET_PRIMARY" --public-access-block-configuration "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"
    
    echo "✓ Created primary S3 bucket: $S3_BUCKET_PRIMARY"
else
    echo "✓ Found existing primary S3 bucket: $S3_BUCKET_PRIMARY"
fi

# Create S3 Audit Bucket if it doesn't exist
if [ -z "$S3_BUCKET_AUDIT" ]; then
    echo "Creating audit S3 bucket..."
    S3_BUCKET_AUDIT="clouddocvault-audit-${RANDOM_ID}"
    
    if [ "$AWS_DEFAULT_REGION" = "us-east-1" ]; then
        aws s3api create-bucket --bucket "$S3_BUCKET_AUDIT"
    else
        aws s3api create-bucket --bucket "$S3_BUCKET_AUDIT" --create-bucket-configuration LocationConstraint="$AWS_DEFAULT_REGION"
    fi
    
    # Enable server-side encryption
    aws s3api put-bucket-encryption --bucket "$S3_BUCKET_AUDIT" --server-side-encryption-configuration '{
        "Rules": [
            {
                "ApplyServerSideEncryptionByDefault": {
                    "SSEAlgorithm": "AES256"
                }
            }
        ]
    }'
    
    # Block public access (security)
    aws s3api put-public-access-block --bucket "$S3_BUCKET_AUDIT" --public-access-block-configuration "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"
    
    echo "✓ Created audit S3 bucket: $S3_BUCKET_AUDIT"
else
    echo "✓ Found existing audit S3 bucket: $S3_BUCKET_AUDIT"
fi

# Create Cognito User Pool if it doesn't exist
if [ -z "$COGNITO_USER_POOL_ID" ]; then
    echo "Creating Cognito User Pool..."
    
    COGNITO_RESPONSE=$(aws cognito-idp create-user-pool \
        --pool-name "clouddocvault-users-${RANDOM_ID}" \
        --policies '{
            "PasswordPolicy": {
                "MinimumLength": 8,
                "RequireUppercase": true,
                "RequireLowercase": true,
                "RequireNumbers": true,
                "RequireSymbols": false
            }
        }' \
        --auto-verified-attributes email \
        --username-attributes email \
        --schema '[
            {
                "Name": "email",
                "AttributeDataType": "String",
                "Required": true,
                "Mutable": true
            },
            {
                "Name": "name",
                "AttributeDataType": "String",
                "Required": false,
                "Mutable": true
            }
        ]' \
        --admin-create-user-config '{
            "AllowAdminCreateUserOnly": false,
            "UnusedAccountValidityDays": 7
        }' \
        --user-pool-tags "Project=CloudDocVault,Environment=Production")
    
    COGNITO_USER_POOL_ID=$(echo "$COGNITO_RESPONSE" | grep -o '"Id": *"[^"]*"' | grep -o '"[^"]*"$' | tr -d '"')
    
    echo "✓ Created Cognito User Pool: $COGNITO_USER_POOL_ID"
else
    echo "✓ Found existing Cognito User Pool: $COGNITO_USER_POOL_ID"
fi

# Create Cognito User Pool Client
echo "Creating Cognito User Pool Client..."
COGNITO_CLIENT_RESPONSE=$(aws cognito-idp create-user-pool-client \
    --user-pool-id "$COGNITO_USER_POOL_ID" \
    --client-name "clouddocvault-client-${RANDOM_ID}" \
    --explicit-auth-flows "ALLOW_USER_PASSWORD_AUTH" "ALLOW_REFRESH_TOKEN_AUTH" \
    --no-generate-secret \
    --refresh-token-validity 30 \
    --access-token-validity 60 \
    --id-token-validity 60 \
    --token-validity-units '{
        "AccessToken": "minutes",
        "IdToken": "minutes", 
        "RefreshToken": "days"
    }' \
    --prevent-user-existence-errors ENABLED)

COGNITO_CLIENT_ID=$(echo "$COGNITO_CLIENT_RESPONSE" | grep -o '"ClientId": *"[^"]*"' | grep -o '"[^"]*"$' | tr -d '"')

echo "✓ Created Cognito User Pool Client: $COGNITO_CLIENT_ID"

# Create a demo user for testing
echo "Creating demo user..."
DEMO_PASSWORD="TempPass123!"
aws cognito-idp admin-create-user \
    --user-pool-id "$COGNITO_USER_POOL_ID" \
    --username "demo@clouddocvault.com" \
    --user-attributes Name=email,Value="demo@clouddocvault.com" Name=name,Value="Demo User" \
    --temporary-password "$DEMO_PASSWORD" \
    --message-action SUPPRESS 2>/dev/null || echo "Demo user may already exist"

# Set permanent password for demo user
aws cognito-idp admin-set-user-password \
    --user-pool-id "$COGNITO_USER_POOL_ID" \
    --username "demo@clouddocvault.com" \
    --password "$DEMO_PASSWORD" \
    --permanent 2>/dev/null || echo "Demo user password already set"

# Try to get CloudFront domain (optional)
CLOUDFRONT_DOMAIN=$(aws cloudfront list-distributions --query "DistributionList.Items[0].DomainName" --output text 2>/dev/null || echo "")

echo ""
echo "✓ AWS resources ready:"
echo "  S3 Primary Bucket: $S3_BUCKET_PRIMARY"
echo "  S3 Audit Bucket: $S3_BUCKET_AUDIT"
echo "  Cognito User Pool: $COGNITO_USER_POOL_ID"
echo "  Cognito Client ID: $COGNITO_CLIENT_ID"
echo "  CloudFront Domain: ${CLOUDFRONT_DOMAIN:-"Not configured"}"
echo "  EC2 Public IP: $EC2_PUBLIC_IP"
echo ""
echo "  Demo Login Credentials:"
echo "  Email: demo@clouddocvault.com"
echo "  Password: $DEMO_PASSWORD"
echo ""

# Step 6 — Write backend .env file
echo "Step 6: Writing backend configuration..."

# Generate JWT secret if not exists
if [ -f "/home/ubuntu/CloudDocVault/server/.env" ]; then
    JWT_COOKIE_SECRET=$(grep "JWT_COOKIE_SECRET=" /home/ubuntu/CloudDocVault/server/.env | cut -d'=' -f2 || openssl rand -hex 32)
else
    JWT_COOKIE_SECRET=$(openssl rand -hex 32)
fi

cat > /home/ubuntu/CloudDocVault/server/.env <<EOF
PORT=3001
NODE_ENV=production
AWS_REGION=${AWS_DEFAULT_REGION}
S3_BUCKET_PRIMARY=${S3_BUCKET_PRIMARY}
S3_BUCKET_AUDIT=${S3_BUCKET_AUDIT}
CLOUDFRONT_DOMAIN=${CLOUDFRONT_DOMAIN}
COGNITO_USER_POOL_ID=${COGNITO_USER_POOL_ID}
COGNITO_CLIENT_ID=${COGNITO_CLIENT_ID}
COGNITO_REGION=${AWS_DEFAULT_REGION}
CLOUDWATCH_NAMESPACE=CloudDocVault
PROMETHEUS_URL=http://localhost:9090
CORS_ORIGIN=http://${EC2_PUBLIC_IP}
JWT_COOKIE_SECRET=${JWT_COOKIE_SECRET}
EOF

echo "✓ Backend configuration written"

# Step 7 — Write frontend .env file
echo "Step 7: Writing frontend configuration..."

cat > /home/ubuntu/CloudDocVault/client/.env <<EOF
VITE_API_BASE_URL=/api
VITE_APP_NAME=CloudDocVault
EOF

echo "✓ Frontend configuration written"

# Step 8 — Install backend dependencies
echo "Step 8: Installing backend dependencies..."
cd /home/ubuntu/CloudDocVault/server
npm ci --omit=dev --silent
chown -R ubuntu:ubuntu /home/ubuntu/CloudDocVault/server

echo "✓ Backend dependencies installed"

# Step 9 — Install and build frontend
echo "Step 9: Building frontend..."
cd /home/ubuntu/CloudDocVault/client
npm ci --silent
npm run build --silent
chown -R ubuntu:ubuntu /home/ubuntu/CloudDocVault/client

echo "✓ Frontend built"

# Step 10 — Create log directory
echo "Step 10: Creating log directory..."
mkdir -p /home/ubuntu/CloudDocVault/logs
chown -R ubuntu:ubuntu /home/ubuntu/CloudDocVault/logs

echo "✓ Log directory created"

# Step 11 — Write and enable Nginx config
echo "Step 11: Configuring Nginx..."

sudo tee /etc/nginx/sites-available/clouddocvault > /dev/null <<EOF
server {
    listen 80;
    server_name _;

    # Serve React build (static files)
    root /home/ubuntu/CloudDocVault/client/dist;
    index index.html;

    # Frontend SPA — all non-API routes return index.html
    location / {
        try_files \$uri \$uri/ /index.html;
    }

    # Proxy API calls to Node.js backend
    location /api/ {
        proxy_pass http://localhost:3001/api/;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 60s;
    }

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/javascript application/json image/svg+xml;
    gzip_min_length 1024;

    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header Referrer-Policy strict-origin-when-cross-origin;
}
EOF

sudo ln -sf /etc/nginx/sites-available/clouddocvault /etc/nginx/sites-enabled/clouddocvault
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx
sudo systemctl enable nginx

# Fix permissions for nginx to access static files
chmod 755 /home/ubuntu
chmod 755 /home/ubuntu/CloudDocVault
chmod 755 /home/ubuntu/CloudDocVault/client
chmod 755 /home/ubuntu/CloudDocVault/client/dist
chmod 755 /home/ubuntu/CloudDocVault/client/dist/assets 2>/dev/null || true
find /home/ubuntu/CloudDocVault/client/dist -type f -exec chmod 644 {} \; 2>/dev/null || true

echo "✓ Nginx configured and started"

# Step 12 — Start or reload PM2
echo "Step 12: Starting application server..."
cd /home/ubuntu/CloudDocVault/server

# Stop any existing PM2 processes
pm2 delete clouddocvault-api 2>/dev/null || true

# Kill any PM2 daemon running as root
sudo pm2 kill 2>/dev/null || true

# Start PM2 as ubuntu user
pm2 start ecosystem.config.js --env production
pm2 save

# Setup PM2 startup as ubuntu user
STARTUP_CMD=$(pm2 startup systemd -u ubuntu --hp /home/ubuntu | grep "sudo")
if [ -n "$STARTUP_CMD" ]; then
    eval "$STARTUP_CMD"
fi

echo "✓ Application server started"

# Step 13 — Health check
echo "Step 13: Performing health check..."
sleep 5
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost/api/health)
if [ "$HTTP_STATUS" != "200" ]; then
  echo "HEALTH CHECK FAILED — HTTP status: $HTTP_STATUS"
  echo "Check logs: pm2 logs clouddocvault-api"
  exit 1
fi

echo "✓ Health check passed"

# Step 14 — Print summary
echo ""
echo "============================================"
echo " CloudDocVault — Deployment Complete"
echo "============================================"
echo " Application URL : http://${EC2_PUBLIC_IP}"
echo " API Health      : http://${EC2_PUBLIC_IP}/api/health"
echo " PM2 status      : pm2 status"
echo " Backend logs    : pm2 logs clouddocvault-api"
echo " Nginx logs      : sudo tail -f /var/log/nginx/access.log"
echo "============================================"
echo ""
echo "🎉 CloudDocVault is now running!"
echo ""
echo "📋 Demo Login Credentials:"
echo "   Email: demo@clouddocvault.com"
echo "   Password: TempPass123!"
echo ""
echo "🔧 AWS Resources Created:"
echo "   S3 Primary: $S3_BUCKET_PRIMARY"
echo "   S3 Audit: $S3_BUCKET_AUDIT"
echo "   Cognito Pool: $COGNITO_USER_POOL_ID"
echo ""
echo "📖 Next steps:"
echo "1. Visit http://${EC2_PUBLIC_IP} and login with demo credentials"
echo "2. Create additional users in Cognito User Pool if needed"
echo "3. Configure CloudTrail for comprehensive audit logging"
echo "4. Set up CloudWatch alarms for production monitoring"
echo "5. Consider setting up SSL/TLS certificate for HTTPS"
echo ""
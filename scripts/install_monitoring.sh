#!/usr/bin/env bash
set -euo pipefail

echo "Installing CloudDocVault Monitoring Stack..."

PROM_VERSION="2.47.0"
GRAFANA_VERSION="10.2.3"
EXPORTER_PORT="8000"
NODE_EXPORTER_VERSION="1.7.0"

# Install Prometheus
echo "Installing Prometheus ${PROM_VERSION}..."
cd /tmp
wget -q "https://github.com/prometheus/prometheus/releases/download/v${PROM_VERSION}/prometheus-${PROM_VERSION}.linux-amd64.tar.gz"
tar xzf "prometheus-${PROM_VERSION}.linux-amd64.tar.gz"
sudo mv "prometheus-${PROM_VERSION}.linux-amd64/prometheus" /usr/local/bin/
sudo mv "prometheus-${PROM_VERSION}.linux-amd64/promtool"   /usr/local/bin/
sudo mkdir -p /etc/prometheus /var/lib/prometheus
sudo useradd --no-create-home --shell /bin/false prometheus 2>/dev/null || true
sudo chown prometheus:prometheus /var/lib/prometheus

# Copy config
sudo cp ~/CloudDocVault/monitoring/prometheus/prometheus.yml /etc/prometheus/
sudo cp ~/CloudDocVault/monitoring/prometheus/alerts.yml      /etc/prometheus/
sudo chown -R prometheus:prometheus /etc/prometheus

# Systemd unit
sudo tee /etc/systemd/system/prometheus.service > /dev/null <<EOF
[Unit]
Description=Prometheus
After=network.target

[Service]
User=prometheus
ExecStart=/usr/local/bin/prometheus \\
  --config.file=/etc/prometheus/prometheus.yml \\
  --storage.tsdb.path=/var/lib/prometheus \\
  --storage.tsdb.retention.time=30d \\
  --web.listen-address=0.0.0.0:9090
Restart=always

[Install]
WantedBy=multi-user.target
EOF
sudo systemctl daemon-reload
sudo systemctl enable prometheus
sudo systemctl start prometheus

# Install node_exporter
echo "Installing Node Exporter ${NODE_EXPORTER_VERSION}..."
wget -q "https://github.com/prometheus/node_exporter/releases/download/v${NODE_EXPORTER_VERSION}/node_exporter-${NODE_EXPORTER_VERSION}.linux-amd64.tar.gz"
tar xzf "node_exporter-${NODE_EXPORTER_VERSION}.linux-amd64.tar.gz"
sudo mv "node_exporter-${NODE_EXPORTER_VERSION}.linux-amd64/node_exporter" /usr/local/bin/
sudo useradd --no-create-home --shell /bin/false node_exporter 2>/dev/null || true
sudo tee /etc/systemd/system/node_exporter.service > /dev/null <<EOF
[Unit]
Description=Node Exporter
After=network.target

[Service]
User=node_exporter
ExecStart=/usr/local/bin/node_exporter
Restart=always

[Install]
WantedBy=multi-user.target
EOF
sudo systemctl daemon-reload
sudo systemctl enable node_exporter
sudo systemctl start node_exporter

# Install Grafana
echo "Installing Grafana ${GRAFANA_VERSION}..."
sudo apt-get install -y -qq adduser libfontconfig1 musl
wget -q "https://dl.grafana.com/oss/release/grafana_${GRAFANA_VERSION}_amd64.deb"
sudo dpkg -i "grafana_${GRAFANA_VERSION}_amd64.deb" || sudo apt-get install -f -y
sudo systemctl enable grafana-server
sudo systemctl start grafana-server

# Copy provisioning configs
sudo mkdir -p /var/lib/grafana/dashboards
sudo cp -r ~/CloudDocVault/monitoring/grafana/provisioning/. /etc/grafana/provisioning/
sudo cp ~/CloudDocVault/monitoring/grafana/dashboards/*.json /var/lib/grafana/dashboards/ 2>/dev/null || true
sudo chown -R grafana:grafana /etc/grafana/provisioning /var/lib/grafana/dashboards
sudo systemctl restart grafana-server

# Install custom CloudDocVault exporter
echo "Installing CloudDocVault custom exporter..."
pip3 install prometheus_client boto3 --quiet || sudo apt-get install -y python3-pip && pip3 install prometheus_client boto3 --quiet

sudo tee /etc/systemd/system/cdv-exporter.service > /dev/null <<EOF
[Unit]
Description=CloudDocVault Prometheus Exporter
After=network.target

[Service]
User=ubuntu
WorkingDirectory=/home/ubuntu/CloudDocVault
ExecStart=/usr/bin/python3 monitoring/exporters/clouddocvault_exporter.py
Environment="AWS_DEFAULT_REGION=us-east-1"
Environment="PRIMARY_BUCKET=${S3_BUCKET_PRIMARY:-clouddocvault-primary-f870c4c3}"
Environment="EXPORTER_PORT=${EXPORTER_PORT}"
Restart=always

[Install]
WantedBy=multi-user.target
EOF
sudo systemctl daemon-reload
sudo systemctl enable cdv-exporter
sudo systemctl start cdv-exporter

echo ""
echo "✓ Monitoring stack installed successfully!"
echo ""
echo "Access URLs:"
echo "  - Prometheus: http://$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4):9090"
echo "  - Grafana:    http://$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4):3000 (admin/admin)"
echo "  - Node Exporter: http://localhost:9100/metrics"
echo "  - CDV Exporter:  http://localhost:${EXPORTER_PORT}/metrics"
echo ""
echo "Services status:"
sudo systemctl status prometheus --no-pager -l | head -3
sudo systemctl status grafana-server --no-pager -l | head -3
sudo systemctl status node_exporter --no-pager -l | head -3
sudo systemctl status cdv-exporter --no-pager -l | head -3

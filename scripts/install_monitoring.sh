#!/usr/bin/env bash
set -euo pipefail

PROM_VERSION="2.47.0"
GRAFANA_VERSION="10.2.3"
EXPORTER_PORT="8000"
NODE_EXPORTER_VERSION="1.7.0"

# Install Prometheus
cd /tmp
wget -q "https://github.com/prometheus/prometheus/releases/download/v${PROM_VERSION}/prometheus-${PROM_VERSION}.linux-amd64.tar.gz"
tar xzf "prometheus-${PROM_VERSION}.linux-amd64.tar.gz"
sudo mv "prometheus-${PROM_VERSION}.linux-amd64/prometheus" /usr/local/bin/
sudo mv "prometheus-${PROM_VERSION}.linux-amd64/promtool"   /usr/local/bin/
sudo mkdir -p /etc/prometheus /var/lib/prometheus
sudo useradd --no-create-home --shell /bin/false prometheus 2>/dev/null || true
sudo chown prometheus:prometheus /var/lib/prometheus

# Copy config
sudo cp /home/ubuntu/clouddocvault/monitoring/prometheus/prometheus.yml /etc/prometheus/
sudo cp /home/ubuntu/clouddocvault/monitoring/prometheus/alerts.yml      /etc/prometheus/
sudo chown -R prometheus:prometheus /etc/prometheus

# Systemd unit
sudo tee /etc/systemd/system/prometheus.service > /dev/null <<EOF
[Unit]
Description=Prometheus
After=network.target

[Service]
User=prometheus
ExecStart=/usr/local/bin/prometheus \
  --config.file=/etc/prometheus/prometheus.yml \
  --storage.tsdb.path=/var/lib/prometheus \
  --storage.tsdb.retention.time=30d \
  --web.listen-address=0.0.0.0:9090
Restart=always

[Install]
WantedBy=multi-user.target
EOF
sudo systemctl daemon-reload
sudo systemctl enable --now prometheus

# Install node_exporter
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
sudo systemctl enable --now node_exporter

# Install Grafana
sudo apt-get install -y -qq adduser libfontconfig1 musl
wget -q "https://dl.grafana.com/oss/release/grafana_${GRAFANA_VERSION}_amd64.deb"
sudo dpkg -i "grafana_${GRAFANA_VERSION}_amd64.deb"
sudo systemctl enable --now grafana-server

# Copy provisioning configs
sudo cp -r /home/ubuntu/clouddocvault/monitoring/grafana/provisioning/. /etc/grafana/provisioning/
sudo cp -r /home/ubuntu/clouddocvault/monitoring/grafana/dashboards/.   /var/lib/grafana/dashboards/
sudo chown -R grafana:grafana /etc/grafana/provisioning /var/lib/grafana/dashboards
sudo systemctl restart grafana-server

# Install custom CloudDocVault exporter
pip3 install prometheus_client boto3 --quiet
sudo tee /etc/systemd/system/cdv-exporter.service > /dev/null <<EOF
[Unit]
Description=CloudDocVault Prometheus Exporter
After=network.target

[Service]
User=ubuntu
WorkingDirectory=/home/ubuntu/clouddocvault
ExecStart=/usr/bin/python3 monitoring/exporters/clouddocvault_exporter.py
Environment="AWS_DEFAULT_REGION=${AWS_DEFAULT_REGION}"
Environment="PRIMARY_BUCKET=${S3_BUCKET_PRIMARY}"
Environment="EXPORTER_PORT=${EXPORTER_PORT}"
Restart=always

[Install]
WantedBy=multi-user.target
EOF
sudo systemctl daemon-reload
sudo systemctl enable --now cdv-exporter

echo "Monitoring stack installed — Prometheus:9090 | Grafana:3000 | Exporter:${EXPORTER_PORT}"

# Self-Hosting Deployment Guide for Weiss Solutions

This document explains how to deploy the Weiss Solutions Phoenix/Elixir application on a Fedora Server using Cloudflare Tunnel for external access.

## Architecture Overview

```
Internet → Cloudflare Tunnel → Phoenix App (port 4000)
```

**Why this setup?**
- **Phoenix App (port 4000)**: Your Elixir/Phoenix web application runs directly
- **Cloudflare Tunnel**: Provides secure external access without port forwarding or reverse proxy

## Prerequisites

- Fedora Server (tested on Fedora 41)
- Elixir 1.17+ and Erlang/OTP 26+ installed
- Root/sudo access (you'll need someone with sudo to help set up systemd services)
- A domain name (for Cloudflare Tunnel setup)
- Cloudflare account (free tier works)

## Part 1: Install Dependencies

### 1.1 Install Cloudflare Tunnel (cloudflared)

```bash
# Install cloudflared (requires sudo)
sudo dnf install -y cloudflared

# Verify installation
cloudflared --version
```

### 1.2 Verify Elixir Installation

```bash
# Check Elixir version (should be 1.17+)
elixir --version
```

If Elixir is not installed:
```bash
sudo dnf install -y elixir erlang
```

## Part 2: Build Phoenix Application

### 2.1 Navigate to Project Directory

```bash
cd /home/mikaelweiss/code/web/weisssolutions
```

### 2.2 Install Dependencies and Build for Production

```bash
# Install Hex package manager (if needed)
mix local.hex --force

# Install Rebar (Erlang build tool)
mix local.rebar --force

# Get production dependencies
MIX_ENV=prod mix deps.get --only prod

# Compile assets (CSS, JavaScript)
MIX_ENV=prod mix assets.deploy

# Build production release
MIX_ENV=prod mix release
```

This creates a standalone release in `_build/prod/rel/weisssolutions/`

### 2.3 Generate Secret Key Base

```bash
# Generate a secret key for Phoenix
mix phx.gen.secret
```

**IMPORTANT**: Save this secret key - you'll need it for the systemd service.

## Part 3: Create Systemd Service

### 3.1 Create Service File

Create `/etc/systemd/system/weisssolutions.service`:

```ini
[Unit]
Description=Weiss Solutions Phoenix Application
After=network.target

[Service]
Type=simple
User=mikaelweiss
Group=mikaelweiss
WorkingDirectory=/home/mikaelweiss/code/web/weisssolutions
Environment="MIX_ENV=prod"
Environment="PHX_SERVER=true"
Environment="PHX_HOST=localhost"
Environment="PORT=4000"
Environment="DNS_CLUSTER_QUERY="
Environment="SECRET_KEY_BASE=YOUR_SECRET_KEY_HERE"
ExecStart=/home/mikaelweiss/code/web/weisssolutions/_build/prod/rel/weisssolutions/bin/server
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=weisssolutions

[Install]
WantedBy=multi-user.target
```

**Replace `YOUR_SECRET_KEY_HERE`** with the secret generated in step 2.3

### 3.2 Enable and Start Service (requires sudo)

```bash
# Ask someone with sudo to run these commands:

# Reload systemd
sudo systemctl daemon-reload

# Enable service to start on boot
sudo systemctl enable weisssolutions

# Start the service
sudo systemctl start weisssolutions

# Check status
sudo systemctl status weisssolutions
```

### 3.3 Verify Application is Running

```bash
# Check if app is listening on port 4000
curl http://localhost:4000

# View logs (requires sudo)
sudo journalctl -u weisssolutions -f
```

## Part 4: Set Up Cloudflare Tunnel

### 4.1 Authenticate with Cloudflare

```bash
# Login to Cloudflare (this will open a browser)
cloudflared tunnel login
```

This creates an authentication certificate at `~/.cloudflared/cert.pem`

### 4.2 Create a Tunnel

```bash
# Create a new tunnel (replace 'weisssolutions' with your preferred name)
cloudflared tunnel create weisssolutions

# This creates a credentials file at:
# ~/.cloudflared/<TUNNEL-ID>.json
```

**Save the Tunnel ID** - you'll need it next.

### 4.3 Create Tunnel Configuration

Create `~/.cloudflared/config.yml`:

```yaml
tunnel: YOUR-TUNNEL-ID-HERE
credentials-file: /home/mikaelweiss/.cloudflared/YOUR-TUNNEL-ID-HERE.json

ingress:
  - hostname: yourdomain.com
    service: http://localhost:4000
  - service: http_status:404
```

**Replace:**
- `YOUR-TUNNEL-ID-HERE` with your actual tunnel ID
- `yourdomain.com` with your actual domain

**Example (current working setup):**
```yaml
tunnel: 84027c7b-04bc-462e-b71f-156e5cea8e0d
credentials-file: /home/mikaelweiss/.cloudflared/84027c7b-04bc-462e-b71f-156e5cea8e0d.json

ingress:
  - hostname: weisssolutions.org
    service: http://localhost:4000
  - service: http_status:404
```

### 4.4 Route DNS to Tunnel

```bash
# Route your domain to the tunnel
cloudflared tunnel route dns weisssolutions yourdomain.com
```

This automatically creates a CNAME record in Cloudflare pointing to your tunnel.

### 4.5 Create Cloudflared Systemd Service (requires sudo)

```bash
# Ask someone with sudo to run these commands:

# Install cloudflared as a system service
sudo cloudflared service install

# Start the service
sudo systemctl start cloudflared

# Enable on boot
sudo systemctl enable cloudflared

# Check status
sudo systemctl status cloudflared
```

## Part 5: Testing

### 5.1 Test Locally

```bash
# Test Phoenix directly
curl http://localhost:4000

# Check services are running
systemctl status weisssolutions  # requires sudo to view
systemctl status cloudflared     # requires sudo to view
```

### 5.2 Test Externally

Visit `https://yourdomain.com` in your browser. You should see your Weiss Solutions website!

### 5.3 View Logs (requires sudo)

```bash
# Phoenix app logs
sudo journalctl -u weisssolutions -f

# Cloudflare Tunnel logs
sudo journalctl -u cloudflared -f

# View both together
sudo journalctl -u weisssolutions -u cloudflared -f
```

## Troubleshooting

### Phoenix App Won't Start

```bash
# Check logs (requires sudo)
sudo journalctl -u weisssolutions -n 50

# Common issues:
# - Missing SECRET_KEY_BASE in service file
# - Incorrect file permissions
# - Release not built properly

# Rebuild the release
cd /home/mikaelweiss/code/web/weisssolutions
MIX_ENV=prod mix release --overwrite

# Ask someone with sudo to restart:
sudo systemctl restart weisssolutions
```

### Cloudflare Tunnel Not Working

```bash
# Check tunnel status (requires sudo)
sudo systemctl status cloudflared

# Verify tunnel configuration
cat ~/.cloudflared/config.yml

# Test tunnel connectivity
cloudflared tunnel info weisssolutions

# Ask someone with sudo to restart:
sudo systemctl restart cloudflared
```

### Can't Access Site Externally

1. Check all services are running (requires sudo):
   ```bash
   sudo systemctl status weisssolutions cloudflared
   ```

2. Verify DNS propagation:
   ```bash
   dig yourdomain.com
   # Should show a CNAME to Cloudflare Tunnel
   ```

3. Check Cloudflare dashboard:
   - Go to Zero Trust > Access > Tunnels
   - Verify tunnel shows as "Healthy"

### Check What Port Phoenix is Listening On

```bash
# See if Phoenix is listening on port 4000
ss -tlnp | grep :4000
```

## Updating the Application

When you make changes to your code:

```bash
cd /home/mikaelweiss/code/web/weisssolutions

# Pull latest changes (if using git)
git pull

# Rebuild assets and release
MIX_ENV=prod mix deps.get --only prod
MIX_ENV=prod mix assets.deploy
MIX_ENV=prod mix release --overwrite

# Ask someone with sudo to restart the service:
sudo systemctl restart weisssolutions

# Check status (requires sudo)
sudo systemctl status weisssolutions
```

## Maintenance Commands

```bash
# View all application logs (requires sudo)
sudo journalctl -u weisssolutions -u cloudflared -f

# Restart services (requires sudo)
sudo systemctl restart weisssolutions cloudflared

# Stop services (requires sudo)
sudo systemctl stop weisssolutions cloudflared

# Check service status (requires sudo)
systemctl is-active weisssolutions cloudflared
```

## Security Considerations

1. **Firewall**: No ports need to be opened - Cloudflare Tunnel handles all external traffic
2. **Updates**: Keep Fedora, Elixir, and cloudflared updated:
   ```bash
   sudo dnf update -y
   ```
3. **Secrets**: Never commit `SECRET_KEY_BASE` or `~/.cloudflared/*.json` to git
4. **Permissions**: Service runs as your user (mikaelweiss), not root

## System Resources

Typical resource usage:
- Phoenix app: ~50-100 MB RAM
- cloudflared: ~20-30 MB RAM
- Total: ~70-130 MB RAM

## Configuration Files Reference

- **Phoenix App**: `/home/mikaelweiss/code/web/weisssolutions/`
- **Systemd Service**: `/etc/systemd/system/weisssolutions.service`
- **Cloudflare Config**: `~/.cloudflared/config.yml`
- **Cloudflare Credentials**: `~/.cloudflared/<TUNNEL-ID>.json`

## Current Working Setup

- **Domain**: weisssolutions.org
- **Tunnel ID**: 84027c7b-04bc-462e-b71f-156e5cea8e0d
- **Phoenix Port**: 4000
- **Services Running**:
  - weisssolutions.service (Phoenix app)
  - cloudflared.service (Cloudflare Tunnel)

## Useful Links

- [Phoenix Framework Deployment Guide](https://hexdocs.pm/phoenix/deployment.html)
- [Cloudflare Tunnel Documentation](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/)
- [Elixir Releases](https://hexdocs.pm/mix/Mix.Tasks.Release.html)

---

**Last Updated**: 2025-10-23
**Server**: Fedora Server 41
**Application**: Weiss Solutions (Phoenix 1.7.18 + Elixir 1.17.3)
**Architecture**: Direct Cloudflare Tunnel → Phoenix (no reverse proxy)

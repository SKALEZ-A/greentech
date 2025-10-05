# Docker Deployment Guide

This guide covers deploying the Carbon Capture Network using Docker and Docker Compose.

## Prerequisites

- Docker Engine 20.10 or later
- Docker Compose 2.0 or later
- At least 8GB RAM available
- At least 50GB free disk space

## Quick Start

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-org/carbon-capture-network.git
   cd carbon-capture-network
   ```

2. **Create environment file**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Start the application**
   ```bash
   docker-compose -f deployment/docker/docker-compose.prod.yml up -d
   ```

4. **Check deployment status**
   ```bash
   docker-compose -f deployment/docker/docker-compose.prod.yml ps
   ```

## Environment Configuration

Create a `.env` file in the project root with the following variables:

```bash
# Database Configuration
MONGO_ROOT_USERNAME=admin
MONGO_ROOT_PASSWORD=your_secure_mongo_password
REDIS_PASSWORD=your_secure_redis_password

# JWT Configuration
JWT_SECRET=your_super_secret_jwt_key_here
JWT_EXPIRE=24h

# Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# Blockchain Configuration
ETHEREUM_RPC_URL=https://mainnet.infura.io/v3/YOUR_PROJECT_ID
CARBON_CREDIT_CONTRACT_ADDRESS=0x...

# AWS Configuration (for backups)
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
S3_BUCKET=carbon-capture-backups-prod

# Grafana Configuration
GRAFANA_ADMIN_USER=admin
GRAFANA_ADMIN_PASSWORD=your_secure_grafana_password
```

## Service Architecture

The deployment consists of the following services:

### Core Services
- **nginx**: Reverse proxy and load balancer
- **frontend**: Next.js web application
- **backend**: Node.js API server
- **ai-engine**: Python AI/ML service
- **mongodb**: Document database
- **redis**: Cache and session store

### Supporting Services
- **mosquitto**: MQTT broker for IoT communication
- **prometheus**: Metrics collection
- **grafana**: Monitoring dashboard
- **elasticsearch**: Log storage
- **logstash**: Log processing
- **backup**: Automated backup service

## Scaling Services

### Horizontal Scaling
```bash
# Scale backend services
docker-compose -f deployment/docker/docker-compose.prod.yml up -d --scale backend=5

# Scale AI engine
docker-compose -f deployment/docker/docker-compose.prod.yml up -d --scale ai-engine=3
```

### Resource Limits
Each service has configured resource limits. Adjust in `docker-compose.prod.yml`:

```yaml
backend:
  deploy:
    resources:
      limits:
        memory: 1Gi
        cpus: '1.0'
      reservations:
        memory: 512Mi
        cpus: '0.5'
```

## Monitoring

### Accessing Grafana
- URL: http://localhost:3002
- Username: admin (from .env)
- Password: configured in .env

### Accessing Prometheus
- URL: http://localhost:9090

### Viewing Logs
```bash
# View all service logs
docker-compose -f deployment/docker/docker-compose.prod.yml logs -f

# View specific service logs
docker-compose -f deployment/docker/docker-compose.prod.yml logs -f backend
```

## Backup and Recovery

### Automated Backups
The backup service runs daily at 2 AM by default. Configuration:

```bash
# Environment variables
BACKUP_SCHEDULE=0 2 * * *  # Cron schedule
RETENTION_DAYS=30         # Days to keep backups
S3_BUCKET=your-backup-bucket
```

### Manual Backup
```bash
# Create backup
docker-compose -f deployment/docker/docker-compose.prod.yml exec backup \
  python backup_service.py backup --type full

# List backups
docker-compose -f deployment/docker/docker-compose.prod.yml exec backup \
  python backup_service.py list
```

### Restore from Backup
```bash
# Restore specific backup
docker-compose -f deployment/docker/docker-compose.prod.yml exec backup \
  python backup_service.py restore --name backup_20231201_020000 --target all
```

## Troubleshooting

### Common Issues

1. **Port conflicts**
   ```bash
   # Check what's using ports
   lsof -i :80
   lsof -i :443

   # Change ports in docker-compose.prod.yml
   ```

2. **Insufficient memory**
   ```bash
   # Check Docker memory limits
   docker system info

   # Increase Docker memory allocation
   ```

3. **Database connection issues**
   ```bash
   # Check MongoDB logs
   docker-compose -f deployment/docker/docker-compose.prod.yml logs mongodb

   # Verify connection
   docker-compose -f deployment/docker/docker-compose.prod.yml exec mongodb \
     mongo --eval "db.stats()"
   ```

4. **AI Engine not starting**
   ```bash
   # Check AI engine logs
   docker-compose -f deployment/docker/docker-compose.prod.yml logs ai-engine

   # Verify Python dependencies
   docker-compose -f deployment/docker/docker-compose.prod.yml exec ai-engine \
     pip list
   ```

### Health Checks

All services include health checks. Monitor status:

```bash
# Check all services
docker-compose -f deployment/docker/docker-compose.prod.yml ps

# Check specific service health
docker-compose -f deployment/docker/docker-compose.prod.yml exec backend \
  curl -f http://localhost:3001/api/v1/health
```

## Security Considerations

1. **Change default passwords** in `.env`
2. **Use HTTPS** in production (nginx SSL configuration)
3. **Enable authentication** for all services
4. **Regular security updates** of Docker images
5. **Network segmentation** using Docker networks
6. **Secrets management** using Docker secrets or external providers

## Production Optimization

### Performance Tuning

1. **Database optimization**
   ```yaml
   mongodb:
     command: --wiredTigerCacheSizeGB 2 --wiredTigerMaxCacheOverflowSizeGB 0.5
   ```

2. **Redis optimization**
   ```yaml
   redis:
     command: redis-server --maxmemory 512mb --maxmemory-policy allkeys-lru
   ```

3. **Nginx optimization**
   ```nginx
   worker_processes auto;
   worker_connections 1024;
   ```

### Resource Monitoring

Set up alerts for:
- CPU usage > 80%
- Memory usage > 85%
- Disk space < 10GB free
- Database connections > 80% of limit
- API response time > 2 seconds

## Updating Deployment

1. **Pull latest images**
   ```bash
   docker-compose -f deployment/docker/docker-compose.prod.yml pull
   ```

2. **Update with zero-downtime**
   ```bash
   docker-compose -f deployment/docker/docker-compose.prod.yml up -d --no-deps backend
   ```

3. **Rollback if needed**
   ```bash
   docker-compose -f deployment/docker/docker-compose.prod.yml up -d --no-deps backend:previous-tag
   ```

## Maintenance

### Regular Tasks

1. **Log rotation**: Handled by Docker
2. **Database backups**: Automated daily
3. **Security updates**: Weekly image updates
4. **Performance monitoring**: Continuous via Grafana
5. **Storage cleanup**: Automatic old backup removal

### Emergency Procedures

1. **Service restart**
   ```bash
   docker-compose -f deployment/docker/docker-compose.prod.yml restart backend
   ```

2. **Full system restart**
   ```bash
   docker-compose -f deployment/docker/docker-compose.prod.yml down
   docker-compose -f deployment/docker/docker-compose.prod.yml up -d
   ```

3. **Data recovery**
   - Use backup service to restore from S3
   - Verify data integrity after restore
   - Update monitoring dashboards

## Support

For deployment issues:
1. Check logs: `docker-compose logs -f [service]`
2. Verify configuration in `.env`
3. Check resource usage: `docker stats`
4. Review health checks: `docker ps`
5. Consult monitoring dashboards in Grafana

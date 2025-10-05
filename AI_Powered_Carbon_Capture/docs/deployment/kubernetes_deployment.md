# Kubernetes Deployment Guide

This guide covers deploying the Carbon Capture Network on Kubernetes using the provided Helm charts and Kubernetes manifests.

## Prerequisites

- Kubernetes cluster (v1.24+)
- kubectl configured
- Helm 3.x
- At least 3 worker nodes with 4GB RAM each
- Storage class configured for persistent volumes

## Quick Start

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-org/carbon-capture-network.git
   cd carbon-capture-network
   ```

2. **Create namespace**
   ```bash
   kubectl create namespace carbon-capture
   ```

3. **Apply Kubernetes manifests**
   ```bash
   kubectl apply -f deployment/kubernetes/deployment.yaml
   ```

4. **Check deployment status**
   ```bash
   kubectl get pods -n carbon-capture
   kubectl get services -n carbon-capture
   ```

## Configuration

### Secrets Management

Create secrets for sensitive data:

```bash
# Database secrets
kubectl create secret generic carbon-capture-secrets \
  --from-literal=jwt-secret='your-jwt-secret' \
  --from-literal=mongo-root-username='admin' \
  --from-literal=mongo-root-password='secure-password' \
  --from-literal=redis-password='redis-pass' \
  --namespace carbon-capture

# SMTP configuration
kubectl create secret generic smtp-secrets \
  --from-literal=smtp-user='your-email@gmail.com' \
  --from-literal=smtp-pass='your-app-password' \
  --namespace carbon-capture
```

### ConfigMaps

Update the carbon-capture-config ConfigMap with your environment-specific values:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: carbon-capture-config
  namespace: carbon-capture
data:
  NODE_ENV: "production"
  LOG_LEVEL: "info"
  AI_ENGINE_URL: "http://ai-engine-service:8000"
  REDIS_URL: "redis://redis-service:6379"
  MONGODB_URI: "mongodb://mongodb-service:27017/carbon_capture_prod"
  MQTT_BROKER_URL: "mqtt://mosquitto-service:1883"
  ENVIRONMENT: "production"
```

## Service Components

### Core Services

1. **Backend Deployment**
   - 3 replicas with rolling updates
   - Horizontal Pod Autoscaler configured
   - Resource limits and health checks

2. **AI Engine Deployment**
   - 2 replicas for high availability
   - GPU support (optional) for ML workloads
   - Persistent volume for model storage

3. **Frontend Deployment**
   - 2 replicas behind load balancer
   - Static file caching
   - Next.js optimized configuration

### Database Services

1. **MongoDB StatefulSet**
   - 3 replicas for high availability
   - Persistent storage with backup
   - Automated failover

2. **Redis Deployment**
   - Single replica with persistence
   - Connection pooling configured

### Supporting Services

1. **Mosquitto (MQTT Broker)**
   - Authentication enabled
   - Persistent storage for retained messages
   - WebSocket support

2. **Monitoring Stack**
   - Prometheus for metrics collection
   - Grafana for visualization
   - AlertManager for notifications

3. **Logging Stack**
   - Elasticsearch for log storage
   - Logstash for log processing
   - Kibana for log visualization

## Storage Configuration

### Persistent Volumes

The deployment requires several persistent volumes:

```yaml
# AI Models Storage
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: ai-models-pvc
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 100Gi
  storageClassName: fast-ssd

# Database Storage
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: mongodb-data
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 50Gi

# Redis Storage
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: redis-pvc
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 10Gi
```

### Storage Classes

Ensure your cluster has appropriate storage classes:

```bash
# List available storage classes
kubectl get storageclass

# Create storage class if needed
kubectl apply -f storage-class.yaml
```

## Networking

### Ingress Configuration

The deployment includes an Ingress resource for external access:

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: carbon-capture-ingress
  annotations:
    kubernetes.io/ingress.class: "nginx"
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
spec:
  tls:
  - hosts:
    - carboncapture.network
    - api.carboncapture.network
    secretName: carbon-capture-tls
  rules:
  - host: carboncapture.network
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: frontend-service
            port:
              number: 3000
  - host: api.carboncapture.network
    http:
      paths:
      - path: /api
        pathType: Prefix
        backend:
          service:
            name: backend-service
            port:
              number: 3001
```

### Network Policies

Apply network policies for security:

```bash
kubectl apply -f network-policies.yaml
```

## Scaling

### Horizontal Pod Autoscaler

The deployment includes HPAs for automatic scaling:

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: backend-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: backend-deployment
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
```

### Manual Scaling

Scale services manually:

```bash
# Scale backend
kubectl scale deployment backend-deployment --replicas=5 -n carbon-capture

# Scale AI engine
kubectl scale deployment ai-engine-deployment --replicas=3 -n carbon-capture
```

## Monitoring and Observability

### Prometheus Metrics

Services expose metrics endpoints:
- Backend: `/api/v1/metrics`
- AI Engine: `/metrics`
- Frontend: `/api/metrics`

### Grafana Dashboards

Access Grafana at: `http://grafana.carboncapture.network`

Pre-configured dashboards:
- Carbon Capture Overview
- System Performance
- AI Engine Metrics
- Database Performance

### Logging

Centralized logging with ELK stack:
- Logs collected by Logstash
- Stored in Elasticsearch
- Visualized in Kibana

Access Kibana at: `http://kibana.carboncapture.network`

## Backup and Recovery

### Automated Backups

Deploy the backup service:

```bash
kubectl apply -f backup-deployment.yaml
```

### Database Backups

MongoDB backups are automated:
- Daily backups at 2 AM
- Stored in persistent volume and S3
- Retention: 30 days

### Recovery Procedures

1. **Database Recovery**
   ```bash
   # Scale down application
   kubectl scale deployment backend-deployment --replicas=0

   # Restore from backup
   kubectl exec -it backup-pod -- python backup_service.py restore --name latest-backup --target mongodb

   # Scale up application
   kubectl scale deployment backend-deployment --replicas=3
   ```

2. **Full System Recovery**
   - Restore persistent volumes from backups
   - Redeploy all services
   - Verify data integrity

## Security

### RBAC Configuration

The deployment includes RBAC:

```bash
# Create service account
kubectl apply -f service-account.yaml

# Apply RBAC rules
kubectl apply -f rbac.yaml
```

### Pod Security Standards

Apply security contexts:

```yaml
spec:
  securityContext:
    runAsNonRoot: true
    runAsUser: 1000
    fsGroup: 1000
  containers:
  - securityContext:
      allowPrivilegeEscalation: false
      capabilities:
        drop:
        - ALL
      readOnlyRootFilesystem: true
```

### Network Security

- All services communicate over internal network
- External access through Ingress with TLS
- Network policies restrict traffic between pods

## Troubleshooting

### Common Issues

1. **Pod CrashLoopBackOff**
   ```bash
   # Check pod logs
   kubectl logs -f pod-name -n carbon-capture

   # Check events
   kubectl describe pod pod-name -n carbon-capture
   ```

2. **Service Unavailable**
   ```bash
   # Check service endpoints
   kubectl get endpoints -n carbon-capture

   # Check service configuration
   kubectl describe service service-name -n carbon-capture
   ```

3. **Persistent Volume Issues**
   ```bash
   # Check PVC status
   kubectl get pvc -n carbon-capture

   # Check PV status
   kubectl get pv
   ```

4. **Resource Constraints**
   ```bash
   # Check resource usage
   kubectl top pods -n carbon-capture

   # Check node resources
   kubectl top nodes
   ```

### Health Checks

Monitor service health:

```bash
# Check all pods
kubectl get pods -n carbon-capture

# Check deployments
kubectl get deployments -n carbon-capture

# Check ingress
kubectl get ingress -n carbon-capture
```

### Logs Collection

Centralized logging:

```bash
# View application logs
kubectl logs -f deployment/backend-deployment -n carbon-capture

# View system logs
kubectl logs -f deployment/logstash-deployment -n carbon-capture
```

## Maintenance

### Updates

1. **Rolling Updates**
   ```bash
   kubectl set image deployment/backend-deployment backend=carboncapture/backend:v2.0.0
   kubectl rollout status deployment/backend-deployment
   ```

2. **Rollback**
   ```bash
   kubectl rollout undo deployment/backend-deployment
   ```

### Certificate Management

Automatic certificate renewal with cert-manager:

```bash
# Check certificate status
kubectl get certificates -n carbon-capture

# Renew certificate manually
kubectl delete secret carbon-capture-tls
```

## Performance Optimization

### Resource Tuning

Adjust resource limits based on load:

```yaml
resources:
  requests:
    memory: "512Mi"
    cpu: "250m"
  limits:
    memory: "1Gi"
    cpu: "500m"
```

### Database Optimization

MongoDB configuration:

```yaml
env:
- name: MONGO_INITDB_ROOT_USERNAME
  valueFrom:
    secretKeyRef:
      name: carbon-capture-secrets
      key: MONGO_ROOT_USERNAME
command:
- mongod
- --wiredTigerCacheSizeGB=2
- --wiredTigerMaxCacheOverflowSizeGB=0.5
```

### Caching

Redis configuration for optimal performance:

```yaml
command:
- redis-server
- --maxmemory=512mb
- --maxmemory-policy=allkeys-lru
- --tcp-keepalive=300
```

## Support and Monitoring

### Alerting

Set up alerts for:
- Pod restarts > 3 in 5 minutes
- CPU usage > 80%
- Memory usage > 85%
- Disk usage > 90%
- Service unavailable > 5 minutes

### Metrics Collection

Key metrics to monitor:
- Application response time
- Error rates
- Database query performance
- AI model prediction latency
- IoT sensor data ingestion rate

## Cost Optimization

### Resource Rightsizing

Monitor actual usage and adjust requests/limits:

```bash
# Get resource usage
kubectl top pods -n carbon-capture

# Adjust based on actual usage
kubectl edit deployment backend-deployment
```

### Spot Instances

Use spot instances for non-critical workloads:

```yaml
spec:
  template:
    spec:
      tolerations:
      - key: "kubernetes.azure.com/scalesetpriority"
        operator: "Equal"
        value: "spot"
        effect: "NoSchedule"
```

### Auto-scaling

Configure cluster autoscaler for cost optimization:

```bash
# Enable cluster autoscaler
kubectl apply -f cluster-autoscaler.yaml
```

This deployment provides a production-ready, scalable, and secure environment for the Carbon Capture Network.

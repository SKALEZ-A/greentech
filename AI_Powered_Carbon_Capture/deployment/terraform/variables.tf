# Carbon Capture Network - Terraform Variables

variable "aws_region" {
  description = "AWS region for deployment"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  default     = "dev"

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod"
  }
}

variable "image_tag" {
  description = "Docker image tag to deploy"
  type        = string
  default     = "latest"
}

variable "ecr_repository_url" {
  description = "ECR repository URL for Docker images"
  type        = string
}

# Database Configuration
variable "mongodb_username" {
  description = "MongoDB/DocumentDB master username"
  type        = string
  sensitive   = true
}

variable "mongodb_password" {
  description = "MongoDB/DocumentDB master password"
  type        = string
  sensitive   = true
}

# Security Configuration
variable "jwt_secret" {
  description = "JWT secret key for API authentication"
  type        = string
  sensitive   = true
}

# Domain Configuration
variable "domain_name" {
  description = "Custom domain name for the application"
  type        = string
  default     = ""
}

variable "create_route53_zone" {
  description = "Whether to create Route53 hosted zone"
  type        = bool
  default     = false
}

# Instance Configuration
variable "backend_instance_count" {
  description = "Number of backend service instances"
  type        = number
  default     = 2

  validation {
    condition     = var.backend_instance_count >= 1 && var.backend_instance_count <= 10
    error_message = "Backend instance count must be between 1 and 10"
  }
}

variable "ai_engine_instance_count" {
  description = "Number of AI engine service instances"
  type        = number
  default     = 1

  validation {
    condition     = var.ai_engine_instance_count >= 1 && var.ai_engine_instance_count <= 5
    error_message = "AI engine instance count must be between 1 and 5"
  }
}

# Resource Configuration
variable "backend_cpu" {
  description = "CPU units for backend service (1024 = 1 vCPU)"
  type        = number
  default     = 512

  validation {
    condition     = contains([256, 512, 1024, 2048, 4096], var.backend_cpu)
    error_message = "Backend CPU must be one of: 256, 512, 1024, 2048, 4096"
  }
}

variable "backend_memory" {
  description = "Memory for backend service in MB"
  type        = number
  default     = 1024

  validation {
    condition     = var.backend_memory >= 512 && var.backend_memory <= 8192
    error_message = "Backend memory must be between 512 and 8192 MB"
  }
}

variable "ai_engine_cpu" {
  description = "CPU units for AI engine service (1024 = 1 vCPU)"
  type        = number
  default     = 1024

  validation {
    condition     = contains([512, 1024, 2048, 4096], var.ai_engine_cpu)
    error_message = "AI engine CPU must be one of: 512, 1024, 2048, 4096"
  }
}

variable "ai_engine_memory" {
  description = "Memory for AI engine service in MB"
  type        = number
  default     = 2048

  validation {
    condition     = var.ai_engine_memory >= 1024 && var.ai_engine_memory <= 8192
    error_message = "AI engine memory must be between 1024 and 8192 MB"
  }
}

# Networking Configuration
variable "vpc_cidr" {
  description = "CIDR block for VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "public_subnets" {
  description = "List of public subnet CIDRs"
  type        = list(string)
  default     = ["10.0.101.0/24", "10.0.102.0/24", "10.0.103.0/24"]
}

variable "private_subnets" {
  description = "List of private subnet CIDRs"
  type        = list(string)
  default     = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
}

variable "availability_zones" {
  description = "List of availability zones"
  type        = list(string)
  default     = []
}

# Monitoring Configuration
variable "enable_monitoring" {
  description = "Enable monitoring stack (Prometheus, Grafana)"
  type        = bool
  default     = true
}

variable "enable_logging" {
  description = "Enable centralized logging (ELK stack)"
  type        = bool
  default     = true
}

variable "log_retention_days" {
  description = "CloudWatch log retention period in days"
  type        = number
  default     = 30

  validation {
    condition     = contains([1, 3, 5, 7, 14, 30, 60, 90, 120, 150, 180, 365, 400, 545, 731, 1827, 3653], var.log_retention_days)
    error_message = "Log retention must be one of the valid CloudWatch values"
  }
}

# Backup Configuration
variable "enable_backups" {
  description = "Enable automated database backups"
  type        = bool
  default     = true
}

variable "backup_retention_days" {
  description = "Backup retention period in days"
  type        = number
  default     = 30

  validation {
    condition     = var.backup_retention_days >= 1 && var.backup_retention_days <= 365
    error_message = "Backup retention must be between 1 and 365 days"
  }
}

# Security Configuration
variable "enable_deletion_protection" {
  description = "Enable deletion protection for critical resources"
  type        = bool
  default     = true
}

variable "allowed_ip_ranges" {
  description = "List of allowed IP ranges for administrative access"
  type        = list(string)
  default     = []
}

# Cost Optimization
variable "enable_spot_instances" {
  description = "Use spot instances for cost optimization"
  type        = bool
  default     = false
}

variable "enable_autoscaling" {
  description = "Enable auto-scaling for services"
  type        = bool
  default     = true
}

# Tags
variable "tags" {
  description = "Additional tags for all resources"
  type        = map(string)
  default     = {}
}

# Feature Flags
variable "enable_blockchain" {
  description = "Enable blockchain integration for carbon credits"
  type        = bool
  default     = false
}

variable "enable_iot_simulation" {
  description = "Enable IoT simulation for development/testing"
  type        = bool
  default     = false
}

variable "enable_api_caching" {
  description = "Enable API response caching"
  type        = bool
  default     = true
}

variable "cache_ttl_seconds" {
  description = "Default cache TTL in seconds"
  type        = number
  default     = 300

  validation {
    condition     = var.cache_ttl_seconds >= 60 && var.cache_ttl_seconds <= 3600
    error_message = "Cache TTL must be between 60 and 3600 seconds"
  }
}

# Performance Tuning
variable "database_max_connections" {
  description = "Maximum database connections"
  type        = number
  default     = 100

  validation {
    condition     = var.database_max_connections >= 10 && var.database_max_connections <= 1000
    error_message = "Database max connections must be between 10 and 1000"
  }
}

variable "redis_max_memory" {
  description = "Redis max memory in GB"
  type        = number
  default     = 1

  validation {
    condition     = var.redis_max_memory >= 0.5 && var.redis_max_memory <= 10
    error_message = "Redis max memory must be between 0.5 and 10 GB"
  }
}

# Email Configuration
variable "smtp_host" {
  description = "SMTP server hostname"
  type        = string
  default     = ""
}

variable "smtp_port" {
  description = "SMTP server port"
  type        = number
  default     = 587
}

variable "smtp_username" {
  description = "SMTP authentication username"
  type        = string
  default     = ""
  sensitive   = true
}

variable "smtp_password" {
  description = "SMTP authentication password"
  type        = string
  default     = ""
  sensitive   = true
}

# External Service Integration
variable "ethereum_rpc_url" {
  description = "Ethereum RPC URL for blockchain integration"
  type        = string
  default     = ""
}

variable "carbon_credit_contract_address" {
  description = "Carbon credit smart contract address"
  type        = string
  default     = ""
}

variable "weather_api_key" {
  description = "Weather API key for ambient data"
  type        = string
  default     = ""
  sensitive   = true
}

variable "energy_api_key" {
  description = "Energy pricing API key"
  type        = string
  default     = ""
  sensitive   = true
}

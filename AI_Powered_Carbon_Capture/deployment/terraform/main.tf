# Carbon Capture Network Infrastructure as Code
# AWS Deployment Configuration

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  backend "s3" {
    bucket = "carbon-capture-terraform-state"
    key    = "carbon-capture-network/terraform.tfstate"
    region = "us-east-1"
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "Carbon Capture Network"
      Environment = var.environment
      ManagedBy   = "Terraform"
    }
  }
}

# VPC Configuration
module "vpc" {
  source = "terraform-aws-modules/vpc/aws"

  name = "carbon-capture-vpc"
  cidr = "10.0.0.0/16"

  azs             = ["${var.aws_region}a", "${var.aws_region}b", "${var.aws_region}c"]
  private_subnets = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
  public_subnets  = ["10.0.101.0/24", "10.0.102.0/24", "10.0.103.0/24"]

  enable_nat_gateway     = true
  single_nat_gateway     = true
  enable_dns_hostnames   = true
  enable_dns_support     = true

  tags = {
    Name = "carbon-capture-vpc"
  }
}

# Security Groups
resource "aws_security_group" "web" {
  name_prefix = "carbon-capture-web-"
  vpc_id      = module.vpc.vpc_id

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "HTTP"
  }

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "HTTPS"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "carbon-capture-web-sg"
  }
}

resource "aws_security_group" "api" {
  name_prefix = "carbon-capture-api-"
  vpc_id      = module.vpc.vpc_id

  ingress {
    from_port       = 3001
    to_port         = 3001
    protocol        = "tcp"
    security_groups = [aws_security_group.web.id]
    description     = "Backend API"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "carbon-capture-api-sg"
  }
}

resource "aws_security_group" "ai_engine" {
  name_prefix = "carbon-capture-ai-"
  vpc_id      = module.vpc.vpc_id

  ingress {
    from_port       = 8000
    to_port         = 8000
    protocol        = "tcp"
    security_groups = [aws_security_group.api.id]
    description     = "AI Engine API"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "carbon-capture-ai-sg"
  }
}

resource "aws_security_group" "database" {
  name_prefix = "carbon-capture-db-"
  vpc_id      = module.vpc.vpc_id

  ingress {
    from_port       = 27017
    to_port         = 27017
    protocol        = "tcp"
    security_groups = [aws_security_group.api.id, aws_security_group.ai_engine.id]
    description     = "MongoDB"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "carbon-capture-db-sg"
  }
}

resource "aws_security_group" "cache" {
  name_prefix = "carbon-capture-cache-"
  vpc_id      = module.vpc.vpc_id

  ingress {
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [aws_security_group.api.id, aws_security_group.ai_engine.id]
    description     = "Redis"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "carbon-capture-cache-sg"
  }
}

resource "aws_security_group" "monitoring" {
  name_prefix = "carbon-capture-monitoring-"
  vpc_id      = module.vpc.vpc_id

  ingress {
    from_port       = 9090
    to_port         = 9090
    protocol        = "tcp"
    security_groups = [aws_security_group.web.id]
    description     = "Prometheus"
  }

  ingress {
    from_port       = 3002
    to_port         = 3002
    protocol        = "tcp"
    security_groups = [aws_security_group.web.id]
    description     = "Grafana"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "carbon-capture-monitoring-sg"
  }
}

# MongoDB DocumentDB Cluster
resource "aws_docdb_cluster" "mongodb" {
  cluster_identifier     = "carbon-capture-${var.environment}"
  engine                 = "docdb"
  master_username        = var.mongodb_username
  master_password        = var.mongodb_password
  skip_final_snapshot    = true
  db_subnet_group_name   = aws_db_subnet_group.mongodb.name
  vpc_security_group_ids = [aws_security_group.database.id]

  tags = {
    Name = "carbon-capture-mongodb"
  }
}

resource "aws_docdb_cluster_instance" "mongodb" {
  count              = 2
  identifier         = "carbon-capture-${var.environment}-${count.index}"
  cluster_identifier = aws_docdb_cluster.mongodb.id
  instance_class     = "db.t3.medium"

  tags = {
    Name = "carbon-capture-mongodb-instance-${count.index}"
  }
}

resource "aws_db_subnet_group" "mongodb" {
  name       = "carbon-capture-mongodb-${var.environment}"
  subnet_ids = module.vpc.private_subnets

  tags = {
    Name = "carbon-capture-mongodb-subnet-group"
  }
}

# ElastiCache Redis Cluster
resource "aws_elasticache_cluster" "redis" {
  cluster_id           = "carbon-capture-${var.environment}"
  engine              = "redis"
  node_type           = "cache.t3.micro"
  num_cache_nodes     = 1
  parameter_group_name = "default.redis7"
  port                = 6379
  subnet_group_name   = aws_elasticache_subnet_group.redis.name
  security_group_ids  = [aws_security_group.cache.id]

  tags = {
    Name = "carbon-capture-redis"
  }
}

resource "aws_elasticache_subnet_group" "redis" {
  name       = "carbon-capture-redis-${var.environment}"
  subnet_ids = module.vpc.private_subnets

  tags = {
    Name = "carbon-capture-redis-subnet-group"
  }
}

# ECS Cluster
resource "aws_ecs_cluster" "main" {
  name = "carbon-capture-${var.environment}"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }

  tags = {
    Name = "carbon-capture-ecs-cluster"
  }
}

resource "aws_ecs_cluster_capacity_providers" "main" {
  cluster_name       = aws_ecs_cluster.main.name
  capacity_providers = ["FARGATE", "FARGATE_SPOT"]

  default_capacity_provider_strategy {
    base              = 1
    weight            = 100
    capacity_provider = "FARGATE"
  }
}

# ECS Task Definitions
resource "aws_ecs_task_definition" "backend" {
  family                   = "carbon-capture-backend-${var.environment}"
  requires_compatibilities = ["FARGATE"]
  network_mode            = "awsvpc"
  cpu                     = 512
  memory                  = 1024
  execution_role_arn      = aws_iam_role.ecs_execution.arn
  task_role_arn           = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([
    {
      name  = "backend"
      image = "${var.ecr_repository_url}/carbon-capture-backend:${var.image_tag}"

      environment = [
        {
          name  = "NODE_ENV"
          value = "production"
        },
        {
          name  = "MONGODB_URI"
          value = "mongodb://${var.mongodb_username}:${var.mongodb_password}@${aws_docdb_cluster.mongodb.endpoint}:27017/carbon_capture_prod"
        },
        {
          name  = "REDIS_URL"
          value = "redis://${aws_elasticache_cluster.redis.cache_nodes[0].address}:${aws_elasticache_cluster.redis.cache_nodes[0].port}"
        },
        {
          name  = "AI_ENGINE_URL"
          value = "http://ai-engine.carbon-capture.local:8000"
        },
        {
          name  = "JWT_SECRET"
          value = var.jwt_secret
        }
      ]

      secrets = [
        {
          name      = "DATABASE_PASSWORD"
          valueFrom = aws_secretsmanager_secret_version.mongodb_password.arn
        }
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.backend.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "ecs"
        }
      }

      healthCheck = {
        command = ["CMD-SHELL", "curl -f http://localhost:3001/api/v1/health || exit 1"]
        interval = 30
        timeout  = 5
        retries  = 3
      }
    }
  ])

  tags = {
    Name = "carbon-capture-backend-task"
  }
}

resource "aws_ecs_task_definition" "ai_engine" {
  family                   = "carbon-capture-ai-engine-${var.environment}"
  requires_compatibilities = ["FARGATE"]
  network_mode            = "awsvpc"
  cpu                     = 1024
  memory                  = 2048
  execution_role_arn      = aws_iam_role.ecs_execution.arn
  task_role_arn           = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([
    {
      name  = "ai-engine"
      image = "${var.ecr_repository_url}/carbon-capture-ai-engine:${var.image_tag}"

      environment = [
        {
          name  = "ENVIRONMENT"
          value = "production"
        },
        {
          name  = "REDIS_URL"
          value = "redis://${aws_elasticache_cluster.redis.cache_nodes[0].address}:${aws_elasticache_cluster.redis.cache_nodes[0].port}"
        }
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.ai_engine.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "ecs"
        }
      }

      healthCheck = {
        command = ["CMD-SHELL", "curl -f http://localhost:8000/health || exit 1"]
        interval = 60
        timeout  = 10
        retries  = 3
      }
    }
  ])

  tags = {
    Name = "carbon-capture-ai-engine-task"
  }
}

# ECS Services
resource "aws_ecs_service" "backend" {
  name            = "carbon-capture-backend-${var.environment}"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.backend.arn
  desired_count   = 2

  network_configuration {
    security_groups = [aws_security_group.api.id]
    subnets         = module.vpc.private_subnets
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.backend.arn
    container_name   = "backend"
    container_port   = 3001
  }

  depends_on = [aws_lb_listener.backend]
}

resource "aws_ecs_service" "ai_engine" {
  name            = "carbon-capture-ai-engine-${var.environment}"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.ai_engine.arn
  desired_count   = 1

  network_configuration {
    security_groups = [aws_security_group.ai_engine.id]
    subnets         = module.vpc.private_subnets
  }

  service_registries {
    registry_arn = aws_service_discovery_service.ai_engine.arn
  }
}

# Application Load Balancer
resource "aws_lb" "main" {
  name               = "carbon-capture-alb-${var.environment}"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.web.id]
  subnets            = module.vpc.public_subnets

  enable_deletion_protection = var.environment == "prod"

  tags = {
    Name = "carbon-capture-alb"
  }
}

resource "aws_lb_target_group" "frontend" {
  name        = "carbon-capture-frontend-${var.environment}"
  port        = 3000
  protocol    = "HTTP"
  vpc_id      = module.vpc.vpc_id
  target_type = "ip"

  health_check {
    enabled             = true
    path                = "/api/health"
    port                = "traffic-port"
    healthy_threshold   = 3
    unhealthy_threshold = 3
    timeout             = 5
    interval            = 30
  }

  tags = {
    Name = "carbon-capture-frontend-tg"
  }
}

resource "aws_lb_target_group" "backend" {
  name        = "carbon-capture-backend-${var.environment}"
  port        = 3001
  protocol    = "HTTP"
  vpc_id      = module.vpc.vpc_id
  target_type = "ip"

  health_check {
    enabled             = true
    path                = "/api/v1/health"
    port                = "traffic-port"
    healthy_threshold   = 3
    unhealthy_threshold = 3
    timeout             = 5
    interval            = 30
  }

  tags = {
    Name = "carbon-capture-backend-tg"
  }
}

resource "aws_lb_listener" "frontend" {
  load_balancer_arn = aws_lb.main.arn
  port              = "80"
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.frontend.arn
  }
}

resource "aws_lb_listener" "backend" {
  load_balancer_arn = aws_lb.main.arn
  port              = "81"
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.backend.arn
  }
}

# CloudFront Distribution
resource "aws_cloudfront_distribution" "main" {
  enabled             = true
  is_ipv6_enabled     = true
  default_root_object = "index.html"

  origin {
    domain_name = aws_lb.main.dns_name
    origin_id   = "carbon-capture-alb"

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "http-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  default_cache_behavior {
    allowed_methods  = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "carbon-capture-alb"

    forwarded_values {
      query_string = true
      headers      = ["*"]

      cookies {
        forward = "all"
      }
    }

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 3600
    max_ttl                = 86400
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }

  tags = {
    Name = "carbon-capture-cloudfront"
  }
}

# Service Discovery
resource "aws_service_discovery_private_dns_namespace" "main" {
  name        = "carbon-capture.local"
  vpc         = module.vpc.vpc_id
  description = "Private DNS namespace for Carbon Capture services"
}

resource "aws_service_discovery_service" "ai_engine" {
  name = "ai-engine"

  dns_config {
    namespace_id = aws_service_discovery_private_dns_namespace.main.id

    dns_records {
      ttl  = 10
      type = "A"
    }

    routing_policy = "MULTIVALUE"
  }

  health_check_custom_config {
    failure_threshold = 1
  }
}

# IAM Roles
resource "aws_iam_role" "ecs_execution" {
  name = "carbon-capture-ecs-execution-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
        Effect = "Allow"
      }
    ]
  })

  tags = {
    Name = "carbon-capture-ecs-execution-role"
  }
}

resource "aws_iam_role_policy_attachment" "ecs_execution" {
  role       = aws_iam_role.ecs_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role" "ecs_task" {
  name = "carbon-capture-ecs-task-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
        Effect = "Allow"
      }
    ]
  })

  tags = {
    Name = "carbon-capture-ecs-task-role"
  }
}

# CloudWatch Logs
resource "aws_cloudwatch_log_group" "backend" {
  name              = "/ecs/carbon-capture-backend-${var.environment}"
  retention_in_days = 30

  tags = {
    Name = "carbon-capture-backend-logs"
  }
}

resource "aws_cloudwatch_log_group" "ai_engine" {
  name              = "/ecs/carbon-capture-ai-engine-${var.environment}"
  retention_in_days = 30

  tags = {
    Name = "carbon-capture-ai-engine-logs"
  }
}

# Secrets Manager
resource "aws_secretsmanager_secret" "mongodb_password" {
  name = "carbon-capture/mongodb-${var.environment}"
  description = "MongoDB password for Carbon Capture application"

  tags = {
    Name = "carbon-capture-mongodb-secret"
  }
}

resource "aws_secretsmanager_secret_version" "mongodb_password" {
  secret_id     = aws_secretsmanager_secret.mongodb_password.id
  secret_string = var.mongodb_password
}

# S3 Bucket for Backups
resource "aws_s3_bucket" "backups" {
  bucket = "carbon-capture-backups-${var.environment}-${random_string.bucket_suffix.result}"

  tags = {
    Name = "carbon-capture-backups"
  }
}

resource "aws_s3_bucket_versioning" "backups" {
  bucket = aws_s3_bucket.backups.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "backups" {
  bucket = aws_s3_bucket.backups.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "random_string" "bucket_suffix" {
  length  = 8
  special = false
  upper   = false
}

# Route 53 (optional - if using custom domain)
resource "aws_route53_zone" "main" {
  count = var.create_route53_zone ? 1 : 0
  name  = var.domain_name

  tags = {
    Name = "carbon-capture-hosted-zone"
  }
}

resource "aws_route53_record" "cloudfront" {
  count   = var.create_route53_zone ? 1 : 0
  zone_id = aws_route53_zone.main[0].zone_id
  name    = var.domain_name
  type    = "A"

  alias {
    name                   = aws_cloudfront_distribution.main.domain_name
    zone_id                = aws_cloudfront_distribution.main.hosted_zone_id
    evaluate_target_health = false
  }
}

# Outputs
output "cloudfront_domain" {
  description = "CloudFront distribution domain name"
  value       = aws_cloudfront_distribution.main.domain_name
}

output "alb_dns_name" {
  description = "Application Load Balancer DNS name"
  value       = aws_lb.main.dns_name
}

output "mongodb_endpoint" {
  description = "MongoDB DocumentDB endpoint"
  value       = aws_docdb_cluster.mongodb.endpoint
}

output "redis_endpoint" {
  description = "Redis ElastiCache endpoint"
  value       = aws_elasticache_cluster.redis.cache_nodes[0].address
}

output "ecs_cluster_name" {
  description = "ECS cluster name"
  value       = aws_ecs_cluster.main.name
}

output "s3_backup_bucket" {
  description = "S3 bucket for backups"
  value       = aws_s3_bucket.backups.bucket
}

# Backup service for Carbon Capture Network
FROM python:3.11-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    mongodb-clients \
    postgresql-client \
    mysql-client \
    curl \
    gnupg \
    lsb-release \
    && rm -rf /var/lib/apt/lists/*

# Install AWS CLI for S3 backups
RUN curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip" && \
    unzip awscliv2.zip && \
    ./aws/install && \
    rm -rf aws awscliv2.zip

# Create non-root user
RUN groupadd -r backupuser && useradd -r -g backupuser backupuser

# Set work directory
WORKDIR /app

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY --chown=backupuser:backupuser . .

# Switch to non-root user
USER backupuser

# Create backup directories
RUN mkdir -p backups logs

# Default command
CMD ["python", "backup_service.py"]

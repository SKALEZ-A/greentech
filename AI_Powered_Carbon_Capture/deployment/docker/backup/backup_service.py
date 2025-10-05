#!/usr/bin/env python3
"""
Backup Service for Carbon Capture Network

Provides automated backup functionality for:
- MongoDB databases
- Redis data
- Configuration files
- Logs
- AI models
"""

import os
import sys
import json
import logging
import subprocess
import shutil
from datetime import datetime, timedelta
from pathlib import Path
import boto3
from botocore.exceptions import ClientError

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('/app/logs/backup.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class BackupService:
    """Main backup service class."""

    def __init__(self):
        self.config = self._load_config()
        self.s3_client = self._init_s3_client()

    def _load_config(self):
        """Load backup configuration."""
        return {
            'mongodb_uri': os.getenv('MONGODB_URI', 'mongodb://localhost:27017'),
            'redis_host': os.getenv('REDIS_HOST', 'redis'),
            'redis_port': int(os.getenv('REDIS_PORT', '6379')),
            'backup_schedule': os.getenv('BACKUP_SCHEDULE', '0 2 * * *'),  # Daily at 2 AM
            'retention_days': int(os.getenv('RETENTION_DAYS', '30')),
            's3_bucket': os.getenv('S3_BUCKET'),
            'aws_access_key': os.getenv('AWS_ACCESS_KEY_ID'),
            'aws_secret_key': os.getenv('AWS_SECRET_ACCESS_KEY'),
            'aws_region': os.getenv('AWS_REGION', 'us-east-1'),
            'local_backup_dir': Path('/app/backups'),
            'max_backup_size_gb': int(os.getenv('MAX_BACKUP_SIZE_GB', '10'))
        }

    def _init_s3_client(self):
        """Initialize S3 client for cloud storage."""
        if all([self.config['aws_access_key'], self.config['aws_secret_key']]):
            return boto3.client(
                's3',
                aws_access_key_id=self.config['aws_access_key'],
                aws_secret_access_key=self.config['aws_secret_key'],
                region_name=self.config['aws_region']
            )
        return None

    def create_backup(self, backup_type='full'):
        """
        Create a backup of all systems.

        Args:
            backup_type: Type of backup ('full', 'incremental', 'config_only')
        """
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        backup_dir = self.config['local_backup_dir'] / f"backup_{timestamp}"

        try:
            # Create backup directory
            backup_dir.mkdir(parents=True, exist_ok=True)
            logger.info(f"Starting {backup_type} backup to {backup_dir}")

            # Backup MongoDB
            if backup_type in ['full', 'incremental']:
                self._backup_mongodb(backup_dir)

            # Backup Redis
            if backup_type in ['full', 'incremental']:
                self._backup_redis(backup_dir)

            # Backup configuration files
            self._backup_configs(backup_dir)

            # Backup AI models (if available)
            if backup_type == 'full':
                self._backup_ai_models(backup_dir)

            # Compress backup
            archive_path = self._compress_backup(backup_dir)

            # Upload to S3
            if self.s3_client and self.config['s3_bucket']:
                self._upload_to_s3(archive_path)

            # Cleanup old backups
            self._cleanup_old_backups()

            logger.info(f"Backup completed successfully: {archive_path}")

        except Exception as e:
            logger.error(f"Backup failed: {e}")
            # Cleanup failed backup
            if backup_dir.exists():
                shutil.rmtree(backup_dir)
            raise

    def _backup_mongodb(self, backup_dir):
        """Backup MongoDB database."""
        logger.info("Backing up MongoDB...")

        mongodb_dir = backup_dir / "mongodb"
        mongodb_dir.mkdir(exist_ok=True)

        # Use mongodump for backup
        cmd = [
            'mongodump',
            '--uri', self.config['mongodb_uri'],
            '--out', str(mongodb_dir),
            '--gzip'
        ]

        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode != 0:
            logger.error(f"MongoDB backup failed: {result.stderr}")
            raise Exception("MongoDB backup failed")

        logger.info("MongoDB backup completed")

    def _backup_redis(self, backup_dir):
        """Backup Redis data."""
        logger.info("Backing up Redis...")

        redis_dir = backup_dir / "redis"
        redis_dir.mkdir(exist_ok=True)

        # Save Redis RDB file
        import redis
        r = redis.Redis(host=self.config['redis_host'], port=self.config['redis_port'])

        # Trigger SAVE command
        r.save()

        # Copy RDB file (assuming default location)
        rdb_path = Path('/data/dump.rdb')
        if rdb_path.exists():
            shutil.copy(rdb_path, redis_dir / 'dump.rdb')

        logger.info("Redis backup completed")

    def _backup_configs(self, backup_dir):
        """Backup configuration files."""
        logger.info("Backing up configuration files...")

        config_dir = backup_dir / "configs"
        config_dir.mkdir(exist_ok=True)

        # Common config locations to backup
        config_paths = [
            '/app/config',
            '/etc/nginx',
            '/etc/mosquitto',
            '/etc/prometheus',
            '/etc/grafana'
        ]

        for path in config_paths:
            if Path(path).exists():
                dest = config_dir / Path(path).name
                if Path(path).is_file():
                    shutil.copy(path, dest)
                else:
                    shutil.copytree(path, dest, dirs_exist_ok=True)

        logger.info("Configuration backup completed")

    def _backup_ai_models(self, backup_dir):
        """Backup AI models."""
        logger.info("Backing up AI models...")

        models_dir = backup_dir / "ai_models"
        models_dir.mkdir(exist_ok=True)

        # Copy AI models directory
        source_models = Path('/app/models')
        if source_models.exists():
            shutil.copytree(source_models, models_dir / 'models', dirs_exist_ok=True)

        logger.info("AI models backup completed")

    def _compress_backup(self, backup_dir):
        """Compress backup directory."""
        logger.info("Compressing backup...")

        archive_name = f"{backup_dir.name}.tar.gz"
        archive_path = backup_dir.parent / archive_name

        import tarfile
        with tarfile.open(archive_path, "w:gz") as tar:
            tar.add(backup_dir, arcname=backup_dir.name)

        # Remove uncompressed backup
        shutil.rmtree(backup_dir)

        # Check size
        size_gb = archive_path.stat().st_size / (1024**3)
        if size_gb > self.config['max_backup_size_gb']:
            logger.warning(f"Backup size ({size_gb:.2f}GB) exceeds limit ({self.config['max_backup_size_gb']}GB)")

        logger.info(f"Backup compressed: {archive_path} ({size_gb:.2f}GB)")
        return archive_path

    def _upload_to_s3(self, archive_path):
        """Upload backup to S3."""
        if not self.s3_client:
            logger.warning("S3 client not configured, skipping upload")
            return

        try:
            bucket = self.config['s3_bucket']
            key = f"backups/{archive_path.name}"

            logger.info(f"Uploading {archive_path} to s3://{bucket}/{key}")

            self.s3_client.upload_file(str(archive_path), bucket, key)

            # Set lifecycle policy for automatic deletion
            self._set_s3_lifecycle(bucket, key)

            logger.info("S3 upload completed")

        except ClientError as e:
            logger.error(f"S3 upload failed: {e}")
            raise

    def _set_s3_lifecycle(self, bucket, key):
        """Set lifecycle policy for backup files."""
        # This would typically be set at bucket level, but here's how to tag individual objects
        try:
            expiration_date = datetime.now() + timedelta(days=self.config['retention_days'])
            self.s3_client.put_object_tagging(
                Bucket=bucket,
                Key=key,
                Tagging={
                    'TagSet': [
                        {
                            'Key': 'ExpirationDate',
                            'Value': expiration_date.strftime('%Y-%m-%d')
                        },
                        {
                            'Key': 'BackupType',
                            'Value': 'automated'
                        }
                    ]
                }
            )
        except Exception as e:
            logger.warning(f"Failed to set lifecycle tags: {e}")

    def _cleanup_old_backups(self):
        """Clean up old backup files."""
        logger.info("Cleaning up old backups...")

        # Local cleanup
        cutoff_date = datetime.now() - timedelta(days=self.config['retention_days'])

        for backup_file in self.config['local_backup_dir'].glob("*.tar.gz"):
            if backup_file.stat().st_mtime < cutoff_date.timestamp():
                backup_file.unlink()
                logger.info(f"Removed old local backup: {backup_file}")

        # S3 cleanup (if configured)
        if self.s3_client and self.config['s3_bucket']:
            self._cleanup_s3_backups()

    def _cleanup_s3_backups(self):
        """Clean up old backups from S3."""
        try:
            bucket = self.config['s3_bucket']
            cutoff_date = datetime.now() - timedelta(days=self.config['retention_days'])

            # List backup objects
            response = self.s3_client.list_objects_v2(
                Bucket=bucket,
                Prefix='backups/'
            )

            if 'Contents' in response:
                for obj in response['Contents']:
                    # Check if older than retention period
                    if obj['LastModified'].replace(tzinfo=None) < cutoff_date:
                        self.s3_client.delete_object(Bucket=bucket, Key=obj['Key'])
                        logger.info(f"Removed old S3 backup: s3://{bucket}/{obj['Key']}")

        except Exception as e:
            logger.error(f"S3 cleanup failed: {e}")

    def restore_backup(self, backup_name, target_type='all'):
        """
        Restore from backup.

        Args:
            backup_name: Name of backup to restore
            target_type: What to restore ('all', 'mongodb', 'redis', 'configs')
        """
        logger.info(f"Starting restore from backup: {backup_name}")

        # Find backup file
        backup_path = self.config['local_backup_dir'] / f"{backup_name}.tar.gz"

        if not backup_path.exists() and self.s3_client:
            # Try downloading from S3
            backup_path = self._download_from_s3(backup_name)

        if not backup_path.exists():
            raise FileNotFoundError(f"Backup not found: {backup_name}")

        # Extract backup
        extract_dir = self.config['local_backup_dir'] / f"restore_{backup_name}"
        extract_dir.mkdir(exist_ok=True)

        import tarfile
        with tarfile.open(backup_path, "r:gz") as tar:
            tar.extractall(extract_dir)

        try:
            # Restore based on type
            if target_type in ['all', 'mongodb']:
                self._restore_mongodb(extract_dir / "mongodb")

            if target_type in ['all', 'redis']:
                self._restore_redis(extract_dir / "redis")

            if target_type in ['all', 'configs']:
                self._restore_configs(extract_dir / "configs")

            logger.info("Restore completed successfully")

        finally:
            # Cleanup
            shutil.rmtree(extract_dir)

    def _download_from_s3(self, backup_name):
        """Download backup from S3."""
        local_path = self.config['local_backup_dir'] / f"{backup_name}.tar.gz"

        self.s3_client.download_file(
            self.config['s3_bucket'],
            f"backups/{backup_name}.tar.gz",
            str(local_path)
        )

        return local_path

    def _restore_mongodb(self, mongodb_backup_dir):
        """Restore MongoDB from backup."""
        logger.info("Restoring MongoDB...")

        if not mongodb_backup_dir.exists():
            logger.warning("MongoDB backup not found, skipping")
            return

        # Use mongorestore
        cmd = [
            'mongorestore',
            '--uri', self.config['mongodb_uri'],
            '--gzip',
            '--drop',  # Drop existing collections
            str(mongodb_backup_dir)
        ]

        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode != 0:
            logger.error(f"MongoDB restore failed: {result.stderr}")
            raise Exception("MongoDB restore failed")

        logger.info("MongoDB restore completed")

    def _restore_redis(self, redis_backup_dir):
        """Restore Redis from backup."""
        logger.info("Restoring Redis...")

        rdb_file = redis_backup_dir / 'dump.rdb'
        if not rdb_file.exists():
            logger.warning("Redis backup not found, skipping")
            return

        # Copy RDB file to Redis data directory
        shutil.copy(rdb_file, '/data/dump.rdb')

        logger.info("Redis restore completed (restart Redis to load)")

    def _restore_configs(self, config_backup_dir):
        """Restore configuration files."""
        logger.info("Restoring configuration files...")

        if not config_backup_dir.exists():
            logger.warning("Config backup not found, skipping")
            return

        # This would typically require manual intervention or specific restore scripts
        logger.info("Configuration files extracted to restore directory")

    def list_backups(self):
        """List available backups."""
        backups = []

        # Local backups
        for backup_file in self.config['local_backup_dir'].glob("*.tar.gz"):
            backups.append({
                'name': backup_file.stem,
                'path': str(backup_file),
                'size': backup_file.stat().st_size,
                'created': datetime.fromtimestamp(backup_file.stat().st_mtime),
                'location': 'local'
            })

        # S3 backups
        if self.s3_client and self.config['s3_bucket']:
            try:
                response = self.s3_client.list_objects_v2(
                    Bucket=self.config['s3_bucket'],
                    Prefix='backups/'
                )

                if 'Contents' in response:
                    for obj in response['Contents']:
                        backups.append({
                            'name': Path(obj['Key']).stem,
                            'path': obj['Key'],
                            'size': obj['Size'],
                            'created': obj['LastModified'],
                            'location': 's3'
                        })
            except Exception as e:
                logger.error(f"Failed to list S3 backups: {e}")

        return sorted(backups, key=lambda x: x['created'], reverse=True)

    def get_backup_status(self):
        """Get backup service status."""
        return {
            'config': self.config,
            'available_backups': len(self.list_backups()),
            'last_backup': None,  # Would need to track this
            'storage_used': sum(
                f.stat().st_size for f in self.config['local_backup_dir'].glob("*.tar.gz")
            ),
            's3_configured': self.s3_client is not None
        }


def main():
    """Main function."""
    import argparse

    parser = argparse.ArgumentParser(description='Carbon Capture Backup Service')
    parser.add_argument('command', choices=['backup', 'restore', 'list', 'status'])
    parser.add_argument('--type', choices=['full', 'incremental', 'config_only'], default='full')
    parser.add_argument('--name', help='Backup name for restore')
    parser.add_argument('--target', choices=['all', 'mongodb', 'redis', 'configs'], default='all')

    args = parser.parse_args()

    service = BackupService()

    try:
        if args.command == 'backup':
            service.create_backup(args.type)
        elif args.command == 'restore':
            if not args.name:
                parser.error("--name required for restore")
            service.restore_backup(args.name, args.target)
        elif args.command == 'list':
            backups = service.list_backups()
            print("Available backups:")
            for backup in backups:
                print(f"  {backup['name']} - {backup['created']} - {backup['location']}")
        elif args.command == 'status':
            status = service.get_backup_status()
            print(json.dumps(status, indent=2, default=str))

    except Exception as e:
        logger.error(f"Command failed: {e}")
        sys.exit(1)


if __name__ == '__main__':
    main()

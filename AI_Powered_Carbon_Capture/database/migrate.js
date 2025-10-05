/**
 * Database Migration Runner
 * Manages database schema migrations for the carbon capture platform
 */

const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');

class MigrationRunner {
  constructor(connectionString, migrationsPath = './migrations') {
    this.connectionString = connectionString;
    this.migrationsPath = migrationsPath;
    this.client = null;
    this.db = null;
  }

  async connect() {
    try {
      this.client = new MongoClient(this.connectionString);
      await this.client.connect();
      this.db = this.client.db();

      // Create migrations collection if it doesn't exist
      await this.db.createCollection('migrations').catch(() => {});
      await this.db.collection('migrations').createIndex({ version: 1 }, { unique: true });

      console.log('Connected to MongoDB');
    } catch (error) {
      console.error('Failed to connect to MongoDB:', error);
      throw error;
    }
  }

  async disconnect() {
    if (this.client) {
      await this.client.close();
      console.log('Disconnected from MongoDB');
    }
  }

  async getAppliedMigrations() {
    const migrations = await this.db.collection('migrations').find({}).toArray();
    return migrations.sort((a, b) => a.version - b.version);
  }

  async getAvailableMigrations() {
    const migrationFiles = fs.readdirSync(this.migrationsPath)
      .filter(file => file.endsWith('.js'))
      .sort();

    const migrations = [];
    for (const file of migrationFiles) {
      const migrationPath = path.join(this.migrationsPath, file);
      const migration = require(migrationPath);

      migrations.push({
        version: migration.version,
        name: migration.name,
        file: file,
        migration: migration
      });
    }

    return migrations.sort((a, b) => a.version - b.version);
  }

  async runMigrations(direction = 'up', targetVersion = null) {
    const appliedMigrations = await this.getAppliedMigrations();
    const availableMigrations = await this.getAvailableMigrations();

    const appliedVersions = new Set(appliedMigrations.map(m => m.version));

    let migrationsToRun = [];

    if (direction === 'up') {
      // Find migrations that haven't been applied yet
      migrationsToRun = availableMigrations.filter(m => !appliedVersions.has(m.version));

      // Sort by version
      migrationsToRun.sort((a, b) => a.version - b.version);

      // If target version specified, only run up to that version
      if (targetVersion) {
        migrationsToRun = migrationsToRun.filter(m => m.version <= targetVersion);
      }
    } else if (direction === 'down') {
      // Find migrations that have been applied
      const appliedMigrationsSorted = appliedMigrations.sort((a, b) => b.version - a.version);

      if (targetVersion) {
        // Rollback to specific version (rollback migrations newer than target)
        migrationsToRun = appliedMigrationsSorted.filter(m => m.version > targetVersion);
      } else {
        // Rollback one migration
        migrationsToRun = appliedMigrationsSorted.slice(0, 1);
      }
    }

    if (migrationsToRun.length === 0) {
      console.log('No migrations to run');
      return;
    }

    console.log(`Running ${migrationsToRun.length} migration(s) ${direction}...`);

    for (const migrationInfo of migrationsToRun) {
      try {
        console.log(`Running migration ${migrationInfo.version}: ${migrationInfo.name}`);

        const startTime = Date.now();

        if (direction === 'up') {
          await migrationInfo.migration.up(this.db);
        } else {
          await migrationInfo.migration.down(this.db);
        }

        const duration = Date.now() - startTime;

        if (direction === 'up') {
          // Record migration as applied
          await this.db.collection('migrations').insertOne({
            version: migrationInfo.version,
            name: migrationInfo.name,
            appliedAt: new Date(),
            direction: 'up',
            duration: duration
          });
        } else {
          // Remove migration record
          await this.db.collection('migrations').deleteOne({ version: migrationInfo.version });
        }

        console.log(`✓ Migration ${migrationInfo.version} completed in ${duration}ms`);

      } catch (error) {
        console.error(`✗ Migration ${migrationInfo.version} failed:`, error);
        throw error;
      }
    }

    console.log(`Successfully completed ${migrationsToRun.length} migration(s)`);
  }

  async getStatus() {
    const appliedMigrations = await this.getAppliedMigrations();
    const availableMigrations = await this.getAvailableMigrations();

    console.log('\nMigration Status:');
    console.log('================');

    const maxVersion = Math.max(
      ...appliedMigrations.map(m => m.version),
      ...availableMigrations.map(m => m.version)
    );

    for (let version = 1; version <= maxVersion; version++) {
      const applied = appliedMigrations.find(m => m.version === version);
      const available = availableMigrations.find(m => m.version === version);

      if (applied) {
        console.log(`✓ ${version.toString().padStart(3)}: ${applied.name} (applied ${applied.appliedAt.toISOString()})`);
      } else if (available) {
        console.log(`○ ${version.toString().padStart(3)}: ${available.name} (pending)`);
      }
    }

    console.log(`\nTotal: ${appliedMigrations.length} applied, ${availableMigrations.length - appliedMigrations.length} pending`);
  }

  async createMigration(name) {
    const migrations = await this.getAvailableMigrations();
    const nextVersion = migrations.length > 0 ? Math.max(...migrations.map(m => m.version)) + 1 : 1;

    const filename = `${nextVersion.toString().padStart(3, '0')}_${name.replace(/\s+/g, '_').toLowerCase()}.js`;
    const filePath = path.join(this.migrationsPath, filename);

    const template = `/**
 * ${name} migration
 */

const migration = {
  version: ${nextVersion},
  name: '${name.toLowerCase().replace(/\s+/g, '_')}',

  async up(db) {
    console.log('Running ${name} migration...');

    // Add your migration logic here

    console.log('${name} migration completed');
  },

  async down(db) {
    console.log('Rolling back ${name} migration...');

    // Add your rollback logic here

    console.log('${name} migration rollback completed');
  }
};

module.exports = migration;
`;

    fs.writeFileSync(filePath, template);
    console.log(`Created migration file: ${filename}`);
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('Usage: node migrate.js <command> [options]');
    console.log('');
    console.log('Commands:');
    console.log('  up [version]          Run pending migrations (optionally up to specific version)');
    console.log('  down [version]        Rollback migrations (optionally to specific version)');
    console.log('  status                Show migration status');
    console.log('  create <name>         Create a new migration file');
    console.log('');
    console.log('Environment variables:');
    console.log('  MONGODB_URI          MongoDB connection string (default: mongodb://localhost:27017/carbon_capture)');
    process.exit(1);
  }

  const command = args[0];
  const connectionString = process.env.MONGODB_URI || 'mongodb://localhost:27017/carbon_capture';

  const runner = new MigrationRunner(connectionString);

  try {
    await runner.connect();

    switch (command) {
      case 'up':
        const targetVersion = args[1] ? parseInt(args[1]) : null;
        await runner.runMigrations('up', targetVersion);
        break;

      case 'down':
        const rollbackVersion = args[1] ? parseInt(args[1]) : null;
        await runner.runMigrations('down', rollbackVersion);
        break;

      case 'status':
        await runner.getStatus();
        break;

      case 'create':
        if (!args[1]) {
          console.error('Migration name required');
          process.exit(1);
        }
        await runner.createMigration(args[1]);
        break;

      default:
        console.error(`Unknown command: ${command}`);
        process.exit(1);
    }

  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await runner.disconnect();
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = MigrationRunner;

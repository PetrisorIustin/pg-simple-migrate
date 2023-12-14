import fs from 'fs/promises';
import path from 'path';
import { Pool, PoolClient, PoolConfig } from 'pg';

export type MigrationOptions = {
  config: PoolConfig | undefined;
  migrationFolder: string;
  schema?: string; // Make schema optional
};

export const migrate = async (options: MigrationOptions) => {
  if (!options.config) {
    throw new Error('No config provided');
  }

  const schema = options.schema || 'simple_migrate'; // Use 'simple_migrate' as the default schema

  const pool = new Pool(options.config);

  let client: PoolClient | undefined = undefined;

  try {
    client = await pool.connect();
    // Create the specified schema if it doesn't exist
    if (schema) {
      await client.query(`CREATE SCHEMA IF NOT EXISTS ${schema}`);
    }

    // Create migrations table in the specified schema if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS ${schema}.migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        timestamp TIMESTAMP DEFAULT NOW()
      );
    `);

    const migrationFiles = await fs.readdir(options.migrationFolder);

    for (const file of migrationFiles) {
      const filePath = path.join(options.migrationFolder, file);
      const migrationQuery = await fs.readFile(filePath, 'utf8');

      // Check if the migration has been run
      const result = await client.query(
        `SELECT id FROM ${schema}.migrations WHERE name = $1`,
        [file]
      );

      if (result.rows.length === 0) {
        console.log(`Running migration within transaction: ${file}`);

        // Begin a new transaction
        await client.query('BEGIN');

        try {
          // Execute the migration
          await client.query(migrationQuery);

          // Record the migration in the migrations table
          await client.query(
            `INSERT INTO ${schema}.migrations (name) VALUES ($1)`,
            [file]
          );

          // Commit the transaction if everything is successful
          await client.query('COMMIT');

          console.log(`Migration completed successfully: ${file}`);
        } catch (migrationError) {
          // Rollback the transaction in case of an error
          await client.query('ROLLBACK');
          console.error(`Error executing migration: ${file}`, migrationError);
        }
      } else {
        console.log(`Skipping already run migration: ${file}`);
      }
    }

    console.log('All migrations completed successfully.');
  } catch (error) {
    console.error('Error running migrations:', error);
  } finally {
    if (client) {
      client.release();
    }
    await pool.end();
  }
};

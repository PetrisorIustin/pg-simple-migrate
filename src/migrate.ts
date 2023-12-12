// migrate.ts

import fs from 'fs/promises';
import path from 'path';
import { Client, ClientConfig } from 'pg';


export type MigrationOptions = {
  config: string | ClientConfig | undefined;
  migrationFolder: string;
}

export const migrate = async (options: MigrationOptions) => {
  if (!options.config) {
    throw new Error('No config provided');
  }

  const client = new Client(options.config);
  try {
    await client.connect();
  } catch (error) {
    console.error('Error connecting to database:', error);
    return;
  }
  
  try {
    // Create migrations table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS migrations (
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
      const result = await client.query('SELECT id FROM migrations WHERE name = $1', [file]);

      if (result.rows.length === 0) {
        console.log(`Running migration: ${file}`);
        await client.query(migrationQuery);

        // Record the migration in the migrations table
        await client.query('INSERT INTO migrations (name) VALUES ($1)', [file]);
      } else {
        console.log(`Skipping already run migration: ${file}`);
      }
    }

    console.log('Migrations completed successfully.');
  } catch (error) {
    console.error('Error running migrations:', error);
  } finally {
    await client.end();
  }
}
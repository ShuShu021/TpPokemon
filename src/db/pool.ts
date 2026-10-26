import { Pool, PoolClient } from "pg";

export type QueryExecutor = Pool | PoolClient;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

export async function initializeDatabase(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS attacks (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL UNIQUE,
      damage INTEGER NOT NULL CHECK (damage > 0),
      usage_limit INTEGER NOT NULL CHECK (usage_limit > 0)
    );

    CREATE TABLE IF NOT EXISTS pokemon (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      life_point INTEGER NOT NULL CHECK (life_point >= 0),
      max_life_point INTEGER NOT NULL CHECK (max_life_point > 0),
      CHECK (life_point <= max_life_point)
    );

    CREATE TABLE IF NOT EXISTS pokemon_attacks (
      pokemon_id INTEGER NOT NULL REFERENCES pokemon(id) ON DELETE CASCADE,
      attack_id INTEGER NOT NULL REFERENCES attacks(id) ON DELETE RESTRICT,
      position INTEGER NOT NULL CHECK (position BETWEEN 0 AND 3),
      usage_count INTEGER NOT NULL DEFAULT 0 CHECK (usage_count >= 0),
      PRIMARY KEY (pokemon_id, attack_id),
      UNIQUE (pokemon_id, position)
    );

    CREATE TABLE IF NOT EXISTS trainers (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      level INTEGER NOT NULL DEFAULT 1 CHECK (level >= 1),
      experience INTEGER NOT NULL DEFAULT 0 CHECK (experience BETWEEN 0 AND 9)
    );

    CREATE TABLE IF NOT EXISTS trainer_pokemon (
      trainer_id INTEGER NOT NULL REFERENCES trainers(id) ON DELETE CASCADE,
      pokemon_id INTEGER NOT NULL REFERENCES pokemon(id) ON DELETE CASCADE,
      position INTEGER NOT NULL CHECK (position >= 0),
      PRIMARY KEY (trainer_id, pokemon_id),
      UNIQUE (pokemon_id),
      UNIQUE (trainer_id, position)
    );
  `);
}

export async function inTransaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

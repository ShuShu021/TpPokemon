import "dotenv/config";
import app from "./app";
import { initializeDatabase, pool } from "./db/pool";

const port = Number(process.env.PORT ?? 3000);

async function start(): Promise<void> {
  await initializeDatabase();
  app.listen(port, () => {
    console.log(`API Pokémon démarrée sur le port ${port}.`);
  });
}

void start().catch(async (error: unknown) => {
  console.error("Impossible de démarrer l'API.", error);
  await pool.end();
  process.exitCode = 1;
});

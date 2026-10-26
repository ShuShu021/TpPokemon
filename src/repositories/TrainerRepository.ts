import { QueryResultRow } from "pg";
import { Trainer } from "../domain/Trainer";
import { pool, QueryExecutor } from "../db/pool";
import { PokemonRepository } from "./PokemonRepository";

interface TrainerRow extends QueryResultRow {
  id: number;
  name: string;
  level: number;
  experience: number;
}

interface TrainerPokemonRow extends QueryResultRow {
  pokemon_id: number;
}

export class TrainerRepository {
  constructor(private readonly pokemonRepository = new PokemonRepository()) {}

  async findById(id: number, executor: QueryExecutor = pool, forUpdate = false): Promise<Trainer | null> {
    const lockClause = forUpdate ? " FOR UPDATE" : "";
    const { rows } = await executor.query<TrainerRow>(
      `SELECT * FROM trainers WHERE id = $1${lockClause}`,
      [id]
    );
    if (!rows[0]) return null;

    const relations = await executor.query<TrainerPokemonRow>(
      "SELECT pokemon_id FROM trainer_pokemon WHERE trainer_id = $1 ORDER BY position",
      [id]
    );
    const pokemons = [];
    for (const relation of relations.rows) {
      const pokemon = await this.pokemonRepository.findById(relation.pokemon_id, executor, forUpdate);
      if (pokemon) pokemons.push(pokemon);
    }
    return new Trainer({
      id: rows[0].id,
      name: rows[0].name,
      level: rows[0].level,
      experience: rows[0].experience,
      pokemons
    });
  }

  async findAll(executor: QueryExecutor = pool): Promise<Trainer[]> {
    const { rows } = await executor.query<TrainerRow>("SELECT * FROM trainers ORDER BY id");
    const trainers: Trainer[] = [];
    for (const row of rows) {
      const trainer = await this.findById(row.id, executor);
      if (trainer) trainers.push(trainer);
    }
    return trainers;
  }

  async create(name: string, executor: QueryExecutor = pool): Promise<Trainer> {
    const { rows } = await executor.query<TrainerRow>(
      "INSERT INTO trainers (name) VALUES ($1) RETURNING *",
      [name]
    );
    return new Trainer({ id: rows[0].id, name: rows[0].name });
  }

  async rename(id: number, name: string): Promise<Trainer | null> {
    const { rowCount } = await pool.query("UPDATE trainers SET name = $1 WHERE id = $2", [name, id]);
    return rowCount === 1 ? this.findById(id) : null;
  }

  async save(trainer: Trainer, executor: QueryExecutor): Promise<void> {
    if (trainer.id === undefined) throw new Error("Impossible de sauvegarder un dresseur sans identifiant.");
    await executor.query(
      "UPDATE trainers SET name = $1, level = $2, experience = $3 WHERE id = $4",
      [trainer.name, trainer.level, trainer.experience, trainer.id]
    );
    for (const [position, pokemon] of trainer.pokemons.entries()) {
      if (pokemon.id === undefined) continue;
      await executor.query(
        `INSERT INTO trainer_pokemon (trainer_id, pokemon_id, position)
         VALUES ($1, $2, $3)
         ON CONFLICT (trainer_id, pokemon_id) DO UPDATE SET position = EXCLUDED.position`,
        [trainer.id, pokemon.id, position]
      );
      await this.pokemonRepository.save(pokemon, executor);
    }
  }

  async addPokemon(trainer: Trainer, pokemonId: number, executor: QueryExecutor): Promise<void> {
    if (trainer.id === undefined) throw new Error("Le dresseur doit être enregistré.");
    await executor.query(
      "INSERT INTO trainer_pokemon (trainer_id, pokemon_id, position) VALUES ($1, $2, $3)",
      [trainer.id, pokemonId, trainer.pokemons.length]
    );
  }

  async delete(id: number): Promise<boolean> {
    const { rowCount } = await pool.query("DELETE FROM trainers WHERE id = $1", [id]);
    return rowCount === 1;
  }
}

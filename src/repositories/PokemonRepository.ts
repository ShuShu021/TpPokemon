import { QueryResultRow } from "pg";
import { Attack } from "../domain/Attack";
import { Pokemon } from "../domain/Pokemon";
import { pool, QueryExecutor } from "../db/pool";
import { AttackRepository } from "./AttackRepository";

interface PokemonRow extends QueryResultRow {
  id: number;
  name: string;
  life_point: number;
  max_life_point: number;
}

interface PokemonAttackRow extends QueryResultRow {
  id: number;
  name: string;
  damage: number;
  usage_limit: number;
  usage_count: number;
}

export class PokemonRepository {
  constructor(private readonly attacks = new AttackRepository()) {}

  async findAll(executor: QueryExecutor = pool): Promise<Pokemon[]> {
    const { rows } = await executor.query<PokemonRow>("SELECT * FROM pokemon ORDER BY id");
    const pokemon: Pokemon[] = [];
    for (const row of rows) pokemon.push(await this.hydrate(row, executor));
    return pokemon;
  }

  async findById(id: number, executor: QueryExecutor = pool, forUpdate = false): Promise<Pokemon | null> {
    const lockClause = forUpdate ? " FOR UPDATE" : "";
    const { rows } = await executor.query<PokemonRow>(
      `SELECT * FROM pokemon WHERE id = $1${lockClause}`,
      [id]
    );
    return rows[0] ? this.hydrate(rows[0], executor) : null;
  }

  async create(name: string, lifePoint: number, executor: QueryExecutor = pool): Promise<Pokemon> {
    const { rows } = await executor.query<PokemonRow>(
      "INSERT INTO pokemon (name, life_point, max_life_point) VALUES ($1, $2, $2) RETURNING *",
      [name, lifePoint]
    );
    return this.hydrate(rows[0], executor);
  }

  async rename(id: number, name: string): Promise<Pokemon | null> {
    const { rows } = await pool.query<PokemonRow>(
      "UPDATE pokemon SET name = $1 WHERE id = $2 RETURNING *",
      [name, id]
    );
    return rows[0] ? this.hydrate(rows[0], pool) : null;
  }

  async delete(id: number): Promise<boolean> {
    const { rowCount } = await pool.query("DELETE FROM pokemon WHERE id = $1", [id]);
    return rowCount === 1;
  }

  async learnAttack(pokemon: Pokemon, attack: Attack, executor: QueryExecutor = pool): Promise<void> {
    if (pokemon.id === undefined || attack.id === undefined) {
      throw new Error("Le Pokémon et l'attaque doivent être enregistrés avant cette opération.");
    }
    await executor.query(
      "INSERT INTO pokemon_attacks (pokemon_id, attack_id, position, usage_count) VALUES ($1, $2, $3, 0)",
      [pokemon.id, attack.id, pokemon.attacks.length]
    );
  }

  async save(pokemon: Pokemon, executor: QueryExecutor): Promise<void> {
    if (pokemon.id === undefined) throw new Error("Impossible de sauvegarder un Pokémon sans identifiant.");
    await executor.query(
      "UPDATE pokemon SET name = $1, life_point = $2 WHERE id = $3",
      [pokemon.name, pokemon.lifePoint, pokemon.id]
    );
    for (const [position, attack] of pokemon.attacks.entries()) {
      if (attack.id === undefined) continue;
      await executor.query(
        "UPDATE pokemon_attacks SET usage_count = $1, position = $2 WHERE pokemon_id = $3 AND attack_id = $4",
        [attack.usageCount, position, pokemon.id, attack.id]
      );
    }
  }

  private async hydrate(row: PokemonRow, executor: QueryExecutor): Promise<Pokemon> {
    const { rows } = await executor.query<PokemonAttackRow>(
      `SELECT a.id, a.name, a.damage, a.usage_limit, pa.usage_count
       FROM pokemon_attacks pa
       JOIN attacks a ON a.id = pa.attack_id
       WHERE pa.pokemon_id = $1
       ORDER BY pa.position`,
      [row.id]
    );
    const attacks = rows.map((attack) => new Attack({
      id: attack.id,
      name: attack.name,
      damage: attack.damage,
      usageLimit: attack.usage_limit,
      usageCount: attack.usage_count
    }));
    return new Pokemon({
      id: row.id,
      name: row.name,
      lifePoint: row.life_point,
      maxLifePoint: row.max_life_point,
      attacks
    });
  }
}

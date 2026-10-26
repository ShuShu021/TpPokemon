import { QueryResultRow } from "pg";
import { Attack } from "../domain/Attack";
import { inTransaction, pool, QueryExecutor } from "../db/pool";

interface AttackRow extends QueryResultRow {
  id: number;
  name: string;
  damage: number;
  usage_limit: number;
}

function toAttack(row: AttackRow): Attack {
  return new Attack({
    id: row.id,
    name: row.name,
    damage: row.damage,
    usageLimit: row.usage_limit
  });
}

export class AttackRepository {
  async findAll(executor: QueryExecutor = pool): Promise<Attack[]> {
    const { rows } = await executor.query<AttackRow>("SELECT * FROM attacks ORDER BY id");
    return rows.map(toAttack);
  }

  async findById(id: number, executor: QueryExecutor = pool): Promise<Attack | null> {
    const { rows } = await executor.query<AttackRow>("SELECT * FROM attacks WHERE id = $1", [id]);
    return rows[0] ? toAttack(rows[0]) : null;
  }

  async create(attack: Attack, executor: QueryExecutor = pool): Promise<Attack> {
    const { rows } = await executor.query<AttackRow>(
      "INSERT INTO attacks (name, damage, usage_limit) VALUES ($1, $2, $3) RETURNING *",
      [attack.name, attack.damage, attack.usageLimit]
    );
    return toAttack(rows[0]);
  }

  async update(id: number, fields: { name?: string; damage?: number; usageLimit?: number }): Promise<Attack | null> {
    const existing = await this.findById(id);
    if (!existing) return null;

    const updated = new Attack({
      id,
      name: fields.name ?? existing.name,
      damage: fields.damage ?? existing.damage,
      usageLimit: fields.usageLimit ?? existing.usageLimit
    });
    return inTransaction(async (client) => {
      const { rows } = await client.query<AttackRow>(
        "UPDATE attacks SET name = $1, damage = $2, usage_limit = $3 WHERE id = $4 RETURNING *",
        [updated.name, updated.damage, updated.usageLimit, id]
      );
      if (!rows[0]) return null;
      await client.query(
        "UPDATE pokemon_attacks SET usage_count = 0 WHERE attack_id = $1 AND usage_count > $2",
        [id, updated.usageLimit]
      );
      return toAttack(rows[0]);
    });
  }

  async delete(id: number): Promise<boolean> {
    const { rowCount } = await pool.query("DELETE FROM attacks WHERE id = $1", [id]);
    return rowCount === 1;
  }
}

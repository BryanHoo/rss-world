import 'server-only';
import type { Pool } from 'pg';

export interface CategoryRow {
  id: string;
  name: string;
  position: number;
}

export async function listCategories(pool: Pool): Promise<CategoryRow[]> {
  const { rows } = await pool.query<CategoryRow>(
    'select id, name, position from categories order by position asc, name asc',
  );
  return rows;
}

export async function createCategory(
  pool: Pool,
  input: { name: string; position?: number },
): Promise<CategoryRow> {
  const { rows } = await pool.query<CategoryRow>(
    `
      insert into categories(name, position)
      values ($1, $2)
      returning id, name, position
    `,
    [input.name, input.position ?? 0],
  );
  return rows[0];
}

export async function updateCategory(
  pool: Pool,
  id: string,
  input: { name?: string; position?: number },
): Promise<CategoryRow | null> {
  const fields: string[] = [];
  const values: Array<string | number> = [];
  let paramIndex = 1;

  if (typeof input.name !== 'undefined') {
    fields.push(`name = $${paramIndex++}`);
    values.push(input.name);
  }
  if (typeof input.position !== 'undefined') {
    fields.push(`position = $${paramIndex++}`);
    values.push(input.position);
  }
  if (fields.length === 0) return null;

  fields.push('updated_at = now()');
  values.push(id);

  const { rows } = await pool.query<CategoryRow>(
    `
      update categories
      set ${fields.join(', ')}
      where id = $${paramIndex}
      returning id, name, position
    `,
    values,
  );

  return rows[0] ?? null;
}

export async function deleteCategory(pool: Pool, id: string): Promise<void> {
  await pool.query('delete from categories where id = $1', [id]);
}


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

export async function deleteCategory(pool: Pool, id: string): Promise<boolean> {
  const res = await pool.query('delete from categories where id = $1', [id]);
  return (res.rowCount ?? 0) > 0;
}

export async function reorderCategories(
  pool: Pool,
  items: Array<{ id: string; position: number }>,
): Promise<CategoryRow[]> {
  await pool.query('begin');
  try {
    const ids = items.map((item) => item.id);
    const positions = items.map((item) => item.position);

    const existing = await pool.query<{ id: string }>(
      'select id from categories where id = any($1::uuid[])',
      [ids],
    );
    if (existing.rows.length !== ids.length) {
      throw new Error('category_not_found');
    }

    await pool.query(
      `
      update categories as c
      set position = v.position,
          updated_at = now()
      from (
        select unnest($1::uuid[]) as id, unnest($2::int[]) as position
      ) as v
      where c.id = v.id
      `,
      [ids, positions],
    );

    const result = await pool.query<CategoryRow>(
      'select id, name, position from categories order by position asc, name asc',
    );

    await pool.query('commit');
    return result.rows;
  } catch (error) {
    await pool.query('rollback');
    throw error;
  }
}

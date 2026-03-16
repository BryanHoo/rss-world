import crypto from 'node:crypto';
import type { Pool } from 'pg';
import {
  createCategory,
  findCategoryByNormalizedName,
  getNextCategoryPosition,
} from '../repositories/categoriesRepo';
import { createAiDigestFeed } from '../repositories/feedsRepo';
import { createAiDigestConfig } from '../repositories/aiDigestRepo';

type CategoryResolutionInput = {
  categoryId?: string | null;
  categoryName?: string | null;
};

function normalizeCategoryName(name: string | null | undefined): string | null {
  const normalized = name?.trim() ?? '';
  if (!normalized || normalized === '未分类') return null;
  return normalized;
}

async function resolveCategoryId(
  client: { query: Pool['query'] },
  input: CategoryResolutionInput,
): Promise<string | null> {
  if (typeof input.categoryId !== 'undefined') {
    return input.categoryId ?? null;
  }

  const normalizedName = normalizeCategoryName(input.categoryName);
  if (!normalizedName) return null;

  const existing = await findCategoryByNormalizedName(client as never, normalizedName);
  if (existing) return existing.id;

  const position = await getNextCategoryPosition(client as never);
  const created = await createCategory(client as never, { name: normalizedName, position });
  return created.id;
}

export async function createAiDigestWithCategoryResolution(
  pool: Pool,
  input: {
    title: string;
    prompt: string;
    intervalMinutes: number;
    selectedFeedIds: string[];
    selectedCategoryIds: string[];
    categoryId?: string | null;
    categoryName?: string | null;
  },
) {
  const client = await pool.connect();
  try {
    await client.query('begin');

    const feedId = crypto.randomUUID();
    const categoryId = await resolveCategoryId(client as never, input);

    const createdFeed = await createAiDigestFeed(client as never, {
      id: feedId,
      title: input.title,
      categoryId,
    });

    await createAiDigestConfig(client as never, {
      feedId,
      prompt: input.prompt,
      intervalMinutes: input.intervalMinutes,
      topN: 10,
      selectedFeedIds: input.selectedFeedIds,
      selectedCategoryIds: input.selectedCategoryIds,
      lastWindowEndAt: new Date().toISOString(),
    });

    await client.query('commit');
    return createdFeed;
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}


import { describe, expect, it } from 'vitest';
import {
  getUserOperationCatalogEntry,
  renderUserOperationFailure,
  renderUserOperationSuccess,
} from './userOperationCatalog';

describe('userOperationCatalog', () => {
  it('renders success without reason and error with short reason', () => {
    expect(renderUserOperationSuccess('feed.create')).toBe('已添加订阅源');
    expect(renderUserOperationFailure('feed.create', '  订阅源已存在  ')).toBe(
      '添加订阅源失败：订阅源已存在',
    );
  });

  it('exposes mode, category and start message for deferred actions', () => {
    expect(getUserOperationCatalogEntry('feed.refresh')).toMatchObject({
      mode: 'deferred',
      category: 'feed',
    });
  });
});

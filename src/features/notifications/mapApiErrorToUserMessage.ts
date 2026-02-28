import { ApiError } from '../../lib/apiClient';

export function mapApiErrorToUserMessage(err: unknown, action: string): string {
  void action;

  if (err instanceof ApiError) {
    if (err.code === 'conflict') return '操作失败：数据已存在。';
    if (err.code === 'validation_error') return '操作失败：输入不合法。';
    if (err.code === 'not_found') return '操作失败：目标不存在。';
    if (err.message?.trim()) {
      return `操作失败：${err.message}`;
    }
  }

  return '操作失败，请稍后重试。';
}

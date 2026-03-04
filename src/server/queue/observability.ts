export function attachBossObservers(boss: {
  on: (event: string, cb: (...args: unknown[]) => void) => void;
}) {
  boss.on('error', (err) => {
    console.error('[pgboss.error]', err);
  });
  boss.on('warning', (payload) => {
    console.warn('[pgboss.warning]', payload);
  });
  boss.on('wip', (payload) => {
    console.info('[pgboss.wip]', payload);
  });
  boss.on('stopped', () => {
    console.info('[pgboss.stopped]');
  });
}

export async function sampleQueueStats(
  boss: { getQueueStats: (name: string) => Promise<unknown> },
  names: string[],
) {
  await Promise.all(
    names.map(async (name) => {
      const stats = await boss.getQueueStats(name);
      console.info('[pgboss.stats]', { name, stats });
      return stats;
    }),
  );
}

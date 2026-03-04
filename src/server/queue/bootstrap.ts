import { QUEUE_CONTRACTS } from './contracts';

export async function bootstrapQueues(boss: {
  createQueue: (name: string, options?: unknown) => Promise<void>;
}) {
  for (const [name, contract] of Object.entries(QUEUE_CONTRACTS)) {
    await boss.createQueue(name, contract.queue);
    if (contract.queue.deadLetter) {
      await boss.createQueue(contract.queue.deadLetter, {});
    }
  }
}

export async function pollWithBackoff<T>(input: {
  fn: () => Promise<T>;
  stop: (value: T) => boolean;
  onValue?: (value: T) => void;
  signal?: AbortSignal;
  timeoutMs?: number;
  scheduleMs?: number[];
}): Promise<{ value: T | null; timedOut: boolean }> {
  const schedule = input.scheduleMs ?? [500, 1000, 2000, 3000, 5000];
  const timeoutMs = input.timeoutMs ?? 60_000;

  const started = Date.now();
  let attempt = 0;

  while (true) {
    if (input.signal?.aborted) return { value: null, timedOut: false };

    const value = await input.fn();
    input.onValue?.(value);
    if (input.stop(value)) return { value, timedOut: false };

    const elapsed = Date.now() - started;
    if (elapsed >= timeoutMs) return { value, timedOut: true };

    const delay = schedule[Math.min(attempt, schedule.length - 1)];
    attempt += 1;

    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(resolve, delay);
      input.signal?.addEventListener(
        'abort',
        () => {
          clearTimeout(timer);
          reject(new Error('aborted'));
        },
        { once: true },
      );
    }).catch(() => {});
  }
}


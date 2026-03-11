import { useEffect, useState } from 'react';

function getInitialRenderTime(renderedAt?: string): Date {
  if (renderedAt) {
    const snapshot = new Date(renderedAt);
    if (!Number.isNaN(snapshot.getTime())) {
      return snapshot;
    }
  }

  return new Date();
}

export function useRenderTimeSnapshot(renderedAt?: string): Date {
  const [referenceTime, setReferenceTime] = useState(() => getInitialRenderTime(renderedAt));

  useEffect(() => {
    if (!renderedAt) {
      return undefined;
    }

    setReferenceTime((currentTime) => {
      const nextTime = new Date();
      return currentTime.getTime() === nextTime.getTime() ? currentTime : nextTime;
    });
    return undefined;
  }, [renderedAt]);

  return referenceTime;
}

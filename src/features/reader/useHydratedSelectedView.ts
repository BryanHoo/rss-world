import { useLayoutEffect, useState } from 'react';
import type { ViewType } from '../../types';

const PRE_HYDRATION_VIEW_ID: ViewType = '__pre_hydration__';

export function useHydratedSelectedView(
  selectedView: ViewType,
  initialSelectedView?: ViewType,
): ViewType {
  const [selectionHydrated, setSelectionHydrated] = useState(false);

  // Keep SSR and the first client paint aligned before the store-selected view takes over.
  useLayoutEffect(() => {
    setSelectionHydrated(true);
  }, []);

  return selectionHydrated ? selectedView : (initialSelectedView ?? PRE_HYDRATION_VIEW_ID);
}

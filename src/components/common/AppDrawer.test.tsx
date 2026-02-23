import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import AppDrawer from './AppDrawer';

describe('AppDrawer', () => {
  it('renders right-side drawer shell with overlay and header actions', () => {
    render(
      <AppDrawer
        open
        onOpenChange={() => {}}
        title="设置"
        closeLabel="close-settings"
        testId="settings-center-modal"
        overlayTestId="settings-center-overlay"
      >
        <div>content</div>
      </AppDrawer>
    );

    expect(screen.getByTestId('settings-center-modal').className).toContain('right-0');
    expect(screen.getByTestId('settings-center-overlay')).toBeInTheDocument();
    expect(screen.getByLabelText('close-settings')).toBeInTheDocument();
  });
});

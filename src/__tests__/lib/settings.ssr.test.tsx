/**
 * @jest-environment node
 */
import { renderToString } from 'react-dom/server';
import { useSettings, type MotionSetting } from '@/lib/settings';

const captured: { setMotion?: (motion: MotionSetting) => void } = {};

function TestComponent() {
  const { settings, setMotion } = useSettings();
  // setMotion is a stable closure independent of render state (it just calls
  // the module-level updateSettings) — capturing it here lets the second test
  // call it after a one-shot renderToString, where there's no interactive
  // re-render to trigger it through normal event handling.
  // eslint-disable-next-line react-hooks/immutability
  captured.setMotion = setMotion;
  return <div>motion:{settings.motion}</div>;
}

describe('settings store (SSR)', () => {
  it('uses default settings as the server snapshot', () => {
    expect(renderToString(<TestComponent />)).toContain('motion:<!-- -->system');
  });

  it('does nothing when setMotion is called without a window', () => {
    renderToString(<TestComponent />);

    expect(() => captured.setMotion!('reduced')).not.toThrow();
  });
});

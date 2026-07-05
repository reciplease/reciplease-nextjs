/**
 * @jest-environment node
 */
import { renderToString } from 'react-dom/server';
import { useSettings, type MotionSetting } from '@/lib/settings';

function TestComponent({
  onReady,
}: {
  onReady: (setMotion: (motion: MotionSetting) => void) => void;
}) {
  const { settings, setMotion } = useSettings();
  onReady(setMotion);
  return <div>motion:{settings.motion}</div>;
}

describe('settings store (SSR)', () => {
  it('uses default settings as the server snapshot', () => {
    expect(renderToString(<TestComponent onReady={() => {}} />)).toContain(
      'motion:<!-- -->system',
    );
  });

  it('does nothing when setMotion is called without a window', () => {
    let captured: ((motion: MotionSetting) => void) | undefined;
    renderToString(
      <TestComponent
        onReady={(setMotion) => {
          captured = setMotion;
        }}
      />,
    );

    expect(() => captured!('reduced')).not.toThrow();
  });
});

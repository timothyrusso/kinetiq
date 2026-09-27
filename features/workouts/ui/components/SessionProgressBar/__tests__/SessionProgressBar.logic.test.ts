import { renderHook } from '@testing-library/react-native';
import { useSessionProgressBarLogic } from '@/features/workouts/ui/components/SessionProgressBar/SessionProgressBar.logic';

describe('useSessionProgressBarLogic', () => {
  it('fills the track to the ratio, as a whole percentage', async () => {
    const { result } = await renderHook(() => useSessionProgressBarLogic(0.404));

    expect(result.current.derived.fillWidth).toEqual({ width: '40%' });
  });

  it('never fills past the track or below empty', async () => {
    const over = await renderHook(() => useSessionProgressBarLogic(1.5));
    const under = await renderHook(() => useSessionProgressBarLogic(-1));

    expect(over.result.current.derived.fillWidth).toEqual({ width: '100%' });
    expect(under.result.current.derived.fillWidth).toEqual({ width: '0%' });
  });
});

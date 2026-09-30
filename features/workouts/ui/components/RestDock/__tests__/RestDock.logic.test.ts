import { act, renderHook } from '@testing-library/react-native';
import { type RestDockInput, useRestDockLogic } from '@/features/workouts/ui/components/RestDock/RestDock.logic';

const renderDock = async (overrides: Partial<RestDockInput> = {}) => {
  const adjusted: number[] = [];
  const heights: number[] = [];
  const input: RestDockInput = {
    remainingSeconds: 45,
    totalSeconds: 90,
    bottom: 120,
    onAdjust: seconds => void adjusted.push(seconds),
    onHeight: height => void heights.push(height),
    ...overrides,
  };
  return { ...(await renderHook(() => useRestDockLogic(input))), adjusted, heights };
};

describe('useRestDockLogic', () => {
  it('fills the bar with the share of the rest still to go', async () => {
    const { result } = await renderDock();

    expect(result.current.derived.fillWidth).toEqual({ width: '50%' });
  });

  it('draws an empty bar for a rest with no length', async () => {
    const { result } = await renderDock({ totalSeconds: 0 });

    expect(result.current.derived.fillWidth).toEqual({ width: '0%' });
  });

  it('stands where the screen places it', async () => {
    const { result } = await renderDock();

    expect(result.current.derived.position).toEqual({ bottom: 120 });
  });

  it('takes fifteen seconds off, never below zero', async () => {
    const { result, adjusted } = await renderDock({ remainingSeconds: 10 });

    await act(async () => result.current.effects.less());

    expect(adjusted).toEqual([0]);
  });

  it('adds fifteen seconds, never past ten minutes', async () => {
    const { result, adjusted } = await renderDock({ remainingSeconds: 595 });

    await act(async () => result.current.effects.more());

    expect(adjusted).toEqual([600]);
  });

  it('reports its own height rounded to a point', async () => {
    const { result, heights } = await renderDock();

    await act(async () =>
      result.current.effects.layout({ nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 120.6 } } } as never),
    );

    expect(heights).toEqual([121]);
  });
});

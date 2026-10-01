import { act, renderHook } from '@testing-library/react-native';
import {
  REPEAT_DELAY_MS,
  REPEAT_INTERVAL_MS,
  useStepperPress,
} from '@/features/core/design-system/controls/Stepper/Stepper.logic';

/** The shortest a `Pressable` press lasts: it holds `onPressOut` until 130 ms after `onPressIn`. */
const PRESSABLE_MIN_PRESS_MS = 130;

const renderPress = (value: number, changes: number[], take: () => number | null = () => null) =>
  renderHook(() => useStepperPress(value, next => void changes.push(next), { min: 0, max: 20, step: 1 }, take));

describe('useStepperPress', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('moves one step for a tap, however long Pressable holds the press out', async () => {
    const changes: number[] = [];
    const { result } = await renderPress(10, changes);

    await act(async () => {
      result.current.effects.press(1);
      jest.advanceTimersByTime(PRESSABLE_MIN_PRESS_MS);
      result.current.effects.release();
      jest.advanceTimersByTime(1000);
    });

    expect(changes).toEqual([11]);
  });

  it('moves one step per tap across repeated taps', async () => {
    const changes: number[] = [];
    const { result } = await renderPress(10, changes);

    await act(async () => {
      for (let i = 0; i < 3; i++) {
        result.current.effects.press(-1);
        jest.advanceTimersByTime(PRESSABLE_MIN_PRESS_MS);
        result.current.effects.release();
      }
    });

    expect(changes).toEqual([9, 8, 7]);
  });

  it('repeats a held press only after the delay, from the latest value', async () => {
    const changes: number[] = [];
    const { result } = await renderPress(10, changes);

    await act(async () => void result.current.effects.press(1));
    await act(async () => void jest.advanceTimersByTime(REPEAT_DELAY_MS));
    const beforeRepeat = [...changes];
    await act(async () => void jest.advanceTimersByTime(REPEAT_INTERVAL_MS * 2));
    await act(async () => void result.current.effects.release());
    await act(async () => void jest.advanceTimersByTime(1000));

    expect(beforeRepeat).toEqual([11]);
    expect(changes).toEqual([11, 12, 13]);
  });

  it('stops at the bound', async () => {
    const changes: number[] = [];
    const { result } = await renderPress(19, changes);

    await act(async () => void result.current.effects.press(1));
    await act(async () => void jest.advanceTimersByTime(REPEAT_DELAY_MS + REPEAT_INTERVAL_MS * 5));

    expect(changes).toEqual([20]);
  });

  it('steps from the number typed in the field, not the one under it, in one write', async () => {
    const changes: number[] = [];
    const { result } = await renderPress(10, changes, () => 15);

    await act(async () => {
      result.current.effects.press(1);
      result.current.effects.release();
    });

    expect(changes).toEqual([16]);
  });

  it('writes the typed number when the step cannot move it past the bound', async () => {
    const changes: number[] = [];
    const { result } = await renderPress(10, changes, () => 20);

    await act(async () => {
      result.current.effects.press(1);
      result.current.effects.release();
    });

    expect(changes).toEqual([20]);
  });

  it('leaves no repeat running once unmounted mid-hold', async () => {
    const changes: number[] = [];
    const { result, unmount } = await renderPress(10, changes);

    await act(async () => void result.current.effects.press(1));
    await act(async () => void unmount());
    jest.advanceTimersByTime(REPEAT_DELAY_MS + REPEAT_INTERVAL_MS * 5);

    expect(changes).toEqual([11]);
  });
});

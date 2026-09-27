import { act, renderHook } from '@testing-library/react-native';
import { themeFor } from '@/features/core/theme';
import { anActivity } from '@/features/workouts/__fixtures__/builders';
import { activityDisplay } from '@/features/workouts/mappers/activityDisplay';
import { useActivityCardLogic } from '@/features/workouts/ui/components/ActivityCard/ActivityCard.logic';

const ACTIVITY = anActivity();

const renderCard = async (withLongPress = true) => {
  const pressed: string[] = [];
  const longPressed: string[] = [];
  const onLongPress = withLongPress ? (id: string) => void longPressed.push(id) : undefined;
  const rendered = await renderHook(() =>
    useActivityCardLogic(ACTIVITY, 'metric', themeFor('light'), id => void pressed.push(id), onLongPress),
  );
  return { ...rendered, pressed, longPressed };
};

describe('useActivityCardLogic', () => {
  it('summarises the workout the way the detail does', async () => {
    const { result } = await renderCard();

    expect(result.current.derived.summary).toEqual(activityDisplay(ACTIVITY, 'metric'));
  });

  it('hands the workout id to a press', async () => {
    const { result, pressed } = await renderCard();

    await act(async () => result.current.effects.press());

    expect(pressed).toEqual([ACTIVITY.id]);
  });

  it('hands the workout id to a long press', async () => {
    const { result, longPressed } = await renderCard();

    await act(async () => result.current.effects.longPress());

    expect(longPressed).toEqual([ACTIVITY.id]);
  });

  it('says whether a long press does anything', async () => {
    const { result } = await renderCard(false);

    expect(result.current.derived.hasLongPress).toBe(false);
  });
});

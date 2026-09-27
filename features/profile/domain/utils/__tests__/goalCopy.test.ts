import { goalHeadline } from '@/features/profile/domain/utils/goalCopy';

describe('goalHeadline', () => {
  it('says nothing yet for a week with no workout', () => {
    expect(goalHeadline(0, 3)).toBe('nothing');
  });

  it('says the goal is met once the workouts reach it', () => {
    expect(goalHeadline(3, 3)).toBe('goalMet');
    expect(goalHeadline(5, 3)).toBe('goalMet');
  });

  it('says on track from half the goal', () => {
    expect(goalHeadline(2, 4)).toBe('onTrack');
  });

  it('says starting below half the goal', () => {
    expect(goalHeadline(1, 4)).toBe('starting');
  });
});

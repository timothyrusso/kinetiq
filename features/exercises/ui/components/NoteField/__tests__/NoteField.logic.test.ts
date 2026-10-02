import { act, renderHook } from '@testing-library/react-native';
import { tr } from '@/features/core/translations';
import { useNoteFieldLogic } from '@/features/exercises/ui/components/NoteField/NoteField.logic';

const renderNote = (note: string | null, commits: (string | null)[]) =>
  renderHook(() => useNoteFieldLogic(note, notes => void commits.push(notes)));

describe('useNoteFieldLogic', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('commits the note once typing pauses', async () => {
    const commits: (string | null)[] = [];
    const { result } = await renderNote(null, commits);

    await act(async () => {
      result.current.effects.change('Brace');
      result.current.effects.change('Brace first');
    });
    const early = [...commits];
    await act(async () => void jest.advanceTimersByTime(500));

    expect(early).toEqual([]);
    expect(commits).toEqual(['Brace first']);
  });

  it('commits a blank note as no note', async () => {
    const commits: (string | null)[] = [];
    const { result } = await renderNote('Brace', commits);

    await act(async () => result.current.effects.change('   '));
    await act(async () => void jest.advanceTimersByTime(500));

    expect(commits).toEqual([null]);
  });

  it('commits what is pending when the field goes away', async () => {
    const commits: (string | null)[] = [];
    const { result, unmount } = await renderNote(null, commits);

    await act(async () => result.current.effects.change('Slow down'));
    await unmount();

    expect(commits).toEqual(['Slow down']);
  });

  it('counts the characters near the limit', async () => {
    const { result } = await renderNote(null, []);

    await act(async () => result.current.effects.change('x'.repeat(170)));

    expect(result.current.derived.hint).toBe(
      tr('itemEditor.noteCount', { count: 170, max: result.current.derived.maxLength }),
    );
  });
});

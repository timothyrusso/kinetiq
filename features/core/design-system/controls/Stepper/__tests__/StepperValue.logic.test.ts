import { act, renderHook } from '@testing-library/react-native';
import { useStepperField } from '@/features/core/design-system/controls/Stepper/StepperValue.logic';
import { setLanguagePreference } from '@/features/core/translations';

const kg = { min: 0, max: 450, decimal: true };

const renderField = (value: number, changes: number[], bounds = kg) =>
  renderHook(({ at }: { at: number }) => useStepperField(at, next => void changes.push(next), bounds), {
    initialProps: { at: value },
  });

describe('useStepperField', () => {
  afterEach(() => act(() => setLanguagePreference('system')));

  it('shows each keystroke as typed and writes only on blur', async () => {
    const changes: number[] = [];
    const { result } = await renderField(60, changes);
    const shown: string[] = [];

    await act(async () => result.current.effects.focus());
    for (const typed of ['1', '10', '102', '102.', '102.5']) {
      await act(async () => result.current.effects.changeText(typed));
      shown.push(result.current.state.text);
    }
    expect(shown).toEqual(['1', '10', '102', '102.', '102.5']);
    expect(changes).toEqual([]);

    await act(async () => result.current.effects.blur());
    expect(changes).toEqual([102.5]);
  });

  it('keeps an emptied field empty while typing, and the value if left empty', async () => {
    const changes: number[] = [];
    const { result } = await renderField(12, changes, { min: 1, max: 100, decimal: false });

    await act(async () => result.current.effects.focus());
    await act(async () => result.current.effects.changeText(''));
    expect(result.current.state.text).toBe('');
    await act(async () => result.current.effects.changeText('7'));
    expect(result.current.state.text).toBe('7');
    await act(async () => result.current.effects.changeText(''));
    await act(async () => result.current.effects.blur());

    expect(changes).toEqual([]);
    expect(result.current.state.text).toBe('12');
  });

  it('commits over the bound as the bound, and shows it until the write comes back', async () => {
    const changes: number[] = [];
    const { result, rerender } = await renderField(8, changes, { min: 1, max: 100, decimal: false });

    await act(async () => result.current.effects.focus());
    await act(async () => result.current.effects.changeText('150'));
    await act(async () => result.current.effects.blur());
    expect(changes).toEqual([100]);
    expect(result.current.state.text).toBe('100');

    await act(async () => rerender({ at: 100 }));
    expect(result.current.state.text).toBe('100');
  });

  it('does not let a late value overwrite the text being typed', async () => {
    const changes: number[] = [];
    const { result, rerender } = await renderField(60, changes);

    await act(async () => result.current.effects.focus());
    await act(async () => result.current.effects.changeText('1'));
    await act(async () => rerender({ at: 60 }));
    await act(async () => result.current.effects.changeText('10'));

    expect(result.current.state.text).toBe('10');
  });

  it('reads and writes the Italian decimal comma', async () => {
    await act(async () => setLanguagePreference('it'));
    const changes: number[] = [];
    const { result } = await renderField(62.5, changes);

    await act(async () => result.current.effects.focus());
    expect(result.current.state.text).toBe('62,5');
    await act(async () => result.current.effects.changeText('102,5'));
    await act(async () => result.current.effects.blur());

    expect(changes).toEqual([102.5]);
    expect(result.current.state.text).toBe('102,5');
  });

  it('hands a press the typed number without writing it', async () => {
    const changes: number[] = [];
    const { result } = await renderField(60, changes);

    await act(async () => result.current.effects.focus());
    await act(async () => result.current.effects.changeText('70'));
    let from: number | null = null;
    await act(async () => {
      from = result.current.effects.take();
    });
    await act(async () => result.current.effects.blur());

    expect(from).toBe(70);
    expect(changes).toEqual([]);
  });

  it('stops selecting on focus while focused, so a layout mid-typing cannot select the digits', async () => {
    const changes: number[] = [];
    const { result } = await renderField(60, changes);

    expect(result.current.state.selectOnFocus).toBe(true);
    await act(async () => result.current.effects.focus());
    expect(result.current.state.selectOnFocus).toBe(false);
    await act(async () => result.current.effects.blur());
    expect(result.current.state.selectOnFocus).toBe(true);
  });

  it('keeps typing that starts while a press is still being written', async () => {
    const changes: number[] = [];
    const { result, rerender } = await renderField(10, changes);

    await act(async () => result.current.effects.focus());
    await act(async () => result.current.effects.changeText('15'));
    await act(async () => {
      const typed = result.current.effects.take();
      result.current.effects.write((typed ?? 10) + 1);
    });
    await act(async () => result.current.effects.changeText('2'));
    await act(async () => rerender({ at: 16 }));

    expect(changes).toEqual([16]);
    expect(result.current.state.text).toBe('2');
  });

  it('keeps typing that starts while a blur is still being written', async () => {
    const changes: number[] = [];
    const { result, rerender } = await renderField(60, changes);

    await act(async () => result.current.effects.focus());
    await act(async () => result.current.effects.changeText('80'));
    await act(async () => result.current.effects.blur());
    expect(result.current.state.text).toBe('80');
    await act(async () => result.current.effects.focus());
    await act(async () => result.current.effects.changeText('9'));
    await act(async () => rerender({ at: 80 }));

    expect(changes).toEqual([80]);
    expect(result.current.state.text).toBe('9');
  });

  it('does not write a number again while it is still being written', async () => {
    const changes: number[] = [];
    const { result, unmount } = await renderField(60, changes);

    await act(async () => result.current.effects.focus());
    await act(async () => result.current.effects.changeText('80'));
    await act(async () => result.current.effects.blur());
    await act(async () => result.current.effects.focus());
    await act(async () => result.current.effects.blur());
    await act(async () => unmount());

    expect(changes).toEqual([80]);
  });

  it('commits what was typed when the field goes away mid-typing', async () => {
    const changes: number[] = [];
    const { result, unmount } = await renderField(60, changes);

    await act(async () => result.current.effects.focus());
    await act(async () => result.current.effects.changeText('80'));
    await act(async () => unmount());

    expect(changes).toEqual([80]);
  });
});

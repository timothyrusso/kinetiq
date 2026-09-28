import { render } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import type { JsonElement } from 'test-renderer';
import { SettingsList } from '@/features/core/design-system/controls/SettingsList/index.android';
import { tr } from '@/features/core/translations';

// NOTE: Compose views have no binary under jest. Each primitive renders its children, and `Icon`
// is a host element whose props the test reads, which is all the stepper's naming depends on.
jest.mock('@expo/ui/jetpack-compose', () => {
  const Pass = ({ children }: { children?: ReactNode }) => children ?? null;
  const slots = { HeadlineContent: Pass, SupportingContent: Pass, TrailingContent: Pass };
  return {
    CircularProgressIndicator: Pass,
    Column: Pass,
    Row: Pass,
    Host: Pass,
    Icon: 'Icon',
    IconButton: Pass,
    LazyColumn: Pass,
    ListItem: Object.assign(Pass, slots),
    SegmentedButton: Object.assign(Pass, { Label: Pass }),
    SingleChoiceSegmentedButtonRow: Pass,
    Switch: Pass,
    Text: 'Text',
    TextField: Pass,
    useMaterialColors: () => ({}),
    useNativeState: (value: unknown) => ({ value }),
  };
});
jest.mock('@expo/ui/jetpack-compose/modifiers', () => {
  const anything: object = new Proxy(() => ({}), { get: () => anything, apply: () => ({}) });
  return anything;
});
jest.mock('@/features/core/design-system/icons/materialIcons', () => ({ materialIcon: () => ({ uri: 'glyph' }) }));

const SAFE_AREA = { frame: { x: 0, y: 0, width: 412, height: 915 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };

/** Every `Icon` host element in the rendered tree, in order. */
function iconsIn(node: JsonElement | string | null): JsonElement[] {
  if (node === null || typeof node === 'string') return [];
  const below = (node.children ?? []).flatMap(iconsIn);
  return node.type === 'Icon' ? [node, ...below] : below;
}

describe('SettingsList on Android', () => {
  it("names a stepper row's minus and plus after the row, so TalkBack does not say only Button", async () => {
    const screen = await render(
      <SafeAreaProvider initialMetrics={SAFE_AREA}>
        <SettingsList
          sections={[
            {
              key: 'reminder',
              rows: [
                {
                  kind: 'stepper',
                  key: 'time',
                  title: 'Time',
                  value: 1080,
                  min: 0,
                  max: 1425,
                  step: 15,
                  format: String,
                  onChange: () => undefined,
                },
              ],
            },
          ]}
        />
      </SafeAreaProvider>,
    );

    expect(iconsIn(screen.toJSON()).map(icon => icon.props.contentDescription)).toEqual([
      tr('settingsList.decrease', { title: 'Time' }),
      tr('settingsList.increase', { title: 'Time' }),
    ]);
  });
});

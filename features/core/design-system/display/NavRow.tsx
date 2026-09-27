import { memo } from 'react';
import { StyleSheet } from 'react-native';
import { ListRow } from '@/features/core/design-system/display/ListRow';
import { type IconName, IconTile } from '@/features/core/design-system/icons/icons';
import { CellText } from '@/features/core/design-system/text/CellText';
import type { Theme } from '@/features/core/theme';

/**
 * Navigation cell for the settings list: title, optional subtitle, an optional
 * right-aligned *value* ("Kilometres"), then the chevron.
 *
 * The value is a separate slot from `trailing` because they mean different things:
 * a value is the current state of a setting, `trailing` is a control. Putting a
 * switch where a value goes is how a list starts reading inconsistently.
 */
export const NavRow = memo(function NavRow({
  title,
  description,
  value,
  theme,
  onPress,
  icon,
  danger = false,
  showChevron = true,
  topDivider = true,
}: {
  title: string;
  description?: string;
  /** Current value, e.g. "Metric", "90 s", "Athlete". */
  value?: string;
  theme: Theme;
  onPress: () => void;
  icon?: IconName;
  danger?: boolean;
  showChevron?: boolean;
  topDivider?: boolean;
}) {
  return (
    <ListRow
      theme={theme}
      title={title}
      {...(description ? { description } : {})}
      onPress={onPress}
      showChevron={showChevron}
      style={
        topDivider ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.hairline } : undefined
      }
      {...(icon
        ? {
            leading: (
              <IconTile
                name={icon}
                color={danger ? theme.colors.danger : theme.colors.textMuted}
                background={danger ? theme.colors.dangerSoft : theme.colors.placeholder}
                size={30}
              />
            ),
          }
        : {})}
      {...(value
        ? {
            body: (
              <CellText
                text={value}
                variant="label"
                color={theme.colors.textMuted}
                numberOfLines={1}
                align="right"
                style={{ maxWidth: 150 }}
              />
            ),
          }
        : {})}
    />
  );
});

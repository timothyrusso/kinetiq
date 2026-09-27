import { memo, type ReactNode } from 'react';
import { Row } from '@/features/core/design-system/layout/Row';
import { Txt } from '@/features/core/design-system/text/Text';
import { radius, spacing, type Theme, useAppTheme } from '@/features/core/theme';

/** Pill badge for a status: PR, PB, set complete. */
export const Badge = memo(function Badge({
  label,
  tone = 'neutral',
  icon,
}: {
  label: string;
  tone?: 'neutral' | 'accent' | 'success' | 'danger' | 'warning' | 'info';
  icon?: ReactNode;
}) {
  const theme = useAppTheme();
  const palette = badgePalette(theme, tone);
  return (
    <Row
      gap="xs"
      style={{
        alignSelf: 'flex-start',
        backgroundColor: palette.background,
        borderRadius: radius.pill,
        paddingHorizontal: spacing.sm,
        paddingVertical: 3,
      }}
    >
      {icon}
      <Txt variant="micro" weight="bold" uppercase tracking={0.5} color={palette.text}>
        {label}
      </Txt>
    </Row>
  );
});

function badgePalette(theme: Theme, tone: 'neutral' | 'accent' | 'success' | 'danger' | 'warning' | 'info') {
  switch (tone) {
    case 'neutral':
      return { background: theme.colors.placeholder, text: theme.colors.textMuted };
    case 'accent':
      return { background: theme.colors.accentSoft, text: theme.colors.accent };
    case 'success':
      return { background: theme.colors.successSoft, text: theme.colors.success };
    case 'danger':
      return { background: theme.colors.dangerSoft, text: theme.colors.danger };
    case 'warning':
      return { background: theme.colors.warningSoft, text: theme.colors.warning };
    case 'info':
      return { background: theme.colors.infoSoft, text: theme.colors.info };
  }
}

/**
 * Text for list rows and anything else rendered hundreds of times.
 */
import { memo } from 'react';
import { Text, type StyleProp, type TextStyle } from 'react-native';

import { fontFamily } from '@/theme/tokens';
import { fontSizeOf, lineHeightOf, type TxtVariant } from './Text';

/**
 * Row text: `Txt`'s typography without `Txt`'s theme subscription.
 *
 * `color` is required rather than defaulted precisely so no row can quietly opt
 * back into a context read by omission.
 */
export const CellText = memo(function CellText({
  text,
  variant = 'caption',
  color,
  weight,
  numberOfLines,
  align,
  style,
}: {
  text: string;
  variant?: TxtVariant;
  color: string;
  weight?: TextStyle['fontWeight'];
  numberOfLines?: number;
  align?: TextStyle['textAlign'];
  style?: StyleProp<TextStyle>;
}) {
  const size = fontSizeOf(variant);
  return (
    <Text
      numberOfLines={numberOfLines}
      style={[
        {
          fontFamily: fontFamily[variantFont(variant)],
          fontSize: size,
          lineHeight: Math.round(size * lineHeightOf(variant)),
          fontWeight: weight ?? variantWeight(variant),
          color,
          ...(align ? { textAlign: align } : null),
        },
        style,
      ]}
    >
      {text}
    </Text>
  );
});

function variantFont(variant: TxtVariant): keyof typeof fontFamily {
  if (variant === 'numeral' || variant === 'numeralLg' || variant === 'hero' || variant === 'display') {
    return 'display';
  }
  if (variant === 'numeralSm') return 'displayMedium';
  if (variant === 'mono' || variant === 'monoLg' || variant === 'monoSm') return 'monoSemiBold';
  if (variant === 'subhead' || variant === 'title' || variant === 'headline') return 'heading';
  if (variant === 'strong' || variant === 'micro') return 'semibold';
  if (variant === 'label' || variant === 'caption') return 'medium';
  return 'regular';
}

function variantWeight(variant: TxtVariant): TextStyle['fontWeight'] {
  switch (variantFont(variant)) {
    case 'display':
      return '700';
    case 'displayMedium':
      return '600';
    case 'monoSemiBold':
      return '600';
    case 'heading':
      return '600';
    case 'semibold':
      return '600';
    case 'medium':
      return '500';
    default:
      return '400';
  }
}

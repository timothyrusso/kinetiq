import { Stack as Column, type Tag, TagRow, Txt } from '@/features/core/design-system';
import type { Theme } from '@/features/core/theme';

/** One labelled row of taxonomy: "Primary" above its muscles. Nothing at all when empty. */
export function TaxonomyTagGroup({ label, tags, theme }: { label: string; tags: readonly Tag[]; theme: Theme }) {
  if (tags.length === 0) return null;
  return (
    <Column gap="xs">
      <Txt variant="micro" tone="faint" uppercase tracking={0.8}>
        {label}
      </Txt>
      <TagRow tags={tags} theme={theme} />
    </Column>
  );
}

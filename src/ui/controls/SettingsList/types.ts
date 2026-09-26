/**
 * A settings screen, described as data: sections of rows, each row one of a small set of kinds.
 *
 * The screens say WHAT is on them; the platform files say how each kind is drawn natively
 * (a SwiftUI `Form` on iOS, a Material list on Android). A screen therefore never branches on
 * the platform, and a new setting is a new row in a table rather than a new layout.
 */
export type SettingsRow =
  | { kind: 'nav'; key: string; title: string; subtitle?: string; value?: string; onPress: () => void }
  | {
      kind: 'switch';
      key: string;
      title: string;
      subtitle?: string;
      value: boolean;
      disabled?: boolean;
      onChange: (next: boolean) => void;
    }
  | {
      kind: 'stepper';
      key: string;
      title: string;
      subtitle?: string;
      value: number;
      min: number;
      max: number;
      step: number;
      /** How the value reads beside the control: "120 s", "18:00". */
      format: (value: number) => string;
      onChange: (next: number) => void;
    }
  | { kind: 'check'; key: string; title: string; checked: boolean; onPress: () => void }
  | {
      kind: 'segmented';
      key: string;
      title: string;
      options: readonly { value: string; label: string }[];
      value: string;
      onChange: (next: string) => void;
    }
  | { kind: 'info'; key: string; title: string; value?: string; subtitle?: string }
  | {
      kind: 'button';
      key: string;
      title: string;
      destructive?: boolean;
      disabled?: boolean;
      /** Work in progress: the platform's own spinner beside the title. Implies disabled. */
      busy?: boolean;
      onPress: () => void;
    }
  | {
      kind: 'field';
      key: string;
      title: string;
      value: string;
      onChangeText: (next: string) => void;
      placeholder?: string;
      numeric?: boolean;
      unit?: string;
      maxLength?: number;
      error?: string | null;
    };

export type SettingsSection = {
  key: string;
  title?: string;
  /** Explains the section; shown under it in the platform's footnote style. */
  footer?: string;
  rows: readonly SettingsRow[];
};

export type SettingsListProps = { sections: readonly SettingsSection[] };

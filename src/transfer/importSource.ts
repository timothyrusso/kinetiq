/**
 * Where an import's text comes from: the clipboard (an AI chat's answer) or a file (an export,
 * or a file a harness saved). Both return the raw text, or null when the user backed out, and
 * leave every judgement about the contents to `parseRoutines`.
 */
import * as Clipboard from 'expo-clipboard';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';

import { IMPORT_LIMITS } from './format';

export class ImportTooLargeError extends Error {}

export async function readClipboard(): Promise<string> {
  return Clipboard.getStringAsync();
}

export async function copyToClipboard(text: string): Promise<void> {
  await Clipboard.setStringAsync(text);
}

export async function pickImportFile(): Promise<string | null> {
  const result = await DocumentPicker.getDocumentAsync({
    // JSON, plus plain text: an AI's answer saved from a chat is often a .txt.
    type: ['application/json', 'text/*'],
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (result.canceled) return null;
  const asset = result.assets[0];
  if (!asset) return null;
  if (typeof asset.size === 'number' && asset.size > IMPORT_LIMITS.bytes) throw new ImportTooLargeError();
  return new File(asset.uri).text();
}

import { Platform } from 'react-native';
import { apiText } from './api';
import { notify } from './dialogs';

// Downloading differs completely by platform: browsers get a Blob and a
// synthetic link click, native writes to the cache directory and opens the
// share sheet. Both are fed the same CSV text from the server.
const isWeb = Platform.OS === 'web';

async function saveWeb(filename, csv) {
  // The BOM is already in the payload; the charset here stops browsers
  // second-guessing the encoding.
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Revoking immediately can cancel the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

async function saveNative(filename, csv) {
  const { File, Paths } = require('expo-file-system');
  const Sharing = require('expo-sharing');

  const file = new File(Paths.cache, filename);
  try { file.create({ overwrite: true }); } catch { /* already exists */ }
  file.write(csv);

  if (!(await Sharing.isAvailableAsync())) {
    notify('Saved', `Saved to ${file.uri}`);
    return;
  }
  await Sharing.shareAsync(file.uri, {
    mimeType: 'text/csv',
    dialogTitle: 'Export expenses',
    UTI: 'public.comma-separated-values-text',
  });
}

// path: an API path returning CSV, e.g. /api/expenses/export?month=2026-07
export async function exportCsv(path, filename) {
  const csv = await apiText(path);
  if (isWeb) return saveWeb(filename, csv);
  return saveNative(filename, csv);
}

import { Platform, Alert, Share } from 'react-native';

// react-native-web ships Alert.alert as an empty function, so on the web build
// every confirmation would silently do nothing — you'd tap Delete and watch
// nothing happen. These helpers route to the browser's own dialogs instead.
const isWeb = Platform.OS === 'web';

export function confirmAction({ title, message, confirmLabel = 'OK', destructive = false, onConfirm }) {
  if (isWeb) {
    const text = [title, message].filter(Boolean).join('\n\n');
    if (typeof window !== 'undefined' && window.confirm(text)) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    { text: confirmLabel, style: destructive ? 'destructive' : 'default', onPress: onConfirm },
  ]);
}

export function notify(title, message) {
  if (isWeb) {
    if (typeof window !== 'undefined') window.alert([title, message].filter(Boolean).join('\n\n'));
    return;
  }
  Alert.alert(title, message);
}

// Web share needs navigator.share, which desktop browsers often lack and which
// rejects if the user dismisses the sheet. Falls back to the clipboard.
export async function shareText(message) {
  if (isWeb) {
    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({ text: message });
        return;
      }
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(message);
        notify('Copied', 'Copied to your clipboard.');
        return;
      }
      notify('Copy this', message);
    } catch { /* user dismissed the share sheet — nothing to do */ }
    return;
  }
  try {
    await Share.share({ message });
  } catch { /* user cancelled */ }
}

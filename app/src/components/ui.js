import React from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { colors } from '../theme';

export function Card({ children, style }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Title({ children, style }) {
  return <Text style={[styles.title, style]}>{children}</Text>;
}

export function Label({ children, style }) {
  return <Text style={[styles.label, style]}>{children}</Text>;
}

export function Field(props) {
  return (
    <TextInput
      placeholderTextColor={colors.muted}
      style={[styles.field, props.style]}
      {...props}
    />
  );
}

export function Button({ title, onPress, kind = 'primary', disabled, loading, style }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        kind === 'primary' && { backgroundColor: colors.accent },
        kind === 'ghost' && { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.border },
        kind === 'danger' && { backgroundColor: colors.danger },
        (disabled || loading) && { opacity: 0.5 },
        pressed && { opacity: 0.8 },
        style,
      ]}
    >
      {loading
        ? <ActivityIndicator color={colors.ink} />
        : <Text style={[styles.buttonText, kind === 'ghost' && { color: colors.secondary }]}>{title}</Text>}
    </Pressable>
  );
}

export function Segmented({ options, value, onChange }) {
  return (
    <View style={styles.segmented}>
      {options.map((opt) => (
        <Pressable
          key={opt.value}
          onPress={() => onChange(opt.value)}
          style={[styles.segment, value === opt.value && styles.segmentActive]}
        >
          <Text style={[styles.segmentText, value === opt.value && { color: colors.ink }]}>
            {opt.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

export function ErrorText({ children }) {
  if (!children) return null;
  return <Text style={styles.error}>{children}</Text>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 12,
  },
  title: { color: colors.ink, fontSize: 17, fontWeight: '600', marginBottom: 10 },
  label: { color: colors.muted, fontSize: 13, marginBottom: 4 },
  field: {
    backgroundColor: colors.page,
    color: colors.ink,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    marginBottom: 10,
  },
  button: {
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { color: colors.ink, fontSize: 15, fontWeight: '600' },
  segmented: {
    flexDirection: 'row',
    backgroundColor: colors.page,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 3,
    marginBottom: 12,
  },
  segment: { flex: 1, paddingVertical: 7, borderRadius: 8, alignItems: 'center' },
  segmentActive: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  segmentText: { color: colors.muted, fontSize: 13, fontWeight: '600' },
  error: { color: '#e66767', marginBottom: 10, fontSize: 13 },
});

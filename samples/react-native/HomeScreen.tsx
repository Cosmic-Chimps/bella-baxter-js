/**
 * HomeScreen.tsx — consumes secrets without knowing anything about BellaClient.
 *
 * useSecret(key, fallback) — single value, always a string
 * useSecrets()             — full state (map, loading, offline, refresh)
 */
import React from 'react';
import {
  ActivityIndicator,
  Button,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSecret, useSecrets } from '@bella-baxter/react-native';

export function HomeScreen() {
  const { loading, offline, fromCache, refresh } = useSecrets();

  // Single typed values — useSecret returns a plain string; parse as needed.
  const dbUrl = useSecret('DATABASE_URL', 'not set');
  const port = Number(useSecret('PORT', '8080'));
  const featureEnabled = useSecret('ENABLE_FEATURES', 'false') === 'true';
  const gleapKey = useSecret('GLEAP_API_KEY', '');

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
        <Text style={styles.hint}>Loading secrets…</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {offline && (
        <View style={[styles.banner, styles.offlineBanner]}>
          <Text style={styles.bannerText}>
            {fromCache
              ? '⚠️  No connectivity — showing cached secrets'
              : '⚠️  Could not reach Bella API — secrets may be stale'}
          </Text>
        </View>
      )}

      <Text style={styles.heading}>Bella Baxter — Typed Secrets</Text>

      <SecretRow label="DATABASE_URL" value={mask(dbUrl)} />
      <SecretRow label="PORT" value={String(port)} />
      <SecretRow label="ENABLE_FEATURES" value={String(featureEnabled)} />
      <SecretRow label="GLEAP_API_KEY" value={mask(gleapKey)} />

      <View style={styles.actions}>
        <Button title="Refresh now" onPress={refresh} />
      </View>
    </ScrollView>
  );
}

function SecretRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

function mask(v: string) {
  return v.length > 4 ? `${v.slice(0, 4)}***` : '***';
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  hint: { color: '#888', fontSize: 14 },
  container: { padding: 20, gap: 4 },
  heading: { fontSize: 18, fontWeight: '600', marginBottom: 16 },
  banner: { borderRadius: 8, padding: 10, marginBottom: 12 },
  offlineBanner: { backgroundColor: '#FFF3CD', borderColor: '#FFC107', borderWidth: 1 },
  bannerText: { color: '#856404', fontSize: 13 },
  row: { paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E5E5E5' },
  label: { fontFamily: 'monospace', fontSize: 12, color: '#888', marginBottom: 2 },
  value: { fontFamily: 'monospace', fontSize: 14 },
  actions: { marginTop: 24 },
});

/**
 * App.tsx — Root setup for Bella Baxter in a React Native app.
 *
 * One BellaProvider at the root. Every screen/component can call
 * useSecret() or useSecrets() without any prop-drilling.
 */
import React from 'react';
import { BaxterClient } from '@bella-baxter/sdk';
import {
  BellaProvider,
  EncryptedStorageSecretCache,
} from '@bella-baxter/react-native';

import { HomeScreen } from './HomeScreen';

// Credentials come from your build config / CI — never hardcoded.
// With react-native-dotenv: import { BELLA_BAXTER_API_KEY, BELLA_BAXTER_URL } from '@env';
const API_KEY = process.env['BELLA_BAXTER_API_KEY'] ?? '';
const BAXTER_URL = process.env['BELLA_BAXTER_URL'] ?? 'http://localhost:5522';

const client = new BaxterClient({ baxterUrl: BAXTER_URL, apiKey: API_KEY });
const cache = new EncryptedStorageSecretCache();

export default function App() {
  return (
    <BellaProvider
      client={client}
      projectSlug="my-app"        // your project slug
      environmentSlug="production" // your environment slug
      cache={cache}
      pollInterval={5 * 60 * 1000} // refresh every 5 min (default)
    >
      <HomeScreen />
    </BellaProvider>
  );
}

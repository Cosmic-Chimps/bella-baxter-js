/**
 * SecretCache — contract for encrypted local persistence.
 *
 * The package ships one concrete implementation: EncryptedStorageSecretCache
 * (backed by react-native-encrypted-storage → Keychain on iOS, Keystore on Android).
 *
 * You can plug in your own implementation for testing or custom backends.
 */
export interface SecretCache {
  read(): Promise<Record<string, string> | null>;
  write(secrets: Record<string, string>): Promise<void>;
  clear(): Promise<void>;
}

/**
 * Encrypted cache backed by react-native-encrypted-storage.
 *
 * - iOS   → Keychain (hardware-backed on devices with Secure Enclave)
 * - Android → Android Keystore (AES-256)
 *
 * Requires react-native-encrypted-storage as a peer dependency.
 * Install: `npm install react-native-encrypted-storage` + `npx pod-install`
 */
export class EncryptedStorageSecretCache implements SecretCache {
  constructor(private readonly storageKey = 'bella_baxter_secrets') {}

  async read(): Promise<Record<string, string> | null> {
    // Dynamic import so the package doesn't hard-fail if the peer isn't installed.
    const EncryptedStorage = await this._storage();
    const raw = await EncryptedStorage.getItem(this.storageKey);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as Record<string, string>;
    } catch {
      return null;
    }
  }

  async write(secrets: Record<string, string>): Promise<void> {
    const EncryptedStorage = await this._storage();
    await EncryptedStorage.setItem(this.storageKey, JSON.stringify(secrets));
  }

  async clear(): Promise<void> {
    const EncryptedStorage = await this._storage();
    await EncryptedStorage.removeItem(this.storageKey);
  }

  private async _storage() {
    try {
      const mod = await import('react-native-encrypted-storage');
      return mod.default ?? mod;
    } catch {
      throw new Error(
        '[BellaProvider] EncryptedStorageSecretCache requires react-native-encrypted-storage. ' +
          'Install it: npm install react-native-encrypted-storage && npx pod-install',
      );
    }
  }
}

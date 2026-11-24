// Port of bluetooth/BridgeCrypto.kt using WebCrypto (AES-256-GCM, key = SHA-256("eSkyTell::" + pin)).
export function generatePairingPin(): string {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return String(100000 + (a[0] % 900000));
}
async function deriveKey(pin: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`eSkyTell::${pin}`));
  return crypto.subtle.importKey('raw', digest, 'AES-GCM', false, ['encrypt', 'decrypt']);
}
const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
export async function encryptEnvelope(plain: string, pin: string): Promise<string> {
  try {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const enc = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv, tagLength: 128 }, await deriveKey(pin), new TextEncoder().encode(plain)));
    return JSON.stringify({ enc: 'AES-256-GCM', iv: b64(iv), data: b64(enc) });
  } catch { return plain; }
}
export async function decryptEnvelopeIfNeeded(raw: string, pin: string): Promise<string> {
  try {
    const root = JSON.parse(raw);
    if (root.enc !== 'AES-256-GCM') return raw;
    const out = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(root.iv), tagLength: 128 }, await deriveKey(pin), unb64(root.data));
    return new TextDecoder().decode(out);
  } catch { return raw; }
}

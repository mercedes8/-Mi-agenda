import * as Crypto from 'expo-crypto';
import { File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import * as LocalAuthentication from 'expo-local-authentication';
import { Alert } from 'react-native';
import { getSetting, setSetting } from './db';

/* ---------------- Contraseña ---------------- */

const toHex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');

async function hash(pw: string, salt: string) {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `${salt}:mi-agenda:${pw}`);
}

export const hasPassword = () => !!getSetting('lockHash', '');
export const bioEnabled = () => getSetting('lockBio', '0') === '1';
export const isLockEnabled = () => hasPassword() || bioEnabled();
/** Minutos en segundo plano antes de volver a bloquear (-1 = solo al abrir la app) */
export const lockAfterMinutes = () => Number(getSetting('lockAfter', '1'));

export async function setPassword(pw: string) {
  const salt = toHex(Crypto.getRandomBytes(16));
  setSetting('lockSalt', salt);
  setSetting('lockHash', await hash(pw, salt));
}
export async function checkPassword(pw: string) {
  const h = getSetting('lockHash', '');
  if (!h) return true;
  return (await hash(pw, getSetting('lockSalt', ''))) === h;
}
export function clearPassword() {
  setSetting('lockHash', '');
  setSetting('lockSalt', '');
}

/* ---------------- Huella / rostro ---------------- */

export async function bioAvailable() {
  try {
    return (await LocalAuthentication.hasHardwareAsync()) && (await LocalAuthentication.isEnrolledAsync());
  } catch {
    return false;
  }
}

/** Qué sensores tiene la tablet, para mostrar el texto correcto */
export async function bioLabel() {
  try {
    const t = await LocalAuthentication.supportedAuthenticationTypesAsync();
    const finger = t.includes(LocalAuthentication.AuthenticationType.FINGERPRINT);
    const face = t.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION);
    if (finger && face) return 'huella o rostro';
    if (face) return 'rostro';
    if (finger) return 'huella';
  } catch {}
  return 'huella o rostro';
}

export async function bioAuth() {
  try {
    const r = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Abrir Mi Agenda',
      cancelLabel: hasPassword() ? 'Usar contraseña' : 'Cancelar',
      // Sin contraseña propia, se permite el PIN/patrón de la tablet como alternativa
      disableDeviceFallback: hasPassword(),
      biometricsSecurityLevel: 'weak', // incluye el desbloqueo con la cámara (rostro) de Android
    });
    return r.success;
  } catch {
    return false;
  }
}

/** Para recuperar el acceso si se olvidó la contraseña: usa el bloqueo de pantalla de la tablet */
export async function deviceAuth() {
  try {
    const r = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Confirmá que sos vos con el bloqueo de la tablet',
      disableDeviceFallback: false,
      biometricsSecurityLevel: 'weak',
    });
    return r.success;
  } catch {
    return false;
  }
}

/* ---------------- Foto de portada ---------------- */

export async function pickCoverPhoto(source: 'gallery' | 'camera'): Promise<boolean> {
  const perm =
    source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    Alert.alert('Permiso', source === 'camera' ? 'Necesito permiso para usar la cámara.' : 'Necesito permiso para ver tus fotos.');
    return false;
  }
  const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], allowsEditing: true, aspect: [4, 5], quality: 0.85 };
  const res = source === 'camera' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
  if (res.canceled || !res.assets?.[0]) return false;
  try {
    const dest = new File(Paths.document, `portada_${Date.now()}.jpg`);
    await new File(res.assets[0].uri).copy(dest);
    removeCoverPhoto();
    setSetting('coverPhoto', dest.uri);
    return true;
  } catch (e) {
    Alert.alert('No se pudo guardar la foto', String(e));
    return false;
  }
}

export function removeCoverPhoto() {
  const old = getSetting('coverPhoto', '');
  if (old) {
    try {
      const f = new File(old);
      if (f.exists) f.delete();
    } catch {}
  }
  setSetting('coverPhoto', '');
}

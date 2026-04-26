import * as LocalAuthentication from "expo-local-authentication";

export const BIOMETRIC_ENABLED_KEY = "crx_biometric_enabled";

export async function isBiometricAvailable(): Promise<boolean> {
  try {
    const [hasHardware, isEnrolled] = await Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
    ]);
    return hasHardware && isEnrolled;
  } catch {
    return false;
  }
}

export async function authenticateWithBiometric(): Promise<boolean> {
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: "Unlock CreatorX",
      fallbackLabel: "Use PIN",
      cancelLabel: "Cancel",
      disableDeviceFallback: false,
    });
    return result.success;
  } catch {
    return false;
  }
}

export async function getBiometricType(): Promise<"face" | "fingerprint" | "none"> {
  try {
    const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
    if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) return "face";
    if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) return "fingerprint";
  } catch {
    return "none";
  }

  return "none";
}

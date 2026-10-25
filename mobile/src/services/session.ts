import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

// Refresh token lưu trong expo-secure-store (Keychain iOS / Keystore Android – PRD v1.0, mục 4.6.2, 15.1).
// Bản xem trước trên trình duyệt không có SecureStore nên dùng AsyncStorage (chỉ để phát triển).
const KEY = "auth.refreshToken";

export async function readRefreshToken(): Promise<string | null> {
  try {
    return Platform.OS === "web" ? await AsyncStorage.getItem(KEY) : await SecureStore.getItemAsync(KEY);
  } catch {
    return null;
  }
}

export async function saveRefreshToken(token: string): Promise<void> {
  if (Platform.OS === "web") await AsyncStorage.setItem(KEY, token);
  else await SecureStore.setItemAsync(KEY, token);
}

export async function clearRefreshToken(): Promise<void> {
  try {
    if (Platform.OS === "web") await AsyncStorage.removeItem(KEY);
    else await SecureStore.deleteItemAsync(KEY);
  } catch {
    // bỏ qua
  }
}

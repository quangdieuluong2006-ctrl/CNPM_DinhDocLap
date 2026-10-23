import { Redirect, useLocalSearchParams } from "expo-router";
import { useEffect } from "react";
import { store } from "../../state/store";

// Deep link từ mã QR in tại phòng: dinhdoclap://p/201 hoặc https://<web-user>/p/201 → mở điểm và phát ngay.
export default function DeepLink() {
  const { code } = useLocalSearchParams<{ code: string }>();
  useEffect(() => {
    const place = store.findPlace(code);
    if (place) store.play(place, "qr");
  }, [code]);
  return <Redirect href={`/place/${code}`} />;
}

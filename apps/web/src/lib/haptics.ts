/** 轻触觉反馈（移动可选） */
export function hapticLight() {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    navigator.vibrate(10);
  }
}

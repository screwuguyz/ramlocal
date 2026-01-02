// ============================================
// RAM Dosya Atama - Notification Utilities
// ============================================

import { logger } from "./logger";

export async function notifyTeacher(
  userKey: string,
  title: string,
  message: string,
  priority: number = 0
): Promise<void> {
  if (!userKey) return;
  try {
    const res = await fetch("/api/notify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userKey,
        title: title || "Yeni Dosya Atandı",
        message: message || "",
        priority,
      }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      logger.warn("notify failed", j);
    }
  } catch (e) {
    logger.warn("notify error", e);
  }
}


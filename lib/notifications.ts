// ============================================
// RAM Dosya Atama - Notification Utilities
// ============================================

import { logger } from "./logger";

// Send Pushover notification
async function sendPushover(
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
      logger.warn("pushover notify failed", j);
    }
  } catch (e) {
    logger.warn("pushover notify error", e);
  }
}

// Send PWA Web Push notification
async function sendWebPush(
  teacherId: string,
  title: string,
  message: string,
  url?: string
): Promise<void> {
  if (!teacherId) return;
  try {
    const res = await fetch("/api/push-send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        teacherId,
        title: title || "Yeni Dosya Atandı",
        message: message || "",
        url: url || "/",
      }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      logger.warn("web push failed", j);
    }
  } catch (e) {
    logger.warn("web push error", e);
  }
}

// Main notification function - sends both Pushover and Web Push
export async function notifyTeacher(
  userKey: string,
  title: string,
  message: string,
  priority: number = 0,
  teacherId?: string
): Promise<void> {
  // Send Pushover notification (if userKey provided)
  if (userKey) {
    await sendPushover(userKey, title, message, priority);
  }

  // Send Web Push notification (if teacherId provided)
  if (teacherId) {
    await sendWebPush(teacherId, title, message);
  }
}

// Send notification to multiple teachers (e.g. Announcements)
export async function notifyAllTeachers(
  teachers: { id: string; pushoverKey?: string | null }[],
  title: string,
  message: string,
  priority: number = 0
): Promise<void> {
  const keys = teachers
    .map((t) => t.pushoverKey)
    .filter((k): k is string => !!k && k.length > 5); // Basic validation

  // Send in parallel but catch errors individually
  await Promise.all(
    keys.map((key) => sendPushover(key, title, message, priority))
  );
}

// Export individual functions for direct use
export { sendPushover, sendWebPush };

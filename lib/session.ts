import type { SessionOptions } from "iron-session";

// Oturumda saklanacak verinin tipini burada tanımlıyoruz.
export type SessionData = {
  isAdmin: boolean;
};

// iron-session için yapılandırma ayarları.
export const sessionOptions: SessionOptions = {
  // Bu şifre en az 32 karakter olmalı ve bir ortam değişkeninde saklanmalıdır.
  // Örnek: openssl rand -base64 32 komutuyla bir şifre üretebilirsiniz.
  password: process.env.SECRET_COOKIE_PASSWORD as string,
  cookieName: "ram-dosya-atama-session",
  cookieOptions: {
    // secure: true sadece HTTPS üzerinde çalışır. Geliştirme ortamında false olabilir.
    secure: process.env.NODE_ENV === "production",
  },
};

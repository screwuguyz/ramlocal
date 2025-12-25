// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next.js 16'da eslint config artık burada desteklenmiyor
  // ESLint ayarları için eslint.config.mjs kullanılmalı
  
  // Production build optimizasyonları
  productionBrowserSourceMaps: false,
  
  // Chunk yükleme sorunlarını önlemek için
  onDemandEntries: {
    maxInactiveAge: 25 * 1000,
    pagesBufferLength: 2,
  },
};

export default nextConfig;

# Test Nasıl Çalışır?

## Test Altyapısı

Bu projede 3 tür test kullanılıyor:

### 1. Unit Testler (Vitest)
- **Amaç**: Tek fonksiyonların doğru çalıştığını test eder
- **Konum**: `tests/` klasörü
- **Çalıştırma**: `npm run test`

**Örnek Test:**
```typescript
// tests/lib/theme-simple.test.ts
describe('Basic Math Test', () => {
  it('should add numbers correctly', () => {
    expect(1 + 1).toBe(2);
  });
});
```

**Nasıl Çalışır:**
1. Vitest test dosyasını bulur (`*.test.ts` veya `*.spec.ts`)
2. `describe` ve `it` bloklarını çalıştırır
3. `expect` ile sonuçları kontrol eder
4. Başarılı/başarısız testleri raporlar

### 2. Integration Testler (Vitest)
- **Amaç**: API endpoint'lerinin çalıştığını test eder
- **Konum**: `tests/api/` klasörü
- **Çalıştırma**: `npm run test`

**Örnek Test:**
```typescript
// tests/api/state.test.ts
test('GET /api/state returns valid state', async () => {
  const response = await fetch('http://localhost:3000/api/state');
  const data = await response.json();
  expect(response.status).toBe(200);
  expect(data).toHaveProperty('teachers');
});
```

**Nasıl Çalışır:**
1. Gerçek API endpoint'ine istek gönderir
2. Yanıtı kontrol eder
3. Veri yapısını doğrular

### 3. E2E Testler (Playwright)
- **Amaç**: Kullanıcı akışlarını gerçek tarayıcıda test eder
- **Konum**: `e2e/` klasörü
- **Çalıştırma**: `npm run test:e2e`

**Örnek Test:**
```typescript
// e2e/theme.spec.ts
test('should toggle theme mode', async ({ page }) => {
  await page.goto('/');
  const themeToggle = page.locator('button:has-text("Açık")');
  await themeToggle.click();
  await page.waitForTimeout(500);
  const theme = await page.evaluate(() => {
    return document.documentElement.getAttribute('data-theme');
  });
  expect(theme).toBeTruthy();
});
```

**Nasıl Çalışır:**
1. Gerçek tarayıcı (Chrome/Firefox/Safari) açılır
2. Sayfaya gider (`page.goto('/')`)
3. Elementleri bulur ve tıklar
4. Sonuçları kontrol eder

## Test Komutları

```bash
# Tüm unit testleri çalıştır
npm run test

# Belirli bir test dosyası
npm run test -- tests/lib/theme-simple.test.ts

# Watch mode (değişiklikleri izler)
npm run test -- --watch

# Coverage raporu
npm run test:coverage

# E2E testler (dev server çalışıyor olmalı)
npm run test:e2e

# Tüm testler
npm run test:all
```

## Test Yazma Rehberi

### 1. Test Dosyası Oluştur
```typescript
// tests/myFunction.test.ts
import { describe, it, expect } from 'vitest';
import { myFunction } from '@/lib/myModule';

describe('myFunction', () => {
  it('should work correctly', () => {
    expect(myFunction('input')).toBe('expected');
  });
});
```

### 2. Test Çalıştır
```bash
npm run test -- tests/myFunction.test.ts
```

### 3. Sonuçları Kontrol Et
- ✅ Yeşil: Test başarılı
- ❌ Kırmızı: Test başarısız (hata mesajı gösterilir)

## Test Yapısı

```
tests/
├── setup.ts              # Test ortamı kurulumu
├── vitest-setup.ts       # CSS mock'ları
├── lib/
│   ├── theme.test.ts     # Tema fonksiyonları testleri
│   └── theme-simple.test.ts  # Basit test örneği
└── api/
    └── state.test.ts      # API endpoint testleri

e2e/
├── theme.spec.ts         # Tema E2E testleri
└── dashboard.spec.ts     # Dashboard E2E testleri
```

## Notlar

- Unit testler çok hızlıdır (milisaniyeler)
- E2E testler daha yavaştır (saniyeler)
- Testler CI/CD pipeline'ında otomatik çalıştırılabilir
- Coverage raporu `coverage/` klasöründe oluşturulur


## Test Altyapısı

Bu projede 3 tür test kullanılıyor:

### 1. Unit Testler (Vitest)
- **Amaç**: Tek fonksiyonların doğru çalıştığını test eder
- **Konum**: `tests/` klasörü
- **Çalıştırma**: `npm run test`

**Örnek Test:**
```typescript
// tests/lib/theme-simple.test.ts
describe('Basic Math Test', () => {
  it('should add numbers correctly', () => {
    expect(1 + 1).toBe(2);
  });
});
```

**Nasıl Çalışır:**
1. Vitest test dosyasını bulur (`*.test.ts` veya `*.spec.ts`)
2. `describe` ve `it` bloklarını çalıştırır
3. `expect` ile sonuçları kontrol eder
4. Başarılı/başarısız testleri raporlar

### 2. Integration Testler (Vitest)
- **Amaç**: API endpoint'lerinin çalıştığını test eder
- **Konum**: `tests/api/` klasörü
- **Çalıştırma**: `npm run test`

**Örnek Test:**
```typescript
// tests/api/state.test.ts
test('GET /api/state returns valid state', async () => {
  const response = await fetch('http://localhost:3000/api/state');
  const data = await response.json();
  expect(response.status).toBe(200);
  expect(data).toHaveProperty('teachers');
});
```

**Nasıl Çalışır:**
1. Gerçek API endpoint'ine istek gönderir
2. Yanıtı kontrol eder
3. Veri yapısını doğrular

### 3. E2E Testler (Playwright)
- **Amaç**: Kullanıcı akışlarını gerçek tarayıcıda test eder
- **Konum**: `e2e/` klasörü
- **Çalıştırma**: `npm run test:e2e`

**Örnek Test:**
```typescript
// e2e/theme.spec.ts
test('should toggle theme mode', async ({ page }) => {
  await page.goto('/');
  const themeToggle = page.locator('button:has-text("Açık")');
  await themeToggle.click();
  await page.waitForTimeout(500);
  const theme = await page.evaluate(() => {
    return document.documentElement.getAttribute('data-theme');
  });
  expect(theme).toBeTruthy();
});
```

**Nasıl Çalışır:**
1. Gerçek tarayıcı (Chrome/Firefox/Safari) açılır
2. Sayfaya gider (`page.goto('/')`)
3. Elementleri bulur ve tıklar
4. Sonuçları kontrol eder

## Test Komutları

```bash
# Tüm unit testleri çalıştır
npm run test

# Belirli bir test dosyası
npm run test -- tests/lib/theme-simple.test.ts

# Watch mode (değişiklikleri izler)
npm run test -- --watch

# Coverage raporu
npm run test:coverage

# E2E testler (dev server çalışıyor olmalı)
npm run test:e2e

# Tüm testler
npm run test:all
```

## Test Yazma Rehberi

### 1. Test Dosyası Oluştur
```typescript
// tests/myFunction.test.ts
import { describe, it, expect } from 'vitest';
import { myFunction } from '@/lib/myModule';

describe('myFunction', () => {
  it('should work correctly', () => {
    expect(myFunction('input')).toBe('expected');
  });
});
```

### 2. Test Çalıştır
```bash
npm run test -- tests/myFunction.test.ts
```

### 3. Sonuçları Kontrol Et
- ✅ Yeşil: Test başarılı
- ❌ Kırmızı: Test başarısız (hata mesajı gösterilir)

## Test Yapısı

```
tests/
├── setup.ts              # Test ortamı kurulumu
├── vitest-setup.ts       # CSS mock'ları
├── lib/
│   ├── theme.test.ts     # Tema fonksiyonları testleri
│   └── theme-simple.test.ts  # Basit test örneği
└── api/
    └── state.test.ts      # API endpoint testleri

e2e/
├── theme.spec.ts         # Tema E2E testleri
└── dashboard.spec.ts     # Dashboard E2E testleri
```

## Notlar

- Unit testler çok hızlıdır (milisaniyeler)
- E2E testler daha yavaştır (saniyeler)
- Testler CI/CD pipeline'ında otomatik çalıştırılabilir
- Coverage raporu `coverage/` klasöründe oluşturulur





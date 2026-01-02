# Test Altyapısı

Bu proje için kapsamlı bir test altyapısı kurulmuştur.

## Test Türleri

### 1. Unit Testler (Vitest)
- **Konum**: `tests/` klasörü
- **Amaç**: Tek fonksiyonların ve component'lerin izole test edilmesi
- **Örnek**: `tests/lib/theme.test.ts`

### 2. Integration Testler (Vitest)
- **Konum**: `tests/api/` klasörü
- **Amaç**: API endpoint'lerinin ve sistem bileşenlerinin birlikte test edilmesi
- **Örnek**: `tests/api/state.test.ts`

### 3. E2E Testler (Playwright)
- **Konum**: `e2e/` klasörü
- **Amaç**: Kullanıcı akışlarının gerçek tarayıcıda test edilmesi
- **Örnek**: `e2e/theme.spec.ts`, `e2e/dashboard.spec.ts`

## Komutlar

### Unit ve Integration Testler
```bash
# Tüm testleri çalıştır
npm run test

# UI modunda çalıştır (interaktif)
npm run test:ui

# Coverage raporu ile çalıştır
npm run test:coverage
```

### E2E Testler
```bash
# Tüm E2E testleri çalıştır
npm run test:e2e

# UI modunda çalıştır (interaktif)
npm run test:e2e:ui
```

### Tüm Testler
```bash
# Hem unit hem E2E testleri çalıştır
npm run test:all
```

## Test Yazma

### Unit Test Örneği
```typescript
import { describe, it, expect } from 'vitest';
import { myFunction } from '@/lib/myModule';

describe('myFunction', () => {
  it('should return expected value', () => {
    expect(myFunction('input')).toBe('expected');
  });
});
```

### E2E Test Örneği
```typescript
import { test, expect } from '@playwright/test';

test('should navigate to page', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('h1')).toBeVisible();
});
```

## Coverage

Coverage raporu `coverage/` klasöründe HTML formatında oluşturulur.

## Notlar

- Unit testler hızlı çalışır ve CI/CD pipeline'ında otomatik çalıştırılabilir
- E2E testler daha yavaştır ve gerçek tarayıcı gerektirir
- Test dosyaları `*.test.ts` veya `*.spec.ts` uzantısına sahip olmalıdır


Bu proje için kapsamlı bir test altyapısı kurulmuştur.

## Test Türleri

### 1. Unit Testler (Vitest)
- **Konum**: `tests/` klasörü
- **Amaç**: Tek fonksiyonların ve component'lerin izole test edilmesi
- **Örnek**: `tests/lib/theme.test.ts`

### 2. Integration Testler (Vitest)
- **Konum**: `tests/api/` klasörü
- **Amaç**: API endpoint'lerinin ve sistem bileşenlerinin birlikte test edilmesi
- **Örnek**: `tests/api/state.test.ts`

### 3. E2E Testler (Playwright)
- **Konum**: `e2e/` klasörü
- **Amaç**: Kullanıcı akışlarının gerçek tarayıcıda test edilmesi
- **Örnek**: `e2e/theme.spec.ts`, `e2e/dashboard.spec.ts`

## Komutlar

### Unit ve Integration Testler
```bash
# Tüm testleri çalıştır
npm run test

# UI modunda çalıştır (interaktif)
npm run test:ui

# Coverage raporu ile çalıştır
npm run test:coverage
```

### E2E Testler
```bash
# Tüm E2E testleri çalıştır
npm run test:e2e

# UI modunda çalıştır (interaktif)
npm run test:e2e:ui
```

### Tüm Testler
```bash
# Hem unit hem E2E testleri çalıştır
npm run test:all
```

## Test Yazma

### Unit Test Örneği
```typescript
import { describe, it, expect } from 'vitest';
import { myFunction } from '@/lib/myModule';

describe('myFunction', () => {
  it('should return expected value', () => {
    expect(myFunction('input')).toBe('expected');
  });
});
```

### E2E Test Örneği
```typescript
import { test, expect } from '@playwright/test';

test('should navigate to page', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('h1')).toBeVisible();
});
```

## Coverage

Coverage raporu `coverage/` klasöründe HTML formatında oluşturulur.

## Notlar

- Unit testler hızlı çalışır ve CI/CD pipeline'ında otomatik çalıştırılabilir
- E2E testler daha yavaştır ve gerçek tarayıcı gerektirir
- Test dosyaları `*.test.ts` veya `*.spec.ts` uzantısına sahip olmalıdır





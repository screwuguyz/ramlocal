# Testler Nasıl Çalışır? - Detaylı Açıklama

## 🎯 Test Nedir?

Test, yazdığınız kodun doğru çalıştığını otomatik olarak kontrol eden programlardır.

## 📋 Test Türleri

### 1. Unit Test (Birim Test)
**Ne test eder?** Tek bir fonksiyon veya küçük bir kod parçası

**Örnek:**
```typescript
// lib/utils.ts
export function add(a: number, b: number) {
  return a + b;
}

// tests/utils.test.ts
test('add function works', () => {
  expect(add(2, 3)).toBe(5);  // ✅ Başarılı
  expect(add(0, 0)).toBe(0);   // ✅ Başarılı
  expect(add(-1, 1)).toBe(0);  // ✅ Başarılı
});
```

**Nasıl çalışır?**
1. Test fonksiyonu çalışır: `add(2, 3)`
2. Sonuç kontrol edilir: `5` olmalı
3. Eğer `5` ise ✅, değilse ❌

### 2. Integration Test (Entegrasyon Testi)
**Ne test eder?** Birden fazla parçanın birlikte çalışması

**Örnek:**
```typescript
// API endpoint testi
test('GET /api/state returns data', async () => {
  // 1. API'ye istek gönder
  const response = await fetch('/api/state');
  
  // 2. Yanıtı kontrol et
  expect(response.status).toBe(200);
  
  // 3. Veriyi kontrol et
  const data = await response.json();
  expect(data.teachers).toBeArray();
});
```

**Nasıl çalışır?**
1. Gerçek API'ye istek gönderilir
2. Yanıt kontrol edilir
3. Veri yapısı doğrulanır

### 3. E2E Test (End-to-End Test)
**Ne test eder?** Kullanıcının yaptığı gibi tüm akış

**Örnek:**
```typescript
test('user can change theme', async ({ page }) => {
  // 1. Sayfaya git
  await page.goto('/');
  
  // 2. Tema butonunu bul ve tıkla
  await page.click('button:has-text("Koyu")');
  
  // 3. Tema değişti mi kontrol et
  const theme = await page.evaluate(() => {
    return document.documentElement.getAttribute('data-theme');
  });
  
  expect(theme).toBe('dark');
});
```

**Nasıl çalışır?**
1. Gerçek tarayıcı açılır (Chrome/Firefox)
2. Sayfa yüklenir
3. Buton tıklanır
4. Sonuç kontrol edilir

## 🔄 Test Çalıştırma Süreci

### Adım 1: Test Dosyası Bulunur
```
tests/lib/theme.test.ts  ✅ Bulundu
tests/api/state.test.ts   ✅ Bulundu
e2e/theme.spec.ts         ✅ Bulundu
```

### Adım 2: Testler Çalıştırılır
```
✓ Theme test 1 (2ms)
✓ Theme test 2 (1ms)
✓ API test 1 (50ms)
✓ E2E test 1 (200ms)
```

### Adım 3: Sonuçlar Raporlanır
```
Test Files:  3 passed (3)
Tests:       10 passed (10)
Time:        253ms
```

## 📊 Test Sonuçları

### ✅ Başarılı Test
```
✓ should add numbers correctly (1ms)
```

### ❌ Başarısız Test
```
✗ should add numbers correctly (2ms)
  Expected: 5
  Received: 6
```

## 🛠️ Test Yazma Adımları

### 1. Test Dosyası Oluştur
```typescript
// tests/myFunction.test.ts
import { test, expect } from 'vitest';
import { myFunction } from '@/lib/myModule';

test('myFunction works', () => {
  expect(myFunction('input')).toBe('output');
});
```

### 2. Test Çalıştır
```bash
npm run test -- tests/myFunction.test.ts
```

### 3. Sonucu Gör
```
✓ myFunction works (1ms)
```

## 💡 Neden Test Yazmalıyız?

1. **Hata Bulma**: Kod değişikliklerinde hataları erken bulur
2. **Güven**: Refactoring yaparken güven verir
3. **Dokümantasyon**: Kodun nasıl kullanılacağını gösterir
4. **Hız**: Manuel testten çok daha hızlıdır

## 🎓 Örnek Senaryo

**Senaryo:** Tema değiştirme özelliği

**Test:**
```typescript
test('tema değiştirme çalışıyor', () => {
  // 1. Başlangıç durumu
  setThemeMode('light');
  expect(getThemeMode()).toBe('light');
  
  // 2. Tema değiştir
  setThemeMode('dark');
  expect(getThemeMode()).toBe('dark');
  
  // 3. localStorage'da kaydedildi mi?
  expect(localStorage.getItem('site_theme_mode')).toBe('dark');
});
```

**Sonuç:**
- ✅ Tüm testler geçerse: Özellik çalışıyor
- ❌ Test başarısız olursa: Hata var, düzeltilmeli

## 📝 Özet

- **Unit Test**: Fonksiyonların doğru çalıştığını test eder
- **Integration Test**: Sistem parçalarının birlikte çalıştığını test eder  
- **E2E Test**: Kullanıcı deneyimini test eder
- **Test Çalıştırma**: `npm run test` komutu ile
- **Fayda**: Hataları erken bulur, güven verir, hızlandırır


## 🎯 Test Nedir?

Test, yazdığınız kodun doğru çalıştığını otomatik olarak kontrol eden programlardır.

## 📋 Test Türleri

### 1. Unit Test (Birim Test)
**Ne test eder?** Tek bir fonksiyon veya küçük bir kod parçası

**Örnek:**
```typescript
// lib/utils.ts
export function add(a: number, b: number) {
  return a + b;
}

// tests/utils.test.ts
test('add function works', () => {
  expect(add(2, 3)).toBe(5);  // ✅ Başarılı
  expect(add(0, 0)).toBe(0);   // ✅ Başarılı
  expect(add(-1, 1)).toBe(0);  // ✅ Başarılı
});
```

**Nasıl çalışır?**
1. Test fonksiyonu çalışır: `add(2, 3)`
2. Sonuç kontrol edilir: `5` olmalı
3. Eğer `5` ise ✅, değilse ❌

### 2. Integration Test (Entegrasyon Testi)
**Ne test eder?** Birden fazla parçanın birlikte çalışması

**Örnek:**
```typescript
// API endpoint testi
test('GET /api/state returns data', async () => {
  // 1. API'ye istek gönder
  const response = await fetch('/api/state');
  
  // 2. Yanıtı kontrol et
  expect(response.status).toBe(200);
  
  // 3. Veriyi kontrol et
  const data = await response.json();
  expect(data.teachers).toBeArray();
});
```

**Nasıl çalışır?**
1. Gerçek API'ye istek gönderilir
2. Yanıt kontrol edilir
3. Veri yapısı doğrulanır

### 3. E2E Test (End-to-End Test)
**Ne test eder?** Kullanıcının yaptığı gibi tüm akış

**Örnek:**
```typescript
test('user can change theme', async ({ page }) => {
  // 1. Sayfaya git
  await page.goto('/');
  
  // 2. Tema butonunu bul ve tıkla
  await page.click('button:has-text("Koyu")');
  
  // 3. Tema değişti mi kontrol et
  const theme = await page.evaluate(() => {
    return document.documentElement.getAttribute('data-theme');
  });
  
  expect(theme).toBe('dark');
});
```

**Nasıl çalışır?**
1. Gerçek tarayıcı açılır (Chrome/Firefox)
2. Sayfa yüklenir
3. Buton tıklanır
4. Sonuç kontrol edilir

## 🔄 Test Çalıştırma Süreci

### Adım 1: Test Dosyası Bulunur
```
tests/lib/theme.test.ts  ✅ Bulundu
tests/api/state.test.ts   ✅ Bulundu
e2e/theme.spec.ts         ✅ Bulundu
```

### Adım 2: Testler Çalıştırılır
```
✓ Theme test 1 (2ms)
✓ Theme test 2 (1ms)
✓ API test 1 (50ms)
✓ E2E test 1 (200ms)
```

### Adım 3: Sonuçlar Raporlanır
```
Test Files:  3 passed (3)
Tests:       10 passed (10)
Time:        253ms
```

## 📊 Test Sonuçları

### ✅ Başarılı Test
```
✓ should add numbers correctly (1ms)
```

### ❌ Başarısız Test
```
✗ should add numbers correctly (2ms)
  Expected: 5
  Received: 6
```

## 🛠️ Test Yazma Adımları

### 1. Test Dosyası Oluştur
```typescript
// tests/myFunction.test.ts
import { test, expect } from 'vitest';
import { myFunction } from '@/lib/myModule';

test('myFunction works', () => {
  expect(myFunction('input')).toBe('output');
});
```

### 2. Test Çalıştır
```bash
npm run test -- tests/myFunction.test.ts
```

### 3. Sonucu Gör
```
✓ myFunction works (1ms)
```

## 💡 Neden Test Yazmalıyız?

1. **Hata Bulma**: Kod değişikliklerinde hataları erken bulur
2. **Güven**: Refactoring yaparken güven verir
3. **Dokümantasyon**: Kodun nasıl kullanılacağını gösterir
4. **Hız**: Manuel testten çok daha hızlıdır

## 🎓 Örnek Senaryo

**Senaryo:** Tema değiştirme özelliği

**Test:**
```typescript
test('tema değiştirme çalışıyor', () => {
  // 1. Başlangıç durumu
  setThemeMode('light');
  expect(getThemeMode()).toBe('light');
  
  // 2. Tema değiştir
  setThemeMode('dark');
  expect(getThemeMode()).toBe('dark');
  
  // 3. localStorage'da kaydedildi mi?
  expect(localStorage.getItem('site_theme_mode')).toBe('dark');
});
```

**Sonuç:**
- ✅ Tüm testler geçerse: Özellik çalışıyor
- ❌ Test başarısız olursa: Hata var, düzeltilmeli

## 📝 Özet

- **Unit Test**: Fonksiyonların doğru çalıştığını test eder
- **Integration Test**: Sistem parçalarının birlikte çalıştığını test eder  
- **E2E Test**: Kullanıcı deneyimini test eder
- **Test Çalıştırma**: `npm run test` komutu ile
- **Fayda**: Hataları erken bulur, güven verir, hızlandırır





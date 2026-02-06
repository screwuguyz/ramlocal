# 🏠 RAM Dosya Atama - Vercel'den Yerel Sunucuya Geçiş Rehberi

Bu rehber, uygulamayı Vercel'den tamamen bağımsız hale getirip yerel bir Windows sunucuda çalıştırmak için **adım adım** talimatlar içerir.

---

## 📋 Önkoşullar

| Gereksinim | Açıklama |
|------------|----------|
| **Node.js 18+** | [nodejs.org](https://nodejs.org) adresinden LTS sürümü indirin |
| **Sabit IP Adresi** | Sunucu PC'nin ağ içinde sabit IP'si olmalı (örn: `192.168.1.100`) |
| **Windows 10/11** | Sunucu olarak kullanılacak PC |

---

## 🚀 Adım Adım Kurulum

### Adım 1: Projeyi Sunucu PC'ye Kopyala

1. Bu proje klasörünü USB veya ağ paylaşımı ile sunucu PC'ye kopyalayın
2. Örnek konum: `D:\ram-proje\`

> [!WARNING]
> Klasör yolunda **Türkçe karakter** veya **boşluk** kullanmayın!

---

### Adım 2: .env.local Dosyasını Yapılandır

1. Proje klasöründe `.env.local.example` dosyasını bulun
2. Bu dosyayı `.env.local` olarak kopyalayın:

```powershell
copy .env.local.example .env.local
```

3. `.env.local` dosyasını bir metin editörü ile açın ve aşağıdaki değerleri düzenleyin:

```env
# LOCAL MODE - Mutlaka true olmalı
LOCAL_MODE=true
NEXT_PUBLIC_LOCAL_MODE=true

# Admin Giriş Bilgileri - Bunları değiştirin!
ADMIN_EMAIL=admin@ramizmir.com
ADMIN_PASSWORD=GucluBirSifre123!
```

> [!IMPORTANT]
> `ADMIN_PASSWORD` değerini güçlü bir şifre ile değiştirin!

---

### Adım 3: Vercel'den Mevcut Verileri Export Et

Canlı sistemdeki verileri yerel sisteme aktarmak için:

1. **Tarayıcıda** şu adresi açın (Ctrl+Click ile açabilirsiniz):
   
   👉 **[https://ram-dosya-atama.vercel.app/api/state](https://ram-dosya-atama.vercel.app/api/state)**

2. Açılan sayfadaki **tüm JSON içeriğini** kopyalayın (Ctrl+A, Ctrl+C)

3. Proje klasöründe `data\state.json` dosyasını açın ve içeriğini yapıştırın (Ctrl+V)

4. Dosyayı kaydedin

> [!NOTE]
> `data\state.json` dosyası tüm öğretmen listesini, dosya geçmişini ve ayarları içerir.

---

### Adım 4: Bağımlılıkları Kur

Komut İstemi (CMD) veya PowerShell açın ve proje klasörüne gidin:

```powershell
cd D:\ram-proje

# Bağımlılıkları yükle (İnternet bağlantısı gerekir)
npm install
```

---

### Adım 5: Sunucuyu Başlat

#### Yöntem A: Otomatik Script (Önerilen)

Proje klasöründeki **`start-server.bat`** dosyasına çift tıklayın.

Bu script:
- Gerekli kontrolleri yapar
- Sunucuyu otomatik başlatır
- Yerel IP adreslerini gösterir
- Pencere açık kaldığı sürece sunucu çalışır

#### Yöntem B: Manuel Başlatma

```powershell
cd D:\ram-proje
npm run dev
```

Başarılı başlatma sonrası `Ready in ...` mesajını göreceksiniz.

---

### Adım 6: Erişimi Test Et

#### Sunucu PC'den Test:
```
http://localhost:3000
```

#### Diğer PC'lerden Test:
```
http://192.168.1.100:3000
```

> [!NOTE]
> `192.168.1.100` yerine sunucu PC'nin gerçek IP adresini yazın.  
> IP adresini öğrenmek için CMD'de `ipconfig` yazın.

---

### Adım 7: Windows Güvenlik Duvarı Ayarı

Diğer PC'lerin erişebilmesi için port 3000'i açın:

1. **Windows Defender Güvenlik Duvarı** uygulamasını açın
2. Sol menüden **"Gelişmiş Ayarlar"** seçin
3. **"Gelen Kurallar"** > **"Yeni Kural"** tıklayın
4. **"Port"** seçin > İleri
5. **TCP** ve **3000** yazın > İleri
6. **"Bağlantıya izin ver"** > İleri
7. Tüm profilleri işaretli bırakın > İleri
8. İsim: `RAM Dosya Atama Sunucu` > Son

---

## 🔄 Bilgisayar Açıldığında Otomatik Başlatma

### Task Scheduler ile Kurulum

1. **Görev Zamanlayıcı** (Task Scheduler) uygulamasını açın
2. Sağ panelden **"Temel Görev Oluştur"** seçin
3. Ayarlar:
   | Alan | Değer |
   |------|-------|
   | İsim | `RAM Dosya Atama Sunucu` |
   | Tetikleyici | Bilgisayar Oturum açıldığında |
   | Eylem | Program Başlat |
   | Program | `D:\ram-proje\start-server.bat` |
   | Başlat | `D:\ram-proje` |

4. **"En yüksek ayrıcalıklarla çalıştır"** seçeneğini işaretleyin

---

## 💾 Yedekleme Sistemi

### Otomatik Yedekler

Sistem, her gün saat 18:00'da otomatik yedek alır:
- Konum: `data\backups\`
- Format: `backup_2026-01-26.json`

### Manuel Yedekleme

Önemli değişikliklerden önce `data\` klasörünü kopyalayın:

```
data\
├── state.json      # Ana veri dosyası
├── backups\        # Otomatik yedekler
└── pdf\            # PDF takvim verileri
```

> [!CAUTION]
> `data\` klasörünü düzenli olarak harici bir disk veya ağ konumuna yedekleyin!

---

## 🛠️ Sorun Giderme

### Port 3000 Kullanımda Hatası

```powershell
# Portu kullanan işlemi sonlandır
npx kill-port 3000

# Sunucuyu yeniden başlat
start-server.bat
```

### Bağlantı Reddedildi

1. Sunucunun çalıştığını kontrol edin (Siyah CMD penceresi açık olmalı)
2. Güvenlik duvarı ayarlarını kontrol edin
3. IP adresinin doğru olduğunu kontrol edin (`ipconfig`)

### Veri Kayboldu

1. `data\backups\` klasöründen en son yedeği bulun
2. İçeriğini `data\state.json` dosyasına kopyalayın
3. Sayfayı yenileyin (F5)

### "Internal Server Error" Hatası

Eğer sunucu çalışıyor ama sayfada hata görüyorsanız:
1. CMD penceresini kapatın
2. Tekrar `start-server.bat` ile başlatın
3. Hata devam ederse `.next` klasörünü silip tekrar deneyin

---

## 📊 Sistem Durumu

| Bileşen | Durum | Açıklama |
|---------|-------|----------|
| Vercel | ❌ Gerekli Değil | Artık kullanılmıyor |
| Supabase | ❌ Gerekli Değil | LOCAL_MODE ile devre dışı |
| Node.js | ✅ Gerekli | Sunucu ortamı |
| İnternet | ⚠️ Kısmen | Sadece ilk kurulum (npm install) için |

---

## 🔒 Güvenlik Önerileri

1. **Şifre Güvenliği**: `.env.local` dosyasındaki şifreyi güçlü tutun
2. **Ağ İzolasyonu**: Sunucuyu sadece iç ağda erişilebilir tutun
3. **Düzenli Yedek**: Günlük yedekleri kontrol edin
4. **PC Güç Ayarları**: Sunucu PC'nin "Uyku Modu"nu kapatın

---

## 🆘 Hızlı Referans

| İşlem | Komut |
|-------|-------|
| Sunucuyu Başlat | `start-server.bat` çift tıkla |
| Manuel Başlat | `npm run dev` |
| IP Adresini Öğren | `ipconfig` |
| Portu Temizle | `npx kill-port 3000` |
| Veri Klasörü | `D:\ram-proje\data\` |

---

## ✅ Checklist

Kurulumu tamamladıktan sonra kontrol edin:

- [ ] `.env.local` dosyası oluşturuldu ve düzenlendi
- [ ] Vercel'den veriler `data\state.json`'a aktarıldı
- [ ] `start-server.bat` hatasız çalıştı
- [ ] Sunucu PC'den `localhost:3000` erişilebiliyor
- [ ] Diğer PC'lerden IP adresi ile erişilebiliyor
- [ ] Admin girişi çalışıyor
- [ ] Otomatik başlatma Task Scheduler'a eklendi
- [ ] Güvenlik duvarı port 3000'e izin veriyor
- [ ] Sunucu PC'nin uyku modu kapatıldı

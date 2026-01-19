# 🏠 RAM Dosya Atama - Local Sunucu Kurulum Rehberi

## Gereksinimler

- **Node.js 18+**: [nodejs.org](https://nodejs.org) adresinden indirin
- **Sabit IP**: Sunucu PC'nin IP adresi sabit olmalı

## Kurulum Adımları

### 1. Projeyi Sunucu PC'ye Kopyala

```bash
# USB veya ağ paylaşımı ile kopyala
# Örnek: D:\ram-dosya-atama
```

### 2. .env.local Dosyasını Oluştur

```bash
# .env.local.example dosyasını kopyala
copy .env.local.example .env.local

# Düzenle:
# - ADMIN_EMAIL ve ADMIN_PASSWORD değerlerini ayarla
# - LOCAL_MODE=true olduğundan emin ol
```

### 3. Supabase'den Veri Export Et

Canlı sistemden verileri almak için:
1. Tarayıcıdan `https://mevcut-adres.vercel.app/api/state` adresini aç
2. JSON'u kopyala
3. `data/state.json` dosyasına yapıştır

### 4. Sunucuyu Başlat

```bash
# Windows:
start-server.bat

# Veya manuel:
npm install
npm run build
npm run start
```

### 5. Erişimi Test Et

Diğer PC'lerden tarayıcıyla:
```
http://192.168.x.x:3000
```

## Windows Task Scheduler ile Otomatik Başlatma

1. Task Scheduler aç
2. "Create Basic Task" seç
3. Trigger: "When the computer starts"
4. Action: `D:\ram-dosya-atama\start-server.bat`
5. "Run whether user is logged on or not" seç

## Yedekleme

`data/` klasörünü düzenli olarak yedekle:
- `data/state.json` - Ana veri
- `data/backups/` - Otomatik yedekler
- `data/pdf/` - PDF randevuları

## Sorun Giderme

### Port kullanımda
```bash
npx kill-port 3000
npm run start
```

### Firewall
Windows Güvenlik Duvarı'nda 3000 portuna izin ver.

# Solana Sniper Bot

Bot untuk melakukan sniper terhadap token baru di Solana yang lulus dari Pump.fun.

## Fitur

- 🔍 Mendeteksi token yang baru lulus dari pump.fun secara real-time
- 📊 Menganalisis kualitas token berdasarkan berbagai parameter
- 🛡️ Integrasi dengan RugCheck API untuk analisis keamanan token
- 🚀 Membeli token berkualitas tinggi secara otomatis
- 📱 Mengirim notifikasi lengkap ke Telegram
- 💰 Manajemen posisi dengan take profit dan stop loss

## Instalasi

```bash
# Clone repository
git clone https://github.com/yourusername/solana-sniper-bot.git
cd solana-sniper-bot

# Install dependencies
npm install

# Build
npm run build
```

## Konfigurasi

Salin file `.env.example` menjadi `.env` dan sesuaikan pengaturan:

```bash
cp .env.example .env
```

### Konfigurasi Private Key Solana

Bot ini mendukung berbagai format private key Solana:

1. **Format Base58 (direkomendasikan)**: String base58 yang dienkode
2. **Format JSON Array**: Array numerik yang direpresentasikan sebagai string JSON
3. **Format Seed (32-byte)**: Seed untuk keypair (diproses dengan `fromSeed`)
4. **Format Secret Key (64-byte)**: Full secret key (diproses dengan `fromSecretKey`)

Untuk menghasilkan keypair baru, jalankan:

```bash
node generate-keypair.js
```

Script ini akan menghasilkan:
- Private key dalam format JSON Array
- Private key dalam format Base58
- Public key yang sesuai

### Konfigurasi RugCheck API

Bot ini terintegrasi dengan RugCheck API untuk mendapatkan analisis keamanan token yang lebih komprehensif. Untuk mengaktifkan fitur ini, tambahkan pengaturan berikut di file `.env`:

```
RUGCHECK_API_URL=https://api.rugcheck.xyz/v1
USE_RUGCHECK=true
```

### Konfigurasi Telegram

Bot ini dapat mengirimkan notifikasi ke Telegram. Untuk mengaktifkan fitur ini, tambahkan pengaturan berikut di file `.env`:

```
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_CHAT_ID=your_chat_id_here
```

## Notifikasi Telegram

Bot ini mengirimkan berbagai jenis notifikasi ke Telegram, termasuk:

- Notifikasi analisis token terdetail dengan data RugCheck
- Notifikasi pembelian token
- Notifikasi penjualan token
- Notifikasi error
- Update saldo

Untuk informasi lebih detail tentang format notifikasi, lihat [dokumentasi notifikasi Telegram](docs/telegram-notifications.md).

### Contoh Format Private Key yang Valid

**Contoh Base58:**
```
3oJ68rqoBvpA1pdrH5z3nFCK4fupDLTbxco3kBgyiQ2XdoGEmjgCevZJAfAkdM7b9rZeQodprjSim6BdY5QKbobT
```

**Contoh JSON Array:**
```
[139,244,236,39,149,205,167,79,105,148,80,241,235,4,22,239,39,26,39,227,228,70,14,50,88,235,110,59,233,181,134,101,138,80,29,7,194,55,246,139,255,249,108,196,148,142,167,124,150,63,105,179,176,77,79,98,242,72,193,77,48,181,132,150]
```

## Penggunaan

```bash
# Jalankan bot
npm start

# Jalankan test notifikasi Telegram
npx ts-node src/test/test-notifier.ts
```

## Troubleshooting

### Error "Invalid public key input"

Jika Anda melihat error ini, kemungkinan format private key Anda tidak valid. Pastikan Anda menggunakan salah satu format yang didukung dan private key tersebut valid.

Jalankan `node generate-keypair.js` untuk membuat keypair baru, lalu salin private key ke file `.env` Anda.

### Format Private Key yang Salah

Jika Anda mendapatkan error terkait format private key, pastikan:

1. Private key adalah string base58 yang valid, atau
2. Private key adalah array numerik dalam format JSON yang valid
3. Private key memiliki panjang yang benar (32 byte untuk seed, 64 byte untuk full secret key)

### Error RugCheck API

Jika Anda mengalami masalah dengan RugCheck API, pastikan:

1. URL API yang dikonfigurasi sudah benar
2. Koneksi internet Anda stabil
3. API RugCheck sedang online

Jika RugCheck API tidak tersedia, bot akan otomatis fallback ke analisis standar.

## Lisensi

MIT

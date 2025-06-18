# Changelog

## v1.0.2 - Integrasi RugCheck & Notifikasi Terdetail

### Peningkatan Utama
- **Integrasi RugCheck API**: Analisis keamanan token yang lebih komprehensif menggunakan data dari RugCheck
- **Format Notifikasi Telegram yang Ditingkatkan**: Notifikasi analisis token yang lebih terdetail dengan informasi RugCheck
- **Penanganan JSON Format yang Lebih Baik**: Dukungan untuk format JSON yang di-encode ganda pada event pump.fun

### Fitur Baru
- **Analisis Risiko Token**: Deteksi otomatis risiko token berdasarkan data RugCheck (rugged status, likuiditas, konsentrasi holder)
- **Caching Data RugCheck**: Implementasi caching untuk mengurangi panggilan API berlebihan
- **Notifikasi Terformat**: Format notifikasi Telegram yang lebih informatif dengan emoji dan data terstruktur

### Perbaikan Bug
- **Penanganan Format Data Event**: Perbaikan parsing untuk berbagai format data dari pump.fun
- **Validasi Field yang Lebih Baik**: Validasi yang lebih ketat untuk field yang diperlukan dalam event
- **Sanitasi Data Token**: Penanganan karakter non-ASCII dan non-printable pada data token
- **Error Handling yang Lebih Baik**: Penanganan error yang lebih robust untuk token dengan format data yang tidak standar
- **Konversi Tipe Data yang Aman**: Validasi dan konversi tipe data yang lebih aman untuk mencegah error parsing

### Dokumentasi
- **Dokumentasi Notifikasi Telegram**: Dokumentasi lengkap tentang format notifikasi Telegram
- **Panduan Konfigurasi RugCheck**: Instruksi untuk mengaktifkan dan mengkonfigurasi integrasi RugCheck
- **Test Script**: Penambahan script untuk menguji format notifikasi Telegram

## v1.0.1 - Perbaikan Format Private Key

### Peningkatan Utama
- **Dukungan Multi-Format Private Key**: Mendukung format base58, JSON array, dan seed 32-byte/64-byte
- **Validasi Keypair yang Lebih Baik**: Identifikasi otomatis panjang key (32-byte seed atau 64-byte full key)
- **Penanganan Error yang Lebih Baik**: Pesan error yang lebih jelas dan informatif

### Tools Baru
- **Generate Keypair Script**: Penambahan script `generate-keypair.js` untuk membantu pengguna membuat keypair baru dengan format yang benar

### Perbaikan Bug
- **Resolusi Error "Invalid public key input"**: Memperbaiki masalah validasi format private key yang menyebabkan error pada startup
- **Verifikasi Format Key**: Validasi otomatis format private key saat inisialisasi bot

### Dokumentasi
- **Panduan Format Private Key**: Dokumentasi lengkap tentang format private key yang didukung
- **Troubleshooting Guide**: Panduan pemecahan masalah untuk error umum yang terkait dengan private key
- **Contoh Format yang Valid**: Menambahkan contoh format private key yang valid untuk referensi pengguna

## v1.0.0 - Initial Release

- Implementasi dasar Solana Sniper Bot
- Koneksi WebSocket ke pump.fun untuk mendeteksi token yang baru lulus
- Analisis token berdasarkan berbagai metrik
- Eksekusi pembelian dan penjualan melalui Jupiter
- Notifikasi Telegram untuk semua aktivitas bot 
# Telegram Notifications

This document describes the various notification formats sent by the Solana Sniper Bot to Telegram.

## Detailed Token Analysis Notification

When a new token is detected and analyzed, a detailed notification is sent with the following format:

```
🚀 New Token Alert & Analysis Passed! 🚀

Token Address: D41ngcmQpoP5EnCTPm8J35LAXSUoDjJr5e6XudCrpump

Name: Launch on Twitch Chat
Symbol: LOTC
Description: N/A
Creator: 25bgLQGne3SPJ5yzCxaQ7hDWrHqdCVricgcDkDn2auT9
Market Cap (USD): $9,316.50

🔍 Analysis Details (Passed):

🛡️ RugCheck Summary:
  - Rugged Status: Not Marked Rugged
  - Overall Risk Level: NONE
  - Score: 24.001
  - Price (RC): 0
  - Total Liquidity (RC): $9,316.501
  - LP Locked Pct (RC): 100%
  - Mutable Metadata (RC): No
  - Mint Authority Enabled (RC): No
  - Freeze Authority Enabled (RC): No
  - Specific Risks/Warnings (RC):
    • Creator history of rugged tokens (Level: danger, Score: 24000): Creator has a history of rugging tokens.

-----------------------------------
```

If the token fails analysis, the notification will show "Analysis Failed!" instead.

### Risk Levels

The notification includes an overall risk level based on the RugCheck score:

- **NONE**: Score >= 0.7 (Low risk)
- **MEDIUM**: Score >= 0.4 and < 0.7 (Medium risk)
- **HIGH**: Score < 0.4 (High risk)

### Specific Risks

The notification lists specific risks detected by RugCheck, if any. Each risk includes:

- Risk name
- Risk level (danger, warning, info)
- Risk score impact
- Description of the risk

## Purchase Notification

When a token is purchased, a notification is sent with the following format:

```
✅ PEMBELIAN BERHASIL ✅

Token: [Token Name] ([Symbol])
Biaya: [Amount] SOL
Jumlah: [Quantity] [Symbol]

📈 Lihat Transaksi: [Solscan Link]
🔍 Token: [Solscan Link]
```

## Sale Notification

When a token is sold, a notification is sent with the following format:

```
🟢 PENJUALAN BERHASIL 🟢

Token: [Token Name] ([Symbol])
Jumlah: [Quantity] [Symbol]
Diterima: [Amount] SOL
Profit/Loss: +[Percent]% ([Amount] SOL)

📈 Lihat Transaksi: [Solscan Link]
```

For losses, the emoji will be 🔴 and the profit/loss will show negative values.

## Error Notification

When an error occurs, a notification is sent with the following format:

```
❌ ERROR ❌

Pesan: [Error Message]
Konteks: [JSON Context]
```

## Info Notification

For general information, a notification is sent with the following format:

```
ℹ️ INFO ℹ️

Pesan: [Info Message]
Detail: [JSON Details]
```

## Balance Update

When the wallet balance is updated, a notification is sent with the following format:

```
💰 UPDATE SALDO 💰

Saldo Saat Ini: [Balance] SOL
``` 
// Script untuk menghasilkan keypair Solana baru
// Jalankan dengan: node generate-keypair.js

const { Keypair } = require("@solana/web3.js");
const bs58 = require("bs58");

// Generate keypair baru
const keypair = Keypair.generate();

// Output dalam format JSON array untuk disimpan di .env
console.log("Private Key (JSON Array format):");
console.log(JSON.stringify(Array.from(keypair.secretKey)));

// Output dalam format Base58 untuk disimpan di .env
console.log("\nPrivate Key (Base58 format):");
console.log(bs58.encode(keypair.secretKey));

// Output public key
console.log("\nPublic Key:");
console.log(keypair.publicKey.toString());

console.log("\n--- Instruksi Penggunaan ---");
console.log("Salin salah satu format private key di atas (Base58 lebih pendek)");
console.log("dan update nilai SOLANA_PRIVATE_KEY di file .env Anda."); 
import { Keypair, PublicKey, Connection } from '@solana/web3.js';
import bs58 from 'bs58';
import { config } from '../config/env';
import logger from './logger';

/**
 * Mendapatkan instance Keypair dari private key
 */
export const getKeypairFromPrivateKey = (): Keypair => {
  try {
    const raw = config.solana.privateKey;
    if (!raw) throw new Error("SOLANA_PRIVATE_KEY belum diset di .env");

    let secret: Uint8Array;
    try {
      // 1) JSON array string "[12,34,…]"
      if (raw.trim().startsWith("[")) {
        const arr = JSON.parse(raw) as number[];
        secret = Uint8Array.from(arr);
      }
      // 2) Base58 encoded
      else {
        secret = bs58.decode(raw.trim());
      }
    } catch (err) {
      throw new Error("Failed parsing SOLANA_PRIVATE_KEY: " + err);
    }

    if (secret.length === 64) {
      // format standard: [private(32) | public(32)]
      return Keypair.fromSecretKey(secret);
    } else if (secret.length === 32) {
      // hanya seed
      return Keypair.fromSeed(secret);
    } else {
      throw new Error(
        `Invalid secret key size: ${secret.length} bytes. ` +
        `Harus 32 (seed-only) atau 64 (full secret+pubkey).`
      );
    }
  } catch (error: any) {
    logger.error(`Failed to create keypair from private key: ${error}`);
    throw new Error(`Invalid private key format: ${error.message || String(error)}`);
  }
};

/**
 * Mendapatkan instance Connection untuk Solana
 */
export const getSolanaConnection = (): Connection => {
  return new Connection(config.solana.rpcUrl, 'confirmed');
};

/**
 * Mendapatkan saldo SOL dari alamat wallet
 */
export const getSolBalance = async (
  connection: Connection, 
  publicKey: PublicKey
): Promise<number> => {
  try {
    const balance = await connection.getBalance(publicKey);
    return balance / 1e9; // Convert lamports ke SOL
  } catch (error) {
    logger.error(`Error fetching SOL balance: ${error}`);
    return 0;
  }
};

/**
 * Memverifikasi apakah string adalah alamat public key yang valid
 */
export const isValidPublicKey = (address: string): boolean => {
  try {
    new PublicKey(address);
    return true;
  } catch (error) {
    return false;
  }
};

/**
 * Konversi SOL ke lamports
 */
export const solToLamports = (sol: number): number => {
  return Math.floor(sol * 1e9);
};

/**
 * Konversi lamports ke SOL
 */
export const lamportsToSol = (lamports: number): number => {
  return lamports / 1e9;
}; 
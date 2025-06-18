import { PublicKey } from '@solana/web3.js';

// Tipe data untuk event dari pump.fun
export interface PumpFunGraduatedEvent {
  coinMint: string;  // Token mint address
  symbol: string;    // Token symbol
  name: string;      // Token name
  coinAta: string;   // Token associated token account
  lpMint: string;    // Liquidity pool mint address
  numHolders: number; // Jumlah pemegang token
  price: number;     // Harga token dalam SOL
  marketCap: number; // Market cap dalam SOL
  coinSupply: number; // Total supply token
  sniperCount: number; // Jumlah bot sniper
  website?: string;  // Website token (opsional)
  twitter?: string;  // Twitter token (opsional)
  telegram?: string; // Telegram token (opsional)
  discord?: string;  // Discord token (opsional)
  
  // Properti tambahan dari format JSON baru
  devHoldingsPercentage: string; // Persentase token yang dipegang oleh developer
  imageUrl: string;             // URL gambar token
  creationTime: number;         // Waktu pembuatan token (timestamp)
  graduationDate: number;       // Waktu token lulus (timestamp)
  volume: number;               // Volume perdagangan
  holders: Array<{              // Array pemegang token
    holderId: string;           // Alamat pemegang
    ownedPercentage: number;    // Persentase token yang dipegang
    totalTokenAmountHeld: number; // Jumlah token yang dipegang
    isSniper: boolean;          // Apakah pemegang adalah sniper
  }>;
}

// Tipe data untuk hasil analisis token
export interface TokenAnalysisResult {
  tokenMint: string;
  tokenSymbol: string;
  tokenName: string;
  score: number;
  buyDecision: boolean;
  factors: {
    name: string;
    score: number;
    explanation: string;
  }[];
}

// Tipe data untuk posisi token
export interface TokenPosition {
  tokenMint: string;
  tokenSymbol: string;
  tokenName: string;
  purchaseAmount: number; // dalam SOL
  purchasePrice: number;
  purchaseTimestamp: number;
  quantity: number;
  currentPrice?: number;
  currentValue?: number;
  profitLoss?: number;
  profitLossPercent?: number;
  stopLossPrice: number;
  takeProfitPrice: number;
}

// Tipe data untuk hasil pembelian
export interface PurchaseResult {
  success: boolean;
  tokenMint: string;
  tokenSymbol: string;
  tokenName: string;
  amountSpent: number; // dalam SOL
  tokenAmount: number;
  transactionId?: string;
  error?: string;
}

// Tipe data untuk hasil penjualan
export interface SellResult {
  success: boolean;
  tokenMint: string;
  tokenSymbol: string;
  tokenName: string;
  amountReceived: number; // dalam SOL
  tokenAmount: number;
  profitLoss: number;
  profitLossPercent: number;
  transactionId?: string;
  error?: string;
}

// Tipe notifikasi yang dikirim ke Telegram
export enum NotificationType {
  ANALYSIS = 'ANALYSIS',
  PURCHASE = 'PURCHASE',
  SALE = 'SALE',
  ERROR = 'ERROR',
  BALANCE = 'BALANCE',
  INFO = 'INFO',
}

// Service interfaces
export interface IListener {
  start(): Promise<void>;
  stop(): void;
  onGraduatedEvent(callback: (event: PumpFunGraduatedEvent) => void): void;
}

export interface IAnalyzer {
  analyzeToken(event: PumpFunGraduatedEvent): Promise<TokenAnalysisResult>;
}

export interface IExecutor {
  buyToken(tokenMint: string, amountInSol: number): Promise<PurchaseResult>;
  sellToken(tokenMint: string, tokenAmount: number): Promise<SellResult>;
}

export interface IPositionManager {
  addPosition(position: TokenPosition): void;
  removePosition(tokenMint: string): void;
  getPosition(tokenMint: string): TokenPosition | undefined;
  getAllPositions(): TokenPosition[];
  startMonitoring(): void;
  stopMonitoring(): void;
}

export interface INotifier {
  sendAnalysisNotification(result: TokenAnalysisResult): Promise<void>;
  sendPurchaseNotification(result: PurchaseResult): Promise<void>;
  sendSaleNotification(result: SellResult): Promise<void>;
  sendErrorNotification(error: string, context?: any): Promise<void>;
  sendInfoNotification(message: string, context?: any): Promise<void>;
  sendBalanceUpdate(balance: number): Promise<void>;
} 
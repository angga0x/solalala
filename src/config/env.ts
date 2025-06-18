import dotenv from 'dotenv';
import { LoggerOptions } from 'pino';

// Load environment variables
dotenv.config();

// Helper function to get required env variables
const getRequiredEnv = (key: string): string => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Environment variable ${key} is required but not set`);
  }
  return value;
};

// Helper function to get optional env variables with default
const getOptionalEnv = <T>(key: string, defaultValue: T, parser?: (value: string) => T): T => {
  const value = process.env[key];
  if (!value) {
    return defaultValue;
  }
  return parser ? parser(value) : (value as unknown as T);
};

// Extended logger options yang mencakup prettyPrint
interface ExtendedLoggerOptions extends LoggerOptions {
  prettyPrint: boolean;
}

// Environment configuration
export const config = {
  solana: {
    rpcUrl: getRequiredEnv('SOLANA_RPC_URL'),
    privateKey: getRequiredEnv('SOLANA_PRIVATE_KEY'),
    heliusApiKey: getRequiredEnv('HELIUS_API_KEY'),
  },
  bot: {
    investmentAmountSol: getOptionalEnv('INVESTMENT_AMOUNT_SOL', 0.1, parseFloat),
    maxSlippagePercent: getOptionalEnv('MAX_SLIPPAGE_PERCENT', 1, parseFloat),
    priorityFeeLamports: getOptionalEnv('PRIORITY_FEE_LAMPORTS', 1000000, parseInt),
    takeProfitPercent: getOptionalEnv('TAKE_PROFIT_PERCENT', 50, parseFloat),
    stopLossPercent: getOptionalEnv('STOP_LOSS_PERCENT', 20, parseFloat),
  },
  pumpfun: {
    websocketUrl: getOptionalEnv('PUMPFUN_WEBSOCKET_URL', 'wss://prod-advanced.nats.realtime.pump.fun/'),
  },
  telegram: {
    botToken: getRequiredEnv('TELEGRAM_BOT_TOKEN'),
    chatId: getRequiredEnv('TELEGRAM_CHAT_ID'),
  },
  analysis: {
    minScoreToBuy: getOptionalEnv('MIN_SCORE_TO_BUY', 20, parseInt),
    maxDevHoldingPercent: getOptionalEnv('MAX_DEV_HOLDING_PERCENT', 15, parseFloat),
    minHoldersCount: getOptionalEnv('MIN_HOLDERS_COUNT', 150, parseInt),
    useRugCheck: getOptionalEnv('USE_RUGCHECK', true, (v) => v === 'true'),
  },
  rugcheck: {
    apiUrl: getOptionalEnv('RUGCHECK_API_URL', 'https://api.rugcheck.xyz/v1'),
    cacheTimeoutMs: getOptionalEnv('RUGCHECK_CACHE_TIMEOUT_MS', 5 * 60 * 1000, parseInt),
    minLiquidityUsd: getOptionalEnv('RUGCHECK_MIN_LIQUIDITY_USD', 5000, parseFloat),
    maxTopHoldersPct: getOptionalEnv('RUGCHECK_MAX_TOP_HOLDERS_PCT', 80, parseFloat),
    minScore: getOptionalEnv('RUGCHECK_MIN_SCORE', 0.7, parseFloat),
  },
  logger: {
    level: getOptionalEnv('LOG_LEVEL', 'info'),
    prettyPrint: getOptionalEnv('LOG_PRETTY_PRINT', true, (v) => v === 'true'),
  } as ExtendedLoggerOptions,
};

export default config; 
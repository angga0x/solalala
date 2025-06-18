import { Connection, PublicKey } from '@solana/web3.js';
import { config } from './config/env';
import logger from './utils/logger';
import { PumpFunListener } from './core/pump-fun-listener';
import { TokenAnalyzer } from './core/token-analyzer';
import { TokenExecutor } from './core/token-executor';
import { PositionManager } from './core/position-manager';
import { TelegramNotifier } from './services/telegram-notifier';
import { EventLoggerServer } from './services/event-logger-server';
import { PumpFunGraduatedEvent, TokenPosition } from './types';
import { getKeypairFromPrivateKey, getSolBalance } from './utils/wallet';
import { RugCheckAnalyzer } from './services/rugcheck-analyzer';

// Banner saat startup
const displayBanner = () => {
  const bannerText = `
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║             SOLANA SNIPER BOT - VERSI 1.0.0               ║
║                                                           ║
║  [🔍] Mendeteksi token yang baru lulus dari pump.fun      ║
║  [📊] Menganalisis kualitas token secara real-time         ║
║  [🚀] Membeli token berkualitas tinggi secara otomatis     ║
║  [📱] Mengirim notifikasi lengkap ke Telegram             ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
  `;
  console.log(bannerText);
};

// Fungsi utama
const main = async () => {
  try {
    // Tampilkan banner
    displayBanner();

    // Inisialisasi komponen
    logger.info('Initializing bot components...');

    // Inisialisasi koneksi dan wallet
    const connection = new Connection(config.solana.rpcUrl, 'confirmed');
    
    // Dapatkan keypair dari private key dan extract public key
    const keypair = getKeypairFromPrivateKey();
    const walletPublicKey = keypair.publicKey;
    
    logger.info(`Using wallet: ${walletPublicKey.toString()}`);

    // Inisialisasi notifier (prioritas pertama untuk debug dan log)
    const notifier = new TelegramNotifier();

    // Inisialisasi komponen lainnya
    const listener = new PumpFunListener();
    const analyzer = new TokenAnalyzer();
    const executor = new TokenExecutor();
    const positionManager = new PositionManager(executor, notifier);
    const rugCheckAnalyzer = new RugCheckAnalyzer();
    
    // Inisialisasi dan mulai event logger server
    const eventLoggerServer = new EventLoggerServer(listener, 3002);
    eventLoggerServer.start();
    logger.info('Event logger server started at http://localhost:3002');

    // Register event handler untuk token yang lulus
    listener.onGraduatedEvent(async (event: PumpFunGraduatedEvent) => {
      try {
        // Sanitize and validate the event data
        const safeSymbol = event.symbol ? 
          event.symbol.replace(/[^\x00-\x7F]/g, '?').trim().substring(0, 20) : 'unknown';
        const safeName = event.name ? 
          event.name.replace(/[^\x00-\x7F]/g, '?').trim().substring(0, 50) : 'unknown';
        
        logger.info(`Token graduated event received for ${safeSymbol} (${event.coinMint})`);
        
        // Validate required fields
        if (!event.coinMint) {
          throw new Error('Event missing required field: coinMint');
        }
        
        // Analisis token
        const analysisResult = await analyzer.analyzeToken(event);
        
        // Fetch RugCheck data if enabled
        let rugCheckData = null;
        if (config.analysis.useRugCheck) {
          try {
            rugCheckData = await rugCheckAnalyzer.getTokenData(event.coinMint);
          } catch (error) {
            logger.error(`Error fetching RugCheck data for ${safeSymbol}: ${error}`);
          }
        }
        
        // Calculate market cap in USD if possible
        let marketCapUsd = null;
        if (typeof event.marketCap === 'number' && !isNaN(event.marketCap)) {
          marketCapUsd = event.marketCap;
        }
        
        // Send detailed notification with RugCheck data if available
        await notifier.sendDetailedAnalysisNotification(
          analysisResult, 
          rugCheckData || undefined, 
          marketCapUsd || undefined
        );
        
        // Jika keputusan adalah untuk membeli, lakukan pembelian
        if (analysisResult.buyDecision) {
          logger.info(`Executing buy for ${safeSymbol} (${event.coinMint})`);
          
          // Eksekusi pembelian
          const purchaseResult = await executor.buyToken(
            event.coinMint, 
            config.bot.investmentAmountSol
          );
          
          // Kirim notifikasi pembelian
          await notifier.sendPurchaseNotification(purchaseResult);
          
          // Jika pembelian berhasil, tambahkan ke position manager
          if (purchaseResult.success) {
            // Hitung harga untuk take profit dan stop loss
            const entryPrice = purchaseResult.amountSpent / purchaseResult.tokenAmount;
            const takeProfitPrice = entryPrice * (1 + config.bot.takeProfitPercent / 100);
            const stopLossPrice = entryPrice * (1 - config.bot.stopLossPercent / 100);
            
            // Tambahkan posisi ke manager
            const position: TokenPosition = {
              tokenMint: purchaseResult.tokenMint,
              tokenSymbol: purchaseResult.tokenSymbol,
              tokenName: purchaseResult.tokenName,
              purchaseAmount: purchaseResult.amountSpent,
              purchasePrice: entryPrice,
              purchaseTimestamp: Date.now(),
              quantity: purchaseResult.tokenAmount,
              takeProfitPrice,
              stopLossPrice
            };
            
            positionManager.addPosition(position);
          }
        }
      } catch (error) {
        // Get safe symbol for error reporting
        const safeSymbol = event && event.symbol ? 
          event.symbol.replace(/[^\x00-\x7F]/g, '?').trim().substring(0, 20) : 'unknown';
          
        logger.error(`Error processing token ${safeSymbol}: ${error}`);
        await notifier.sendErrorNotification(`Error memproses token ${safeSymbol}`, {
          error: String(error),
          tokenMint: event?.coinMint || 'unknown'
        });
      }
    });

    // Mulai position manager
    positionManager.startMonitoring();

    // Kirim notifikasi bahwa bot telah dimulai
    const solBalance = await getSolBalance(connection, walletPublicKey);
    await notifier.sendBalanceUpdate(solBalance);
    await notifier.sendInfoNotification('Bot telah dimulai', { 
      timestamp: new Date().toISOString(),
      walletAddress: walletPublicKey.toString(),
      eventLoggerUrl: 'http://localhost:3002'
    });

    // Set interval untuk mengirim update saldo berkala (setiap 6 jam)
    setInterval(async () => {
      const currentBalance = await getSolBalance(connection, walletPublicKey);
      await notifier.sendBalanceUpdate(currentBalance);
    }, 6 * 60 * 60 * 1000);

    // Mulai listener sebagai langkah terakhir
    await listener.start();
    logger.info('Bot is now running and listening for token graduations');

  } catch (error) {
    logger.error(`Fatal error: ${error}`);
    process.exit(1);
  }
};

// Handle exit signals
process.on('SIGINT', () => {
  logger.info('Received SIGINT signal, shutting down gracefully');
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('Received SIGTERM signal, shutting down gracefully');
  process.exit(0);
});

// Error handling untuk uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error(`Uncaught exception: ${error}`);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error(`Unhandled promise rejection at: ${promise}, reason: ${reason}`);
  process.exit(1);
});

// Jalankan fungsi utama
main().catch((error) => {
  logger.error(`Initialization error: ${error}`);
  process.exit(1);
}); 
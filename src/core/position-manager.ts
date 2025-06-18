import axios from 'axios';
import { config } from '../config/env';
import logger from '../utils/logger';
import { 
  TokenPosition, 
  IPositionManager,
  IExecutor,
  INotifier
} from '../types';

export class PositionManager implements IPositionManager {
  private positions: Map<string, TokenPosition> = new Map();
  private monitoringInterval: NodeJS.Timeout | null = null;
  private monitoringFrequencyMs: number = 30000; // 30 detik
  private jupiterPriceApiUrl = 'https://price.jup.ag/v6/price';

  constructor(
    private readonly executor: IExecutor,
    private readonly notifier: INotifier
  ) {
    logger.info('Position Manager initialized');
  }

  addPosition(position: TokenPosition): void {
    this.positions.set(position.tokenMint, position);
    logger.info({
      tokenMint: position.tokenMint,
      tokenSymbol: position.tokenSymbol,
      purchaseAmount: position.purchaseAmount,
      quantity: position.quantity
    }, 'Position added');
  }

  removePosition(tokenMint: string): void {
    if (this.positions.has(tokenMint)) {
      this.positions.delete(tokenMint);
      logger.info(`Position removed for token: ${tokenMint}`);
    } else {
      logger.warn(`Attempted to remove non-existent position: ${tokenMint}`);
    }
  }

  getPosition(tokenMint: string): TokenPosition | undefined {
    return this.positions.get(tokenMint);
  }

  getAllPositions(): TokenPosition[] {
    return Array.from(this.positions.values());
  }

  startMonitoring(): void {
    if (this.monitoringInterval) {
      logger.warn('Position monitoring is already running');
      return;
    }

    logger.info('Starting position monitoring');
    
    // Segera jalankan pemeriksaan pertama
    this.checkPositions();
    
    // Set interval untuk pemeriksaan berkala
    this.monitoringInterval = setInterval(() => this.checkPositions(), this.monitoringFrequencyMs);
  }

  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      logger.info('Position monitoring stopped');
    }
  }

  // Method untuk memeriksa semua posisi yang aktif
  private async checkPositions(): Promise<void> {
    if (this.positions.size === 0) {
      logger.debug('No positions to check');
      return;
    }

    logger.info(`Checking ${this.positions.size} open positions`);

    for (const position of this.positions.values()) {
      try {
        // Dapatkan harga terkini
        const currentPrice = await this.getCurrentPrice(position.tokenMint);
        
        if (currentPrice === null) {
          logger.warn(`Could not get current price for ${position.tokenSymbol} (${position.tokenMint})`);
          continue;
        }

        // Update posisi dengan harga terkini
        this.updatePositionWithCurrentPrice(position, currentPrice);

        // Periksa jika perlu menjual (take profit atau stop loss)
        await this.checkSellConditions(position);
      } catch (error) {
        logger.error(`Error checking position for ${position.tokenSymbol}: ${error}`);
      }
    }
  }

  // Update posisi dengan harga terkini
  private updatePositionWithCurrentPrice(position: TokenPosition, currentPrice: number): void {
    const previousPrice = position.currentPrice;
    
    position.currentPrice = currentPrice;
    position.currentValue = position.quantity * currentPrice;
    position.profitLoss = position.currentValue - position.purchaseAmount;
    position.profitLossPercent = (position.profitLoss / position.purchaseAmount) * 100;

    // Log perubahan signifikan
    if (previousPrice && Math.abs(currentPrice - previousPrice) / previousPrice > 0.05) {
      const direction = currentPrice > previousPrice ? 'up' : 'down';
      const changePercent = Math.abs(currentPrice - previousPrice) / previousPrice * 100;
      
      logger.info({
        tokenMint: position.tokenMint,
        tokenSymbol: position.tokenSymbol,
        direction,
        changePercent: changePercent.toFixed(2),
        oldPrice: previousPrice,
        newPrice: currentPrice,
        profitLossPercent: position.profitLossPercent?.toFixed(2)
      }, `Token price moved ${direction} by ${changePercent.toFixed(2)}%`);
    }
  }

  // Periksa kondisi untuk menjual (take profit atau stop loss)
  private async checkSellConditions(position: TokenPosition): Promise<void> {
    if (!position.currentPrice) {
      return;
    }

    const { tokenMint, tokenSymbol, tokenName, quantity, currentPrice, profitLossPercent } = position;

    // Periksa take profit
    if (currentPrice >= position.takeProfitPrice) {
      logger.info(`Take profit triggered for ${tokenSymbol} at ${currentPrice}`);
      
      try {
        await this.sellToken(position, 'TAKE_PROFIT');
      } catch (error) {
        logger.error(`Failed to execute take profit for ${tokenSymbol}: ${error}`);
      }
      return;
    }

    // Periksa stop loss
    if (currentPrice <= position.stopLossPrice) {
      logger.info(`Stop loss triggered for ${tokenSymbol} at ${currentPrice}`);
      
      try {
        await this.sellToken(position, 'STOP_LOSS');
      } catch (error) {
        logger.error(`Failed to execute stop loss for ${tokenSymbol}: ${error}`);
      }
      return;
    }

    // Log status saat ini
    logger.debug({
      tokenSymbol,
      currentPrice,
      takeProfitPrice: position.takeProfitPrice,
      stopLossPrice: position.stopLossPrice,
      profitLossPercent: profitLossPercent?.toFixed(2)
    }, 'Position status');
  }

  // Metode untuk menjual token berdasarkan posisi
  private async sellToken(position: TokenPosition, reason: 'TAKE_PROFIT' | 'STOP_LOSS'): Promise<void> {
    const { tokenMint, tokenSymbol, quantity } = position;
    
    logger.info(`Selling ${quantity} ${tokenSymbol} tokens due to ${reason}`);
    
    try {
      // Eksekusi penjualan menggunakan executor
      const sellResult = await this.executor.sellToken(tokenMint, quantity);
      
      if (sellResult.success) {
        // Kirim notifikasi penjualan berhasil
        await this.notifier.sendSaleNotification(sellResult);
        
        // Hapus posisi dari tracking
        this.removePosition(tokenMint);
        
        logger.info(`Successfully sold ${quantity} ${tokenSymbol} tokens for ${sellResult.amountReceived} SOL (${sellResult.profitLossPercent.toFixed(2)}%)`);
      } else {
        // Jika gagal, kirim notifikasi error tetapi tetap track posisi
        await this.notifier.sendErrorNotification(
          `Gagal menjual ${tokenSymbol} pada ${reason}`, 
          { error: sellResult.error, position }
        );
        
        logger.error(`Failed to sell ${tokenSymbol}: ${sellResult.error}`);
      }
    } catch (error) {
      logger.error(`Error selling ${tokenSymbol}: ${error}`);
      await this.notifier.sendErrorNotification(
        `Error saat menjual ${tokenSymbol} pada ${reason}`, 
        { error, position }
      );
    }
  }

  // Helper method untuk mendapatkan harga token dari Jupiter API
  private async getCurrentPrice(tokenMint: string): Promise<number | null> {
    try {
      const response = await axios.get(this.jupiterPriceApiUrl, {
        params: {
          ids: tokenMint,
          vsToken: 'So11111111111111111111111111111111111111112' // SOL
        },
        timeout: 5000
      });

      if (response.data && response.data.data && response.data.data[tokenMint]) {
        return response.data.data[tokenMint].price;
      }

      return null;
    } catch (error) {
      logger.error(`Error fetching price for ${tokenMint}: ${error}`);
      return null;
    }
  }
} 
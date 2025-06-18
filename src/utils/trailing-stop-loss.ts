import { TokenPosition } from '../types';
import logger from './logger';

/**
 * Interface untuk opsi trailing stop loss
 */
export interface TrailingStopLossOptions {
  /** Persentase trailing (misalnya 10 untuk 10%) */
  trailingPercent: number;
  /** Persentase aktivasi (misalnya 20 untuk 20%) */
  activationPercent: number;
  /** Interval step untuk memperbarui trailing stop loss (persentase) */
  stepPercent: number;
}

/**
 * Class untuk mengelola Trailing Stop Loss
 */
export class TrailingStopLoss {
  private trailingPercent: number;
  private activationPercent: number;
  private stepPercent: number;
  private highestPrice: number = 0;
  private isActivated: boolean = false;
  private currentStopPrice: number = 0;

  constructor(
    private position: TokenPosition,
    options: TrailingStopLossOptions
  ) {
    this.trailingPercent = options.trailingPercent;
    this.activationPercent = options.activationPercent;
    this.stepPercent = options.stepPercent;
    
    // Inisialisasi stop price awal
    this.currentStopPrice = position.stopLossPrice;
    
    logger.info({
      tokenSymbol: position.tokenSymbol,
      trailingPercent: this.trailingPercent,
      activationPercent: this.activationPercent,
      initialStopPrice: this.currentStopPrice
    }, 'Trailing stop loss initialized');
  }

  /**
   * Update trailing stop loss berdasarkan harga terkini
   * @param currentPrice Harga token saat ini
   * @returns Harga stop loss baru
   */
  public update(currentPrice: number): number {
    if (!currentPrice) return this.currentStopPrice;
    
    const entryPrice = this.position.purchasePrice;
    const tokenSymbol = this.position.tokenSymbol;
    
    // Jika harga saat ini lebih tinggi dari harga tertinggi sebelumnya, update
    if (currentPrice > this.highestPrice) {
      this.highestPrice = currentPrice;
      
      // Hitung keuntungan dalam persentase
      const profitPercent = ((currentPrice - entryPrice) / entryPrice) * 100;
      
      // Periksa apakah trailing stop loss sudah diaktifkan
      if (!this.isActivated) {
        // Aktivasi trailing stop loss jika profit mencapai persentase aktivasi
        if (profitPercent >= this.activationPercent) {
          this.isActivated = true;
          
          // Set stop loss awal berdasarkan trailing percent
          const newStopPrice = currentPrice * (1 - this.trailingPercent / 100);
          
          // Hanya update jika stop loss baru lebih tinggi dari yang sebelumnya
          if (newStopPrice > this.currentStopPrice) {
            this.currentStopPrice = newStopPrice;
            logger.info({
              tokenSymbol,
              highestPrice: this.highestPrice,
              newStopPrice: this.currentStopPrice,
              profitPercent: profitPercent.toFixed(2),
              status: 'ACTIVATED'
            }, 'Trailing stop loss activated');
          }
        }
      } else {
        // Jika sudah diaktifkan, update trailing stop loss jika pergerakan harga
        // telah mencapai step percent
        const lastStopPercent = (this.currentStopPrice / this.highestPrice) * 100;
        const targetStopPercent = 100 - this.trailingPercent;
        
        // Jika pergerakan cukup signifikan untuk update stop loss
        if (targetStopPercent - lastStopPercent >= this.stepPercent) {
          const newStopPrice = currentPrice * (1 - this.trailingPercent / 100);
          
          // Hanya update jika stop loss baru lebih tinggi dari yang sebelumnya
          if (newStopPrice > this.currentStopPrice) {
            this.currentStopPrice = newStopPrice;
            logger.info({
              tokenSymbol,
              highestPrice: this.highestPrice,
              newStopPrice: this.currentStopPrice,
              profitPercent: profitPercent.toFixed(2),
              status: 'UPDATED'
            }, 'Trailing stop loss updated');
          }
        }
      }
    }
    
    return this.currentStopPrice;
  }

  /**
   * Periksa apakah harga saat ini memicu trailing stop loss
   * @param currentPrice Harga token saat ini
   * @returns true jika stop loss terpicu
   */
  public isTriggered(currentPrice: number): boolean {
    // Jika trailing stop loss belum diaktifkan, gunakan stop loss normal
    if (!this.isActivated) {
      return currentPrice <= this.position.stopLossPrice;
    }
    
    // Jika sudah diaktifkan, gunakan trailing stop price
    return currentPrice <= this.currentStopPrice;
  }

  /**
   * Mendapatkan status trailing stop loss saat ini
   */
  public getStatus(): {
    isActivated: boolean;
    currentStopPrice: number;
    highestPrice: number;
    trailingPercent: number;
  } {
    return {
      isActivated: this.isActivated,
      currentStopPrice: this.currentStopPrice,
      highestPrice: this.highestPrice,
      trailingPercent: this.trailingPercent
    };
  }
} 
import { config } from '../config/env';
import logger from '../utils/logger';
import { PumpFunGraduatedEvent, TokenAnalysisResult, IAnalyzer } from '../types';
import { RugCheckAnalyzer } from '../services/rugcheck-analyzer';

export class TokenAnalyzer implements IAnalyzer {
  private rugCheckAnalyzer: RugCheckAnalyzer;

  constructor() {
    logger.info('Token Analyzer initialized');
    this.rugCheckAnalyzer = new RugCheckAnalyzer();
  }
  
  /**
   * Sanitizes a string to ensure it's safe for logging and processing
   * @param input The input string to sanitize
   * @returns A sanitized string
   */
  private sanitizeString(input: string | undefined | null): string {
    if (!input) return 'unknown';
    
    try {
      // Replace or remove problematic characters
      return input
        .replace(/[\u0000-\u001F\u007F-\u009F]/g, '') // Remove control characters
        .replace(/[^\x00-\x7F]/g, '?') // Replace non-ASCII with ?
        .trim()
        .substring(0, 50); // Limit length
    } catch (error) {
      logger.error(`Error sanitizing string: ${error}`);
      return 'invalid-string';
    }
  }

  async analyzeToken(event: PumpFunGraduatedEvent): Promise<TokenAnalysisResult> {
    // Sanitize token symbol and name to prevent errors in logging and processing
    const safeSymbol = this.sanitizeString(event.symbol);
    const safeName = this.sanitizeString(event.name);
    
    logger.info(`Analyzing token: ${safeSymbol} (${event.coinMint})`);
    
    // Check if RugCheck analysis is enabled
    if (config.analysis.useRugCheck) {
      try {
        logger.info(`Using RugCheck analysis for ${safeSymbol}`);
        const rugCheckResult = await this.rugCheckAnalyzer.analyzeToken(
          event.coinMint,
          safeSymbol,
          safeName
        );
        
        // If RugCheck analysis was successful and has a decision, return it
        if (rugCheckResult.factors.length > 0) {
          logger.info(`RugCheck analysis complete for ${safeSymbol} with score ${rugCheckResult.score.toFixed(2)}, decision: ${rugCheckResult.buyDecision}`);
          return rugCheckResult;
        }
        
        // If RugCheck analysis failed, fall back to our own analysis
        logger.warn(`RugCheck analysis failed for ${safeSymbol}, falling back to standard analysis`);
      } catch (error) {
        logger.error(`Error in RugCheck analysis for ${safeSymbol}: ${error}`);
        logger.warn('Falling back to standard analysis');
      }
    }
    
    // Standard analysis if RugCheck is disabled or failed
    const factors = [];
    let totalScore = 0;

    try {
      // Factor 1: Jumlah holders
      const holdersScore = this.calculateHoldersScore(event.numHolders);
      factors.push({
        name: 'Jumlah Holders',
        score: holdersScore,
        explanation: `${event.numHolders} holders saat lulus`
      });
      totalScore += holdersScore;

      // Factor 2: Jumlah snipers
      const sniperScore = this.calculateSniperScore(event.sniperCount);
      factors.push({
        name: 'Jumlah Snipers',
        score: sniperScore,
        explanation: `${event.sniperCount} snipers saat lulus`
      });
      totalScore += sniperScore;

      // Factor 3: Market Cap
      const marketCapScore = this.calculateMarketCapScore(event.marketCap);
      factors.push({
        name: 'Market Cap',
        score: marketCapScore,
        explanation: `${(event.marketCap / 1000).toFixed(2)}K USD`
      });
      totalScore += marketCapScore;

      // Factor 4: Social Presence
      const socialScore = this.calculateSocialScore(event);
      factors.push({
        name: 'Kehadiran Sosial',
        score: socialScore,
        explanation: this.generateSocialExplanation(event)
      });
      totalScore += socialScore;

      // Factor 5: Token Distribution
      // Gunakan data holders yang sudah tersedia
      const distributionData = this.analyzeTokenDistributionFromEvent(event);
      const distributionScore = this.calculateDistributionScore(distributionData);
      factors.push({
        name: 'Distribusi Token',
        score: distributionScore,
        explanation: distributionData.explanation
      });
      totalScore += distributionScore;

      // Factor 6: Developer Reputation
      // Gunakan data devHoldingsPercentage yang sudah tersedia
      const devData = this.analyzeDeveloperFromEvent(event);
      const devScore = this.calculateDevScore(devData);
      factors.push({
        name: 'Reputasi Developer',
        score: devScore,
        explanation: devData.explanation
      });
      totalScore += devScore;

      // Buat keputusan pembelian berdasarkan skor total
      const buyDecision = totalScore >= config.analysis.minScoreToBuy;

      // Jika ada red flag tertentu, langsung tolak meskipun skor total tinggi
      // Contoh: distribusi token yang sangat buruk
      if (distributionData.hasRedFlag || devData.hasRedFlag) {
        logger.warn(`Token ${event.symbol} memiliki red flag, menolak pembelian meskipun skor total ${totalScore}`);
        return {
          tokenMint: event.coinMint,
          tokenSymbol: event.symbol,
          tokenName: event.name,
          score: totalScore,
          buyDecision: false,
          factors
        };
      }

      logger.info(`Analisis token ${event.symbol} selesai dengan skor ${totalScore}, keputusan pembelian: ${buyDecision}`);
      
      return {
        tokenMint: event.coinMint,
        tokenSymbol: event.symbol,
        tokenName: event.name,
        score: totalScore,
        buyDecision,
        factors
      };

    } catch (error) {
      logger.error(`Error analyzing token ${event.symbol}: ${error}`);
      return {
        tokenMint: event.coinMint,
        tokenSymbol: event.symbol,
        tokenName: event.name,
        score: 0,
        buyDecision: false,
        factors: [
          {
            name: 'Error',
            score: 0,
            explanation: `Error saat menganalisis token: ${error}`
          }
        ]
      };
    }
  }

  // Helper function untuk mengkalkulasi skor berdasarkan jumlah holders
  private calculateHoldersScore(numHolders: number): number {
    if (numHolders >= config.analysis.minHoldersCount * 2) return 8;
    if (numHolders >= config.analysis.minHoldersCount) return 5;
    if (numHolders >= config.analysis.minHoldersCount / 2) return 2;
    if (numHolders < 50) return -5;
    return 0;
  }

  // Helper function untuk mengkalkulasi skor berdasarkan jumlah snipers
  private calculateSniperScore(sniperCount: number): number {
    if (sniperCount > 100) return -5;
    if (sniperCount > 50) return -2;
    if (sniperCount < 10) return 5;
    if (sniperCount < 30) return 2;
    return 0;
  }

  // Helper function untuk mengkalkulasi skor berdasarkan market cap
  private calculateMarketCapScore(marketCap: number): number {
    if (marketCap > 1000000) return 2; // > 1M
    if (marketCap > 500000) return 3; // > 500K
    if (marketCap > 100000) return 5; // > 100K
    if (marketCap < 10000) return -2; // < 10K
    return 0;
  }

  // Helper function untuk mengkalkulasi skor berdasarkan kehadiran sosial
  private calculateSocialScore(event: PumpFunGraduatedEvent): number {
    let score = 0;
    
    if (event.website) score += 1;
    if (event.twitter) score += 1;
    if (event.telegram) score += 1;
    if (event.discord) score += 1;
    
    // Bonus jika memiliki setidaknya 3 platform sosial
    if (score >= 3) score += 1;
    
    return score;
  }

  private generateSocialExplanation(event: PumpFunGraduatedEvent): string {
    const platforms = [];
    if (event.website) platforms.push('Website');
    if (event.twitter) platforms.push('Twitter');
    if (event.telegram) platforms.push('Telegram');
    if (event.discord) platforms.push('Discord');
    
    if (platforms.length === 0) {
      return 'Tidak ada platform sosial';
    }
    
    return `Memiliki ${platforms.join(', ')}`;
  }

  // Analisis distribusi token dari data event
  private analyzeTokenDistributionFromEvent(event: PumpFunGraduatedEvent): {
    hasRedFlag: boolean;
    explanation: string;
    largestHolderPercent: number;
  } {
    try {
      logger.info(`Analyzing token distribution for ${event.coinMint} from event data`);
      
      // Jika tidak ada data holders, gunakan devHoldingsPercentage
      if (!event.holders || event.holders.length === 0) {
        const devHoldingPercent = parseFloat(event.devHoldingsPercentage || '0');
        const hasRedFlag = devHoldingPercent > config.analysis.maxDevHoldingPercent;
        
        let explanation = '';
        if (devHoldingPercent > 50) {
          explanation = `Dev memegang ${devHoldingPercent.toFixed(1)}% (sangat tidak sehat)`;
        } else if (devHoldingPercent > 30) {
          explanation = `Dev memegang ${devHoldingPercent.toFixed(1)}% (tidak sehat)`;
        } else if (devHoldingPercent > 15) {
          explanation = `Dev memegang ${devHoldingPercent.toFixed(1)}% (cukup)`;
        } else {
          explanation = `Dev memegang ${devHoldingPercent.toFixed(1)}% (sehat)`;
        }
        
        return {
          hasRedFlag,
          explanation,
          largestHolderPercent: devHoldingPercent
        };
      }
      
      // Jika ada data holders, cari holder terbesar
      let largestHolder = event.holders[0];
      for (const holder of event.holders) {
        if (holder.ownedPercentage > largestHolder.ownedPercentage) {
          largestHolder = holder;
        }
      }
      
      const largestHolderPercent = largestHolder ? largestHolder.ownedPercentage : 0;
      const hasRedFlag = largestHolderPercent > config.analysis.maxDevHoldingPercent;
      
      let explanation = '';
      if (largestHolderPercent > 50) {
        explanation = `Holder terbesar memegang ${largestHolderPercent.toFixed(1)}% (sangat tidak sehat)`;
      } else if (largestHolderPercent > 30) {
        explanation = `Holder terbesar memegang ${largestHolderPercent.toFixed(1)}% (tidak sehat)`;
      } else if (largestHolderPercent > 15) {
        explanation = `Holder terbesar memegang ${largestHolderPercent.toFixed(1)}% (cukup)`;
      } else {
        explanation = `Holder terbesar memegang ${largestHolderPercent.toFixed(1)}% (sehat)`;
      }
      
      return {
        hasRedFlag,
        explanation,
        largestHolderPercent
      };
    } catch (error) {
      logger.error(`Error analyzing token distribution: ${error}`);
      return {
        hasRedFlag: true,
        explanation: `Error: ${error}`,
        largestHolderPercent: 100
      };
    }
  }

  // Analisis wallet developer dari data event
  private analyzeDeveloperFromEvent(event: PumpFunGraduatedEvent): {
    hasRedFlag: boolean;
    explanation: string;
    walletAge: number;
    devHoldingPercent: number;
  } {
    try {
      logger.info(`Analyzing developer data for ${event.coinMint} from event data`);
      
      const devHoldingPercent = parseFloat(event.devHoldingsPercentage || '0');
      const creationTimeHours = (Date.now() - event.creationTime) / (1000 * 60 * 60);
      const walletAge = Math.round(creationTimeHours);
      
      let hasRedFlag = false;
      let explanation = '';
      
      // Cek apakah dev holdings terlalu tinggi
      if (devHoldingPercent > config.analysis.maxDevHoldingPercent) {
        hasRedFlag = true;
        explanation = `Dev memegang ${devHoldingPercent}% token (terlalu tinggi)`;
      } 
      // Cek apakah token terlalu baru
      else if (walletAge < 24) { // Kurang dari 24 jam
        hasRedFlag = false;
        explanation = `Token baru dibuat ${walletAge} jam yang lalu (terlalu baru)`;
      }
      // Penjelasan normal
      else {
        explanation = `Dev memegang ${devHoldingPercent}% token, usia token ${walletAge} jam`;
      }
      
      return {
        hasRedFlag,
        explanation,
        walletAge,
        devHoldingPercent
      };
      
    } catch (error) {
      logger.error(`Error analyzing developer wallet: ${error}`);
      return {
        hasRedFlag: true,
        explanation: `Error: ${error}`,
        walletAge: 0,
        devHoldingPercent: 100
      };
    }
  }

  // Analisis distribusi token (simulasi)
  // Pada implementasi nyata, ini akan menggunakan API Helius atau RPC untuk mendapatkan data distribusi token
  private async analyzeTokenDistribution(tokenMint: string): Promise<{
    hasRedFlag: boolean;
    explanation: string;
    largestHolderPercent: number;
  }> {
    try {
      // Simulasi API call
      // Di implementasi nyata, ini akan memanggil API untuk mendapatkan holder terbesar
      logger.info(`Analyzing token distribution for ${tokenMint}`);
      
      // Simulasi delay untuk API call
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Nilai random untuk simulasi
      const largestHolderPercent = Math.random() * 30; // 0-30%
      const secondLargestHolderPercent = Math.random() * 15; // 0-15%
      const top5HoldersPercent = largestHolderPercent + secondLargestHolderPercent + (Math.random() * 15);
      
      // Analisis distribusi
      const hasRedFlag = largestHolderPercent > config.analysis.maxDevHoldingPercent;
      let explanation = '';
      
      if (largestHolderPercent > 20) {
        explanation = `Holder terbesar memegang ${largestHolderPercent.toFixed(1)}% (tidak sehat)`;
      } else if (largestHolderPercent > 10) {
        explanation = `Holder terbesar memegang ${largestHolderPercent.toFixed(1)}% (cukup)`;
      } else {
        explanation = `Holder terbesar memegang ${largestHolderPercent.toFixed(1)}% (sehat)`;
      }
      
      return {
        hasRedFlag,
        explanation,
        largestHolderPercent
      };
    } catch (error) {
      logger.error(`Error analyzing token distribution: ${error}`);
      return {
        hasRedFlag: true,
        explanation: `Error: ${error}`,
        largestHolderPercent: 100
      };
    }
  }

  // Hitung skor distribusi berdasarkan hasil analisis
  private calculateDistributionScore(distributionData: { largestHolderPercent: number }): number {
    const { largestHolderPercent } = distributionData;
    
    if (largestHolderPercent > 50) return -15;
    if (largestHolderPercent > 35) return -10;
    if (largestHolderPercent > 20) return -5;
    if (largestHolderPercent > 15) return 0;
    if (largestHolderPercent < 5) return 10;
    if (largestHolderPercent < 10) return 5;
    return 0;
  }

  // Analisis wallet developer (simulasi)
  // Pada implementasi nyata, ini akan menggunakan API untuk memeriksa dompet developer
  private async analyzeDeveloperWallet(tokenMint: string): Promise<{
    hasRedFlag: boolean;
    explanation: string;
    walletAge: number;
    devHoldingPercent: number;
  }> {
    try {
      // Simulasi API call
      logger.info(`Analyzing developer wallet for ${tokenMint}`);
      
      // Simulasi delay untuk API call
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Nilai random untuk simulasi
      const walletAge = Math.floor(Math.random() * 180); // 0-180 hari
      const devHoldingPercent = Math.random() * 25; // 0-25%
      
      // Cek red flag
      const hasRedFlag = walletAge < 7 || devHoldingPercent > config.analysis.maxDevHoldingPercent;
      let explanation = '';
      
      if (walletAge < 7) {
        explanation = `Wallet developer baru berusia ${walletAge} hari (risiko tinggi)`;
      } else if (devHoldingPercent > 20) {
        explanation = `Developer memegang ${devHoldingPercent.toFixed(1)}% token (terlalu tinggi)`;
      } else {
        explanation = `Developer memegang ${devHoldingPercent.toFixed(1)}% token, wallet berusia ${walletAge} hari`;
      }
      
      return {
        hasRedFlag,
        explanation,
        walletAge,
        devHoldingPercent
      };
      
    } catch (error) {
      logger.error(`Error analyzing developer wallet: ${error}`);
      return {
        hasRedFlag: true,
        explanation: `Error: ${error}`,
        walletAge: 0,
        devHoldingPercent: 100
      };
    }
  }

  // Hitung skor developer berdasarkan hasil analisis
  private calculateDevScore(devData: { walletAge: number; devHoldingPercent: number }): number {
    const { walletAge, devHoldingPercent } = devData;
    
    let score = 0;
    
    // Skor berdasarkan usia wallet
    if (walletAge < 7) score -= 15; // Wallet sangat baru
    else if (walletAge < 30) score -= 5; // Wallet cukup baru
    else if (walletAge > 180) score += 5; // Wallet lama
    
    // Skor berdasarkan persentase yang dipegang developer
    if (devHoldingPercent > 40) score -= 15;
    else if (devHoldingPercent > 25) score -= 10;
    else if (devHoldingPercent > 15) score -= 5;
    else if (devHoldingPercent < 5) score += 5;
    
    return score;
  }
} 
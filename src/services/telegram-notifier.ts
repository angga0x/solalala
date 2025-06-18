import TelegramBot from 'node-telegram-bot-api';
import { backOff } from 'exponential-backoff';
import { config } from '../config/env';
import logger from '../utils/logger';
import { 
  TokenAnalysisResult, 
  PurchaseResult, 
  SellResult, 
  INotifier,
  NotificationType 
} from '../types';
import { RugCheckResponse } from '../types/rugcheck';

export class TelegramNotifier implements INotifier {
  private bot: TelegramBot;
  private chatId: string;

  constructor() {
    this.bot = new TelegramBot(config.telegram.botToken, { polling: false });
    this.chatId = config.telegram.chatId;
    logger.info('Telegram notifier initialized');
  }

  private async sendMessage(message: string): Promise<void> {
    try {
      await backOff(() => this.bot.sendMessage(this.chatId, message, {
        parse_mode: 'Markdown',
        disable_web_page_preview: true
      }), {
        numOfAttempts: 3,
        startingDelay: 1000,
        timeMultiple: 2,
        retry: (e: any) => {
          logger.error(`Error sending Telegram message, retrying: ${e.message}`);
          return true;
        }
      });
    } catch (error) {
      logger.error(`Failed to send Telegram message after retries: ${error}`);
    }
  }

  async sendAnalysisNotification(result: TokenAnalysisResult): Promise<void> {
    const decisionEmoji = result.buyDecision ? '✅ **MENCOBA BELI**' : '⚠️ **TOKEN DIABAIKAN**';
    
    let message = `${decisionEmoji}\n\n`;
    message += `**Token:** ${result.tokenName} (${result.tokenSymbol})\n`;
    message += `**Skor Analisis:** ${result.score}\n\n`;
    
    if (result.factors.length > 0) {
      message += '**Faktor Analisis:**\n';
      for (const factor of result.factors) {
        const emoji = factor.score > 0 ? '✅' : factor.score < 0 ? '❌' : '➖';
        message += `${emoji} ${factor.name}: ${factor.score > 0 ? '+' : ''}${factor.score} (${factor.explanation})\n`;
      }
    }
    
    message += `\n**Token Mint:** \`${result.tokenMint}\``;
    
    await this.sendMessage(message);
    logger.info({
      type: NotificationType.ANALYSIS,
      tokenMint: result.tokenMint,
      tokenSymbol: result.tokenSymbol,
      decision: result.buyDecision,
      score: result.score
    }, 'Analysis notification sent');
  }

  async sendDetailedAnalysisNotification(
    result: TokenAnalysisResult, 
    rugCheckData?: RugCheckResponse, 
    marketCapUsd?: number
  ): Promise<void> {
    const decisionEmoji = result.buyDecision ? '🚀' : '⚠️';
    const decisionText = result.buyDecision ? 'Analysis Passed!' : 'Analysis Failed!';
    
    let message = `${decisionEmoji} New Token Alert & ${decisionText} ${decisionEmoji}\n\n`;
    message += `Token Address: \`${result.tokenMint}\`\n\n`;
    message += `Name: ${result.tokenName}\n`;
    message += `Symbol: ${result.tokenSymbol}\n`;
    
    // Add description and creator if available from RugCheck data
    if (rugCheckData) {
      const description = rugCheckData.fileMeta?.description || 'N/A';
      message += `Description: ${description}\n`;
      message += `Creator: ${rugCheckData.creator}\n`;
    }
    
    // Add market cap if available
    if (marketCapUsd) {
      message += `Market Cap (USD): $${marketCapUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n`;
    }
    
    message += `\n🔍 Analysis Details (${result.buyDecision ? 'Passed' : 'Failed'}):\n\n`;
    
    // Add RugCheck summary if available
    if (rugCheckData) {
      message += `🛡️ RugCheck Summary:\n`;
      message += `  - Rugged Status: ${rugCheckData.rugged ? 'Marked Rugged' : 'Not Marked Rugged'}\n`;
      
      // Determine risk level based on normalized score
      let riskLevel = 'HIGH';
      if (rugCheckData.score_normalised >= 0.7) {
        riskLevel = 'NONE';
      } else if (rugCheckData.score_normalised >= 0.4) {
        riskLevel = 'MEDIUM';
      }
      
      message += `  - Overall Risk Level: ${riskLevel}\n`;
      message += `  - Score: ${rugCheckData.score.toFixed(3)}\n`;
      message += `  - Price (RC): ${rugCheckData.price}\n`;
      message += `  - Total Liquidity (RC): $${rugCheckData.totalMarketLiquidity.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}\n`;
      
      // LP locked percentage if available
      if (rugCheckData.markets && rugCheckData.markets.length > 0 && rugCheckData.markets[0].lp) {
        const lpLockedPct = rugCheckData.markets[0].lp.lpLockedPct;
        message += `  - LP Locked Pct (RC): ${lpLockedPct.toFixed(0)}%\n`;
      }
      
      // Token metadata flags
      message += `  - Mutable Metadata (RC): ${rugCheckData.tokenMeta.mutable ? 'Yes' : 'No'}\n`;
      message += `  - Mint Authority Enabled (RC): ${rugCheckData.mintAuthority ? 'Yes' : 'No'}\n`;
      message += `  - Freeze Authority Enabled (RC): ${rugCheckData.freezeAuthority ? 'Yes' : 'No'}\n`;
      
      // Add risks if any
      if (rugCheckData.risks && Array.isArray(rugCheckData.risks) && rugCheckData.risks.length > 0) {
        message += `  - Specific Risks/Warnings (RC):\n`;
        for (const risk of rugCheckData.risks) {
          try {
            // Format: risk name (Level: severity, Score: impact): description
            if (typeof risk === 'string') {
              try {
                const parts = risk.split(':');
                if (parts && parts.length >= 2) {
                  const riskName = parts[0].trim();
                  const riskDetails = parts[1].trim();
                  message += `    • ${riskName} (${riskDetails})\n`;
                } else {
                  message += `    • ${risk}\n`;
                }
              } catch (splitError) {
                // If split fails, just use the risk as is
                message += `    • ${risk}\n`;
              }
            } else if (risk && typeof risk === 'object') {
              // Handle object risk items
              try {
                message += `    • ${JSON.stringify(risk)}\n`;
              } catch (jsonError) {
                message += `    • [Complex risk object]\n`;
              }
            } else {
              // Handle other types
              message += `    • ${String(risk || 'Unknown risk')}\n`;
            }
          } catch (error) {
            // Ultimate fallback for any parsing errors
            message += `    • [Error parsing risk]\n`;
            logger.error(`Error parsing risk in notification: ${error}`);
          }
        }
      }
    } else {
      // If no RugCheck data, show standard analysis factors
      for (const factor of result.factors) {
        const emoji = factor.score > 0 ? '✅' : factor.score < 0 ? '❌' : '➖';
        message += `${emoji} ${factor.name}: ${factor.score > 0 ? '+' : ''}${factor.score} (${factor.explanation})\n`;
      }
    }
    
    message += `\n-----------------------------------`;
    
    await this.sendMessage(message);
    logger.info({
      type: NotificationType.ANALYSIS,
      tokenMint: result.tokenMint,
      tokenSymbol: result.tokenSymbol,
      decision: result.buyDecision,
      score: result.score,
      hasRugCheckData: !!rugCheckData
    }, 'Detailed analysis notification sent');
  }

  async sendPurchaseNotification(result: PurchaseResult): Promise<void> {
    if (!result.success) {
      await this.sendErrorNotification(`Gagal membeli token ${result.tokenSymbol}`, result.error);
      return;
    }

    const message = `✅ **PEMBELIAN BERHASIL** ✅\n\n` +
      `**Token:** ${result.tokenName} (${result.tokenSymbol})\n` +
      `**Biaya:** ${result.amountSpent.toFixed(4)} SOL\n` +
      `**Jumlah:** ${result.tokenAmount.toLocaleString()} ${result.tokenSymbol}\n\n` +
      `📈 **Lihat Transaksi:** [Solscan](https://solscan.io/tx/${result.transactionId})\n` +
      `🔍 **Token:** [Solscan](https://solscan.io/token/${result.tokenMint})`;

    await this.sendMessage(message);
    logger.info({
      type: NotificationType.PURCHASE,
      tokenMint: result.tokenMint,
      tokenSymbol: result.tokenSymbol,
      amountSpent: result.amountSpent,
      tokenAmount: result.tokenAmount,
      txId: result.transactionId
    }, 'Purchase notification sent');
  }

  async sendSaleNotification(result: SellResult): Promise<void> {
    if (!result.success) {
      await this.sendErrorNotification(`Gagal menjual token ${result.tokenSymbol}`, result.error);
      return;
    }

    const isProfitable = result.profitLoss > 0;
    const emoji = isProfitable ? '🟢' : '🔴';
    const profitLossText = isProfitable 
      ? `+${result.profitLossPercent.toFixed(2)}% (${result.profitLoss.toFixed(4)} SOL)` 
      : `${result.profitLossPercent.toFixed(2)}% (${result.profitLoss.toFixed(4)} SOL)`;

    const message = `${emoji} **PENJUALAN BERHASIL** ${emoji}\n\n` +
      `**Token:** ${result.tokenName} (${result.tokenSymbol})\n` +
      `**Jumlah:** ${result.tokenAmount.toLocaleString()} ${result.tokenSymbol}\n` +
      `**Diterima:** ${result.amountReceived.toFixed(4)} SOL\n` +
      `**Profit/Loss:** ${profitLossText}\n\n` +
      `📈 **Lihat Transaksi:** [Solscan](https://solscan.io/tx/${result.transactionId})`;

    await this.sendMessage(message);
    logger.info({
      type: NotificationType.SALE,
      tokenMint: result.tokenMint,
      tokenSymbol: result.tokenSymbol,
      amountReceived: result.amountReceived,
      profitLoss: result.profitLoss,
      profitLossPercent: result.profitLossPercent,
      txId: result.transactionId
    }, 'Sale notification sent');
  }

  async sendErrorNotification(error: string, context?: any): Promise<void> {
    const message = `❌ **ERROR** ❌\n\n` +
      `**Pesan:** ${error}\n` +
      (context ? `**Konteks:** \`\`\`${JSON.stringify(context, null, 2)}\`\`\`` : '');

    await this.sendMessage(message);
    logger.error({
      type: NotificationType.ERROR,
      error,
      context
    }, 'Error notification sent');
  }

  async sendInfoNotification(message: string, context?: any): Promise<void> {
    const formattedMessage = `ℹ️ **INFO** ℹ️\n\n` +
      `**Pesan:** ${message}\n` +
      (context ? `**Detail:** ${JSON.stringify(context, null, 2)}` : '');

    await this.sendMessage(formattedMessage);
    logger.info({
      type: NotificationType.INFO,
      message,
      context
    }, 'Info notification sent');
  }

  async sendBalanceUpdate(balance: number): Promise<void> {
    const message = `💰 **UPDATE SALDO** 💰\n\n` +
      `**Saldo Saat Ini:** ${balance.toFixed(4)} SOL`;

    await this.sendMessage(message);
    logger.info({
      type: NotificationType.BALANCE,
      balance
    }, 'Balance update sent');
  }
} 
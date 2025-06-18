import { 
  Connection, 
  Keypair, 
  Transaction, 
  sendAndConfirmTransaction
} from '@solana/web3.js';
import { backOff } from 'exponential-backoff';
import axios from 'axios';
import { config } from '../config/env';
import logger from '../utils/logger';
import { PurchaseResult, SellResult, IExecutor } from '../types';
import { getKeypairFromPrivateKey, isValidPublicKey, solToLamports } from '../utils/wallet';

export class TokenExecutor implements IExecutor {
  private connection: Connection;
  private wallet: Keypair;
  private jupiterApiUrl = 'https://quote-api.jup.ag/v6';

  constructor() {
    this.connection = new Connection(config.solana.rpcUrl, 'confirmed');
    
    try {
      // Gunakan fungsi dari utils/wallet untuk mendapatkan keypair
      this.wallet = getKeypairFromPrivateKey();
      logger.info(`Token Executor initialized with wallet: ${this.wallet.publicKey.toString()}`);
    } catch (error: any) {
      logger.error(`Failed to initialize wallet: ${error}`);
      throw new Error(`Token Executor initialization failed: ${error}`);
    }
  }

  async buyToken(tokenMint: string, amountInSol: number): Promise<PurchaseResult> {
    try {
      logger.info(`Attempting to buy token ${tokenMint} with ${amountInSol} SOL`);

      // Validate inputs
      if (!isValidPublicKey(tokenMint)) {
        throw new Error(`Invalid token mint address: ${tokenMint}`);
      }

      if (amountInSol <= 0) {
        throw new Error(`Invalid amount: ${amountInSol} SOL`);
      }

      // 1. Dapatkan kuota dari Jupiter API
      const quoteResponse = await this.getJupiterQuote({
        inputMint: 'So11111111111111111111111111111111111111112', // SOL mint address
        outputMint: tokenMint,
        amount: solToLamports(amountInSol),
        slippageBps: config.bot.maxSlippagePercent * 100
      });

      if (!quoteResponse || !quoteResponse.data) {
        throw new Error('Failed to get quote from Jupiter API');
      }

      const { data: quoteData } = quoteResponse;
      
      logger.info(`Quote received: ${quoteData.outAmount} tokens for ${amountInSol} SOL`);

      // 2. Dapatkan transaksi dari Jupiter API
      const swapResponse = await this.getJupiterSwapTransaction({
        quoteResponse: quoteData,
        userPublicKey: this.wallet.publicKey.toString(),
        priorityFee: config.bot.priorityFeeLamports
      });

      if (!swapResponse || !swapResponse.data) {
        throw new Error('Failed to get swap transaction from Jupiter API');
      }

      const { swapTransaction } = swapResponse.data;

      // 3. Deserialize, sign, dan kirim transaksi
      const transaction = Transaction.from(Buffer.from(swapTransaction, 'base64'));
      
      // 4. Kirim dan konfirmasi transaksi
      const signature = await this.sendTransactionWithRetry(transaction);
      
      logger.info(`Token purchase successful: ${signature}`);
      
      // 5. Ambil info token
      const tokenInfo = await this.fetchTokenInfo(tokenMint);
      
      return {
        success: true,
        tokenMint,
        tokenSymbol: tokenInfo.symbol,
        tokenName: tokenInfo.name,
        amountSpent: amountInSol,
        tokenAmount: quoteData.outAmount / Math.pow(10, tokenInfo.decimals),
        transactionId: signature
      };
    } catch (error) {
      logger.error(`Error buying token ${tokenMint}: ${error}`);
      
      // Attempt to get token info even on failure
      let tokenSymbol = '';
      let tokenName = '';
      try {
        const tokenInfo = await this.fetchTokenInfo(tokenMint);
        tokenSymbol = tokenInfo.symbol;
        tokenName = tokenInfo.name;
      } catch (infoError) {
        logger.error(`Failed to fetch token info: ${infoError}`);
      }
      
      return {
        success: false,
        tokenMint,
        tokenSymbol,
        tokenName,
        amountSpent: 0,
        tokenAmount: 0,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  async sellToken(tokenMint: string, tokenAmount: number): Promise<SellResult> {
    try {
      logger.info(`Attempting to sell ${tokenAmount} of token ${tokenMint}`);

      // Validate inputs
      if (!isValidPublicKey(tokenMint)) {
        throw new Error(`Invalid token mint address: ${tokenMint}`);
      }

      if (tokenAmount <= 0) {
        throw new Error(`Invalid amount: ${tokenAmount} tokens`);
      }

      // Get token info to convert to proper decimals
      const tokenInfo = await this.fetchTokenInfo(tokenMint);
      const rawAmount = tokenAmount * Math.pow(10, tokenInfo.decimals);

      // 1. Dapatkan kuota dari Jupiter API
      const quoteResponse = await this.getJupiterQuote({
        inputMint: tokenMint,
        outputMint: 'So11111111111111111111111111111111111111112', // SOL mint
        amount: Math.floor(rawAmount),
        slippageBps: config.bot.maxSlippagePercent * 100
      });

      if (!quoteResponse || !quoteResponse.data) {
        throw new Error('Failed to get quote from Jupiter API');
      }

      const { data: quoteData } = quoteResponse;
      const solReceived = quoteData.outAmount / 1e9; // Convert lamports to SOL
      
      logger.info(`Quote received: ${solReceived} SOL for ${tokenAmount} tokens`);

      // 2. Dapatkan transaksi dari Jupiter API
      const swapResponse = await this.getJupiterSwapTransaction({
        quoteResponse: quoteData,
        userPublicKey: this.wallet.publicKey.toString(),
        priorityFee: config.bot.priorityFeeLamports
      });

      if (!swapResponse || !swapResponse.data) {
        throw new Error('Failed to get swap transaction from Jupiter API');
      }

      const { swapTransaction } = swapResponse.data;

      // 3. Deserialize, sign, dan kirim transaksi
      const transaction = Transaction.from(Buffer.from(swapTransaction, 'base64'));
      
      // 4. Kirim dan konfirmasi transaksi
      const signature = await this.sendTransactionWithRetry(transaction);
      
      logger.info(`Token sale successful: ${signature}`);
      
      // Calculate profit/loss (this would require knowing the purchase amount)
      // For demo, we'll use a fixed value
      const purchaseAmount = 0.5; // This should come from position manager
      const profitLoss = solReceived - purchaseAmount;
      const profitLossPercent = (profitLoss / purchaseAmount) * 100;
      
      return {
        success: true,
        tokenMint,
        tokenSymbol: tokenInfo.symbol,
        tokenName: tokenInfo.name,
        amountReceived: solReceived,
        tokenAmount,
        profitLoss,
        profitLossPercent,
        transactionId: signature
      };
    } catch (error) {
      logger.error(`Error selling token ${tokenMint}: ${error}`);
      
      // Attempt to get token info even on failure
      let tokenSymbol = '';
      let tokenName = '';
      try {
        const tokenInfo = await this.fetchTokenInfo(tokenMint);
        tokenSymbol = tokenInfo.symbol;
        tokenName = tokenInfo.name;
      } catch (infoError) {
        logger.error(`Failed to fetch token info: ${infoError}`);
      }
      
      return {
        success: false,
        tokenMint,
        tokenSymbol,
        tokenName,
        amountReceived: 0,
        tokenAmount,
        profitLoss: 0,
        profitLossPercent: 0,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  private async getJupiterQuote(params: {
    inputMint: string;
    outputMint: string;
    amount: number;
    slippageBps: number;
  }): Promise<any> {
    try {
      const url = `${this.jupiterApiUrl}/quote`;
      const response = await axios.get(url, { params });
      return response;
    } catch (error) {
      logger.error(`Error getting Jupiter quote: ${error}`);
      throw error;
    }
  }

  private async getJupiterSwapTransaction(params: {
    quoteResponse: any;
    userPublicKey: string;
    priorityFee: number;
  }): Promise<any> {
    try {
      const { quoteResponse, userPublicKey, priorityFee } = params;
      
      const url = `${this.jupiterApiUrl}/swap`;
      const response = await axios.post(url, {
        quoteResponse,
        userPublicKey,
        priorityFeeLamports: priorityFee,
        wrapAndUnwrapSol: true, // automatically wrap/unwrap SOL
      });
      
      return response;
    } catch (error) {
      logger.error(`Error getting Jupiter swap transaction: ${error}`);
      throw error;
    }
  }

  private async sendTransactionWithRetry(transaction: Transaction): Promise<string> {
    try {
      // Sign the transaction with our wallet
      transaction.partialSign(this.wallet);
      
      // Implement exponential backoff for transaction sending
      const result = await backOff(
        async () => {
          try {
            // Send and confirm transaction
            const signature = await sendAndConfirmTransaction(
              this.connection,
              transaction,
              [this.wallet],
              {
                commitment: 'confirmed',
                skipPreflight: true,
              }
            );
            
            return signature;
          } catch (error: any) {
            // Check if the error is retriable
            if (error.message && (
                error.message.includes('timeout') ||
                error.message.includes('block height') ||
                error.message.includes('too large')
              )) {
              logger.warn(`Retriable error: ${error.message}. Retrying...`);
              throw error; // Rethrow to trigger retry
            }
            
            // Otherwise, it's a non-retriable error
            logger.error(`Non-retriable transaction error: ${error.message}`);
            throw new Error(`Transaction failed: ${error.message}`);
          }
        },
        {
          numOfAttempts: 5,
          startingDelay: 500,
          timeMultiple: 2,
          maxDelay: 5000,
        }
      );
      
      return result;
    } catch (error: any) {
      logger.error(`Failed to send transaction after retries: ${error}`);
      throw error;
    }
  }

  private async fetchTokenInfo(tokenMint: string): Promise<{
    symbol: string;
    name: string;
    decimals: number;
  }> {
    try {
      // In a real implementation, you would use Helius API or Solana SPL token program to get token metadata
      // For simplicity, we'll simulate it with a delay
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Extract symbol from the last 4 chars of mint as a placeholder
      const shortMint = tokenMint.substring(tokenMint.length - 4);
      
      return {
        symbol: `TKN${shortMint}`,
        name: `Token ${shortMint}`,
        decimals: 9  // Most Solana tokens use 9 decimals
      };
    } catch (error: any) {
      logger.error(`Error fetching token info: ${error}`);
      throw error;
    }
  }
} 
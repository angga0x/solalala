import { TelegramNotifier } from '../services/telegram-notifier';
import { RugCheckAnalyzer } from '../services/rugcheck-analyzer';
import { TokenAnalysisResult } from '../types';

/**
 * Test script to verify the new detailed Telegram notification format
 * with RugCheck data integration.
 * 
 * Usage: npx ts-node src/test/test-notifier.ts
 */
async function main() {
  console.log('Testing detailed Telegram notification with RugCheck data...');
  
  const notifier = new TelegramNotifier();
  const rugCheckAnalyzer = new RugCheckAnalyzer();
  
  // Sample token mint address (replace with a real token address for testing)
  const tokenMint = 'D41ngcmQpoP5EnCTPm8J35LAXSUoDjJr5e6XudCrpump';
  
  // Create a sample analysis result
  const analysisResult: TokenAnalysisResult = {
    tokenMint,
    tokenSymbol: 'LOTC',
    tokenName: 'Launch on Twitch Chat',
    score: 0.85,
    buyDecision: true,
    factors: [
      {
        name: 'RugCheck Score',
        score: 0.9,
        explanation: 'RugCheck normalized score: 0.90'
      },
      {
        name: 'Rugged Status',
        score: 1,
        explanation: 'Token is not marked as rugged by RugCheck'
      },
      {
        name: 'Liquidity',
        score: 0.93,
        explanation: 'Total market liquidity: $9,316.50'
      }
    ]
  };
  
  try {
    // Fetch RugCheck data for the token
    console.log(`Fetching RugCheck data for ${tokenMint}...`);
    const rugCheckData = await rugCheckAnalyzer.getTokenData(tokenMint);
    
    if (rugCheckData) {
      console.log('RugCheck data fetched successfully');
    } else {
      console.log('Failed to fetch RugCheck data, proceeding with mock data');
    }
    
    // Use mock data if RugCheck API call fails
    const mockRugCheckData = rugCheckData || {
      mint: tokenMint,
      creator: '25bgLQGne3SPJ5yzCxaQ7hDWrHqdCVricgcDkDn2auT9',
      token: {
        mintAuthority: null,
        supply: 1000000000,
        decimals: 9,
        isInitialized: true,
        freezeAuthority: null
      },
      tokenMeta: {
        name: 'Launch on Twitch Chat',
        symbol: 'LOTC',
        uri: 'https://example.com/metadata.json',
        mutable: false,
        updateAuthority: '25bgLQGne3SPJ5yzCxaQ7hDWrHqdCVricgcDkDn2auT9'
      },
      fileMeta: {
        description: 'N/A',
        name: 'Launch on Twitch Chat',
        symbol: 'LOTC',
        image: 'https://example.com/image.png'
      },
      score: 24.001,
      score_normalised: 0.85,
      rugged: false,
      totalMarketLiquidity: 9316.501,
      markets: [{
        lp: {
          lpLockedPct: 100
        }
      }],
      mintAuthority: null,
      freezeAuthority: null,
      risks: [
        'Creator history of rugged tokens: Level: danger, Score: 24000'
      ],
      graphInsidersDetected: 1,
      detectedAt: new Date().toISOString(),
      topHolders: [],
      // Add missing required properties for RugCheckResponse
      tokenProgram: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
      creatorBalance: 0,
      token_extensions: null,
      lockerOwners: {},
      lockers: {},
      totalLPProviders: 0,
      totalHolders: 100,
      price: 0,
      tokenType: 'fungible',
      transferFee: {
        pct: 0,
        maxAmount: 0,
        authority: ''
      },
      knownAccounts: {},
      events: [],
      verification: null,
      insiderNetworks: null,
      creatorTokens: null
    } as any;
    
    // Send the notification
    console.log('Sending detailed notification...');
    await notifier.sendDetailedAnalysisNotification(
      analysisResult,
      mockRugCheckData,
      9316.50
    );
    
    console.log('Notification sent successfully!');
  } catch (error) {
    console.error('Error testing notification:', error);
  }
}

main().catch(console.error); 
import axios from 'axios';
import logger from '../utils/logger';
import { RugCheckResponse } from '../types/rugcheck';
import { TokenAnalysisResult } from '../types';
import { config } from '../config/env';

export class RugCheckAnalyzer {
  private baseUrl: string;
  private cacheTimeout: number;
  private cache: Map<string, { data: RugCheckResponse; timestamp: number }>;

  constructor() {
    this.baseUrl = config.rugcheck?.apiUrl || 'https://api.rugcheck.xyz/v1';
    this.cacheTimeout = config.rugcheck?.cacheTimeoutMs || 5 * 60 * 1000; // 5 minutes default
    this.cache = new Map();
  }

  /**
   * Fetch token data from RugCheck API
   * @param tokenMint Token mint address
   * @returns RugCheck API response
   */
  async getTokenData(tokenMint: string): Promise<RugCheckResponse | null> {
    try {
      // Check cache first
      const cached = this.cache.get(tokenMint);
      const now = Date.now();
      
      if (cached && now - cached.timestamp < this.cacheTimeout) {
        logger.debug(`Using cached RugCheck data for ${tokenMint}`);
        return cached.data;
      }

      logger.info(`Fetching RugCheck data for ${tokenMint}`);
      const url = `${this.baseUrl}/tokens/${tokenMint}/report`;
      
      const response = await axios.get<RugCheckResponse>(url, {
        timeout: 10000, // 10 seconds timeout
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'SolanaSniper/1.0'
        }
      });

      if (response.status === 200 && response.data) {
        // Update cache
        this.cache.set(tokenMint, { data: response.data, timestamp: now });
        return response.data;
      }
      
      logger.warn(`RugCheck API returned status ${response.status} for ${tokenMint}`);
      return null;
    } catch (error) {
      logger.error(`Error fetching RugCheck data for ${tokenMint}: ${error}`);
      return null;
    }
  }

  /**
   * Analyze token based on RugCheck data
   * @param tokenMint Token mint address
   * @param tokenSymbol Token symbol
   * @param tokenName Token name
   * @returns Analysis result
   */
  async analyzeToken(tokenMint: string, tokenSymbol: string, tokenName: string): Promise<TokenAnalysisResult> {
    const rugCheckData = await this.getTokenData(tokenMint);
    
    // Default result with neutral score
    const result: TokenAnalysisResult = {
      tokenMint,
      tokenSymbol,
      tokenName,
      score: 0.5,
      buyDecision: false,
      factors: []
    };

    if (!rugCheckData) {
      result.factors.push({
        name: 'RugCheck Data',
        score: 0,
        explanation: 'Could not fetch data from RugCheck API'
      });
      return result;
    }

    // Calculate overall score based on RugCheck data
    let totalScore = 0;
    let factorCount = 0;

    // Factor 1: RugCheck score
    const rugCheckScore = rugCheckData.score_normalised;
    result.factors.push({
      name: 'RugCheck Score',
      score: rugCheckScore,
      explanation: `RugCheck normalized score: ${rugCheckScore.toFixed(2)}`
    });
    totalScore += rugCheckScore;
    factorCount++;

    // Factor 2: Is token rugged?
    if (rugCheckData.rugged) {
      result.factors.push({
        name: 'Rugged Status',
        score: 0,
        explanation: 'Token is marked as rugged by RugCheck'
      });
      totalScore += 0;
      factorCount++;
    } else {
      result.factors.push({
        name: 'Rugged Status',
        score: 1,
        explanation: 'Token is not marked as rugged by RugCheck'
      });
      totalScore += 1;
      factorCount++;
    }

    // Factor 3: Liquidity
    const liquidityScore = Math.min(rugCheckData.totalMarketLiquidity / 10000, 1);
    result.factors.push({
      name: 'Liquidity',
      score: liquidityScore,
      explanation: `Total market liquidity: $${rugCheckData.totalMarketLiquidity.toFixed(2)}`
    });
    totalScore += liquidityScore;
    factorCount++;

    // Factor 4: Top holder concentration
    let topHolderConcentration = 0;
    if (rugCheckData.topHolders && rugCheckData.topHolders.length > 0) {
      // Calculate sum of top 5 holders percentage
      const top5HoldersPercentage = rugCheckData.topHolders
        .slice(0, 5)
        .reduce((sum, holder) => sum + holder.pct, 0);
      
      // Score inversely proportional to concentration (lower is better)
      const concentrationScore = Math.max(0, 1 - (top5HoldersPercentage / 100));
      result.factors.push({
        name: 'Holder Concentration',
        score: concentrationScore,
        explanation: `Top 5 holders own ${top5HoldersPercentage.toFixed(2)}% of supply`
      });
      totalScore += concentrationScore;
      factorCount++;
      
      // Store top holder concentration for later use
      topHolderConcentration = top5HoldersPercentage;
    }

    // Factor 5: Risk factors
    if (rugCheckData.risks && rugCheckData.risks.length > 0) {
      const riskScore = Math.max(0, 1 - (rugCheckData.risks.length / 5));
      result.factors.push({
        name: 'Risk Factors',
        score: riskScore,
        explanation: `${rugCheckData.risks.length} risk factors detected: ${rugCheckData.risks.join(', ')}`
      });
      totalScore += riskScore;
      factorCount++;
    } else {
      result.factors.push({
        name: 'Risk Factors',
        score: 1,
        explanation: 'No risk factors detected'
      });
      totalScore += 1;
      factorCount++;
    }

    // Factor 6: Insider detection
    const insiderScore = Math.max(0, 1 - (rugCheckData.graphInsidersDetected / 5));
    result.factors.push({
      name: 'Insider Detection',
      score: insiderScore,
      explanation: `${rugCheckData.graphInsidersDetected} insiders detected`
    });
    totalScore += insiderScore;
    factorCount++;

    // Calculate final score
    result.score = factorCount > 0 ? totalScore / factorCount : 0.5;

    // Make buy decision based on score and additional criteria
    result.buyDecision = 
      result.score >= 0.7 && // Good overall score
      !rugCheckData.rugged && // Not rugged
      rugCheckData.totalMarketLiquidity > 5000 && // Minimum liquidity
      topHolderConcentration < 80; // Top holders don't own too much

    return result;
  }
} 
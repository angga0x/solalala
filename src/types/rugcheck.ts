// RugCheck API response types
export interface RugCheckTopHolder {
  address: string;
  amount: number;
  decimals: number;
  pct: number;
  uiAmount: number;
  uiAmountString: string;
  owner: string;
  insider: boolean;
}

export interface RugCheckTokenMeta {
  name: string;
  symbol: string;
  uri: string;
  mutable: boolean;
  updateAuthority: string;
}

export interface RugCheckToken {
  mintAuthority: string | null;
  supply: number;
  decimals: number;
  isInitialized: boolean;
  freezeAuthority: string | null;
}

export interface RugCheckFileMeta {
  description: string;
  name: string;
  symbol: string;
  image: string;
}

export interface RugCheckTransferFee {
  pct: number;
  maxAmount: number;
  authority: string;
}

export interface RugCheckKnownAccount {
  name: string;
  type: string;
}

export interface RugCheckLiquidityAccount {
  mint: string;
  owner: string;
  amount: number;
  delegate: string | null;
  state: number;
  delegatedAmount: number;
  closeAuthority: string | null;
}

export interface RugCheckLiquidityPool {
  baseMint: string;
  quoteMint: string;
  lpMint: string;
  quotePrice: number;
  basePrice: number;
  base: number;
  quote: number;
  reserveSupply: number;
  currentSupply: number;
  quoteUSD: number;
  baseUSD: number;
  pctReserve: number;
  pctSupply: number;
  holders: any | null;
  totalTokensUnlocked: number;
  tokenSupply: number;
  lpLocked: number;
  lpUnlocked: number;
  lpLockedPct: number;
  lpLockedUSD: number;
  lpMaxSupply: number;
  lpCurrentSupply: number;
  lpTotalSupply: number;
}

export interface RugCheckMarket {
  pubkey: string;
  marketType: string;
  mintA: string;
  mintB: string;
  mintLP: string;
  liquidityA: string;
  liquidityB: string;
  mintAAccount: RugCheckToken;
  mintBAccount: RugCheckToken;
  mintLPAccount: RugCheckToken;
  liquidityAAccount: RugCheckLiquidityAccount;
  liquidityBAccount: RugCheckLiquidityAccount;
  lp: RugCheckLiquidityPool;
}

export interface RugCheckResponse {
  mint: string;
  tokenProgram: string;
  creator: string;
  creatorBalance: number;
  token: RugCheckToken;
  token_extensions: any | null;
  tokenMeta: RugCheckTokenMeta;
  topHolders: RugCheckTopHolder[];
  freezeAuthority: string | null;
  mintAuthority: string | null;
  risks: string[];
  score: number;
  score_normalised: number;
  fileMeta: RugCheckFileMeta;
  lockerOwners: Record<string, any>;
  lockers: Record<string, any>;
  markets: RugCheckMarket[];
  totalMarketLiquidity: number;
  totalLPProviders: number;
  totalHolders: number;
  price: number;
  rugged: boolean;
  tokenType: string;
  transferFee: RugCheckTransferFee;
  knownAccounts: Record<string, RugCheckKnownAccount>;
  events: any[];
  verification: any | null;
  graphInsidersDetected: number;
  insiderNetworks: any | null;
  detectedAt: string;
  creatorTokens: any | null;
} 
import { PumpFunGraduatedEvent, TokenPosition } from '../types';

/**
 * Contoh data event graduasi token dari pump.fun untuk testing
 */
export const sampleGraduatedEvent: PumpFunGraduatedEvent = {
  coinMint: 'EMDfkC2xD1xbNMN1LhXj2vGgvKQRu8j48LUsTTuVK2L7',
  symbol: 'PUMP',
  name: 'Pump Token',
  coinAta: '8CnAXNVNqfcDQeWrNJ7jvSy9rWqFw5GfTPmHGCnJrAry',
  lpMint: 'DvG8XBQRHXzK9r6RGLzDNYQXbGCTqWLMQvE8BqxsdKjo',
  numHolders: 256,
  price: 0.00021,
  marketCap: 210000,
  coinSupply: 1000000000,
  sniperCount: 25,
  website: 'https://example.com',
  twitter: 'https://twitter.com/example',
  telegram: 'https://t.me/example',
  discord: 'https://discord.gg/example',
  devHoldingsPercentage: '15',
  imageUrl: 'https://ipfs.io/ipfs/bafybeif52omjcr557mfxihmldnbtzzurqo6je2vcbgpvgxq3pdsbi2k6yi',
  creationTime: 1749895344630,
  graduationDate: 1749895607980,
  volume: 107.2346,
  holders: [
    {
      holderId: 'Bs4S4k9nnCGDi6fUQZk5rfYt3XJotVQRKDCiU6ZxENN9',
      ownedPercentage: 15.2,
      totalTokenAmountHeld: 152000000,
      isSniper: false
    },
    {
      holderId: '75LBPQVVhWGQ2m93VZfkVPH2xKMUPzA3wTw9FgL6WU5J',
      ownedPercentage: 5.8,
      totalTokenAmountHeld: 58000000,
      isSniper: false
    }
  ]
};

/**
 * Contoh data event graduasi token buruk dari pump.fun untuk testing
 */
export const badGraduatedEvent: PumpFunGraduatedEvent = {
  coinMint: 'BADNfkC2xD1xbNMN1LhXj2vGgvKQRu8j48LUsTTuVK2L7',
  symbol: 'BAD',
  name: 'Bad Token',
  coinAta: '8CnAXNVNqfcDQeWrNJ7jvSy9rWqFw5GfTPmHGCnJrAry',
  lpMint: 'DvG8XBQRHXzK9r6RGLzDNYQXbGCTqWLMQvE8BqxsdKjo',
  numHolders: 45,
  price: 0.0000005,
  marketCap: 5000,
  coinSupply: 10000000000,
  sniperCount: 120,
  website: '',
  twitter: undefined,
  telegram: undefined,
  discord: undefined,
  devHoldingsPercentage: '72',
  imageUrl: 'https://ipfs.io/ipfs/bafybeif52omjcr557mfxihmldnbtzzurqo6je2vcbgpvgxq3pdsbi2k6yi',
  creationTime: 1749895344630,
  graduationDate: 1749895607980,
  volume: 10.25,
  holders: [
    {
      holderId: 'Bs4S4k9nnCGDi6fUQZk5rfYt3XJotVQRKDCiU6ZxENN9',
      ownedPercentage: 72.66,
      totalTokenAmountHeld: 7266080334.91119,
      isSniper: true
    },
    {
      holderId: 'F5o7ro8fAgUaFmwkdMVqC8a7a9a6Y85qJDHKS4wAccfo',
      ownedPercentage: 0.86,
      totalTokenAmountHeld: 86063482.8978,
      isSniper: true
    }
  ]
};

/**
 * Contoh posisi token untuk testing
 */
export const samplePosition: TokenPosition = {
  tokenMint: 'EMDfkC2xD1xbNMN1LhXj2vGgvKQRu8j48LUsTTuVK2L7',
  tokenSymbol: 'PUMP',
  tokenName: 'Pump Token',
  purchaseAmount: 0.5, // SOL
  purchasePrice: 0.0002,
  purchaseTimestamp: Date.now() - 3600000, // 1 jam yang lalu
  quantity: 2500, // token
  stopLossPrice: 0.00016,
  takeProfitPrice: 0.0003
}; 
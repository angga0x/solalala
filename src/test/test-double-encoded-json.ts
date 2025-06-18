import { PumpFunListener } from '../core/pump-fun-listener';
import { PumpFunGraduatedEvent } from '../types';
import logger from '../utils/logger';

// Sample double-encoded advancedCoinGraduated event data from the log
const sampleDoubleEncodedEventData = `{"dev":"HyYNVYmnFmi87NsQqWzLJhUTPBKQUfgfhdbBa554nMFF","coinMint":"7EcwJiL5J6sXfRoWKVGzUzCTBBtDebfCSsFfLvJppump","name":"beedog","ticker":"beedog","imageUrl":"https://ipfs.io/ipfs/QmapAq9WtNrtyaDtjZPAHHNYmpSZAQU6HywwvfSWq4dQVV","marketCap":59023.49941040834,"volume":"111015.08209681953","numHolders":247,"bondingCurveProgress":100,"creationTime":1729719556711,"graduationDate":1750273184503,"poolAddress":"2Y3PgbXkVQLWbay9AbetsLD1xwDyvg1L9kZKERVmx7xT","allTimeHighMarketCap":"58468.86","currentMarketPrice":0,"sniperCount":4,"twitter":"https://x.com/truth_terminal/status/1849203795357553011","telegram":null,"website":null,"holders":[{"holderId":"AeB4r4f5f6Lzd7e5BEJLmmPebC69zEvUzp5H3sDqZAd5","ownedPercentage":0.7106,"totalTokenAmountHeld":7106372.350618,"isSniper":0},{"holderId":"CG3JsbhsghpDmvZ4nHQV3xXbb7yADCVnh92ypNWK7Q5w","ownedPercentage":0.0093,"totalTokenAmountHeld":93274.336462,"isSniper":0}]}`;

// Create a test function to simulate receiving a double-encoded advancedCoinGraduated event
async function testDoubleEncodedEvent() {
  logger.info('Starting double-encoded event test...');

  // Create an instance of PumpFunListener
  const listener = new PumpFunListener();

  // Register a callback for graduated events
  listener.onGraduatedEvent((event: PumpFunGraduatedEvent) => {
    logger.info('Received graduated event callback:');
    logger.info(`Symbol: ${event.symbol}`);
    logger.info(`Name: ${event.name}`);
    logger.info(`Mint: ${event.coinMint}`);
    logger.info(`Pool Address: ${event.lpMint}`);
    logger.info(`Market Cap: ${event.marketCap} SOL`);
    logger.info(`Price: ${event.price} SOL`);
    logger.info(`Number of Holders: ${event.numHolders}`);
    logger.info(`Dev Holdings: ${event.devHoldingsPercentage}%`);
    logger.info(`Volume: ${event.volume} SOL`);
    logger.info(`Creation Time: ${new Date(event.creationTime).toISOString()}`);
    logger.info(`Graduation Date: ${new Date(event.graduationDate).toISOString()}`);
    logger.info(`Holders: ${event.holders.length}`);

    // Access the first holder data as an example
    if (event.holders.length > 0) {
      const firstHolder = event.holders[0];
      logger.info(`First Holder ID: ${firstHolder.holderId}`);
      logger.info(`First Holder Percentage: ${firstHolder.ownedPercentage}%`);
      logger.info(`First Holder Amount: ${firstHolder.totalTokenAmountHeld}`);
      logger.info(`First Holder Is Sniper: ${firstHolder.isSniper}`);
    }
  });

  // Test with direct JSON object
  logger.info('Testing with direct JSON object:');
  const directData = JSON.parse(sampleDoubleEncodedEventData);
  const processMethod = (listener as any)['processAdvancedCoinGraduated'];
  if (typeof processMethod === 'function') {
    processMethod.call(listener, JSON.stringify(directData));
  }

  // Test with double-encoded JSON string
  logger.info('\nTesting with double-encoded JSON string:');
  const doubleEncodedData = JSON.stringify(sampleDoubleEncodedEventData);
  if (typeof processMethod === 'function') {
    processMethod.call(listener, doubleEncodedData);
  }
}

// Run the test
testDoubleEncodedEvent()
  .then(() => {
    logger.info('Test completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    logger.error(`Test failed: ${error}`);
    process.exit(1);
  }); 
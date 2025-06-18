import { PumpFunListener } from '../core/pump-fun-listener';
import { PumpFunGraduatedEvent } from '../types';
import logger from '../utils/logger';

// Sample advancedCoinGraduated event data
const sampleEventData = `{"ticker":"RICOMASK","coinMint":"BmPXLvdLencgjVVCsuKDyLsuYAnC3heJF9CPqraTaYdv","dev":"Bs4S4k9nnCGDi6fUQZk5rfYt3XJotVQRKDCiU6ZxENN9","name":"RICOMASK","imageUrl":"https://ipfs.io/ipfs/bafybeif52omjcr557mfxihmldnbtzzurqo6je2vcbgpvgxq3pdsbi2k6yi","creationTime":1749895344630,"marketCap":59635.15,"numHolders":15,"volume":107.2346,"bondingCurveProgress":100,"sniperCount":2,"currentMarketPrice":0,"allTimeHighMarketCap":59635.15,"graduationDate":1749895607980,"poolAddress":"8ViR4eWDk1v9wCuCdk56jqeRVzJ7zaz5jzaCFA9EVxY1","twitter":null,"telegram":null,"website":null,"holders":[{"holderId":"Bs4S4k9nnCGDi6fUQZk5rfYt3XJotVQRKDCiU6ZxENN9","ownedPercentage":72.6608,"totalTokenAmountHeld":726608033.491119,"isSniper":true},{"holderId":"75LBPQVVhWGQ2m93VZfkVPH2xKMUPzA3wTw9FgL6WU5J","ownedPercentage":0.8606,"totalTokenAmountHeld":8606348.28978,"isSniper":false},{"holderId":"o8trzFarepqgFyXKuaYEWtR5SjsVtveeCtjrbDmrVVc","ownedPercentage":0.834,"totalTokenAmountHeld":8340311.476994,"isSniper":false},{"holderId":"81keKt2xFDeCFgVUWnkSePENcAdzmJS6622ncbQCiPuc","ownedPercentage":0.8222,"totalTokenAmountHeld":8221689.003478,"isSniper":false},{"holderId":"eCw4wyBMQx434DmSRTzuRTmGwZZkx198JFn7cUJN51G","ownedPercentage":0.8076,"totalTokenAmountHeld":8075613.481162,"isSniper":false},{"holderId":"7v76191WnVoWm8KeCSS1QShiEkFVVvNDRD8Tjf6fy9JD","ownedPercentage":0.8062,"totalTokenAmountHeld":8061638.714988,"isSniper":false},{"holderId":"DRckg13Qk9nptJMrHEgp6PvXiwFdsBUBU434MUuetKek","ownedPercentage":0.8007,"totalTokenAmountHeld":8006535.979028,"isSniper":false},{"holderId":"FXw8ioKJm7MihYiqo28JPfv4aRjZhiQXJAGdNw4ugHsX","ownedPercentage":0.7973,"totalTokenAmountHeld":7973156.896936,"isSniper":false},{"holderId":"EF6gfJ9DC1dFDf8UKWXJFnGNSQGoLwkvRTxTWBux4ieT","ownedPercentage":0.4459,"totalTokenAmountHeld":4459142.865501,"isSniper":false},{"holderId":"56S29mZ3wqvw8hATuUUFqKhGcSGYFASRRFNT38W8q7G3","ownedPercentage":0.3325,"totalTokenAmountHeld":3325364.642168,"isSniper":false},{"holderId":"8ngeRsgktbK9w2Qfr7eQL3ZYvqZt1SjaK4eh6igVBjgv","ownedPercentage":0.0422,"totalTokenAmountHeld":422225.672341,"isSniper":false},{"holderId":"4wv4Nn7VzcRJXp7KeX3eZibif8vs3qAump4sZ6GKyYEk","ownedPercentage":0.0413,"totalTokenAmountHeld":413395.317699,"isSniper":false},{"holderId":"EYNZaNJcAY7nU7gMAAsePTnsjLiw9doEuutbkucRS3m9","ownedPercentage":0.0408,"totalTokenAmountHeld":407666.560007,"isSniper":false},{"holderId":"BT1VLeWdB6LBLPt5YikMyFh17DP43qLRVbp3hhaSwXLq","ownedPercentage":0.0134,"totalTokenAmountHeld":133774.285965,"isSniper":false},{"holderId":"FDEf9xttxGNG832wm4qeg4q7ga4PU7QU5mUuVczShKve","ownedPercentage":0.0045,"totalTokenAmountHeld":45103.322834,"isSniper":false},{"holderId":"F5o7ro8fAgUaFmwkdMVqC8a7a9a6Y85qJDHKS4wAccfo","ownedPercentage":0,"totalTokenAmountHeld":0,"isSniper":true},{"holderId":"BoBo1kUY4U6cE2XkwjZYH7NoDfGjSWmtvnfHHP78YcYZ","ownedPercentage":0,"totalTokenAmountHeld":0,"isSniper":false}],"devHoldingsPercentage":"73"}`;

// Create a test function to simulate receiving an advancedCoinGraduated event
async function testGraduatedEvent() {
  logger.info('Starting graduated event test...');

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

  // Directly call the private method using type assertion and Function.prototype.call
  const processMethod = (listener as any)['processAdvancedCoinGraduated'];
  if (typeof processMethod === 'function') {
    processMethod.call(listener, sampleEventData);
  } else {
    logger.error('Could not access processAdvancedCoinGraduated method');
  }
}

// Run the test
testGraduatedEvent()
  .then(() => {
    logger.info('Test completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    logger.error(`Test failed: ${error}`);
    process.exit(1);
  }); 
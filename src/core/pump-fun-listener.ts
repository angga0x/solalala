import { config } from '../config/env';
import logger from '../utils/logger';
import { PumpFunGraduatedEvent, IListener } from '../types';
import WebSocket from 'ws';
import fs from 'fs';
import path from 'path';

// Jumlah maksimum event yang disimpan dalam memori
const MAX_STORED_EVENTS = 50;

export class PumpFunListener implements IListener {
  private socket: WebSocket | null = null;
  private isConnected: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 10;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private graduatedEventCallbacks: ((event: PumpFunGraduatedEvent) => void)[] = [];
  private messageBuffer: string = ''; // Buffer untuk menyimpan pesan yang belum lengkap
  private pendingPayload: { subject: string; sid: number; size: number } | null = null;
  
  // Menyimpan event terbaru untuk diakses nanti
  private recentEvents: Array<{
    timestamp: number;
    type: string;
    data: any;
  }> = [];
  
  // Log file path
  private logFilePath: string = path.join(process.cwd(), 'pumpfun-events.log');

  constructor() {
    this.reconnectAttempts = 0;
    // Coba baca event yang sebelumnya disimpan jika ada
    this.loadStoredEvents();
  }

  async start(): Promise<void> {
    try {
      logger.info('Starting PumpFun listener...');
      await this.connect();
    } catch (error) {
      logger.error(`Failed to start PumpFun listener: ${error}`);
      throw error;
    }
  }

  stop(): void {
    logger.info('Stopping PumpFun listener...');
    
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    
    this.isConnected = false;
    this.messageBuffer = '';
    this.pendingPayload = null;
    logger.info('PumpFun listener stopped');
  }

  onGraduatedEvent(callback: (event: PumpFunGraduatedEvent) => void): void {
    this.graduatedEventCallbacks.push(callback);
    logger.debug('Added graduated event callback');
  }
  
  // Mendapatkan event terbaru yang telah diproses
  getRecentEvents(): Array<{timestamp: number; type: string; data: any}> {
    return [...this.recentEvents];
  }
  
  // Menyimpan event ke dalam array terbatas dan file log
  private storeEvent(type: string, data: any): void {
    const eventEntry = {
      timestamp: Date.now(),
      type,
      data
    };
    
    // Tambahkan ke array dengan batasan jumlah maksimum
    this.recentEvents.unshift(eventEntry);
    if (this.recentEvents.length > MAX_STORED_EVENTS) {
      this.recentEvents.pop();
    }
    
    // Tulis ke file log
    try {
      const logEntry = JSON.stringify({
        timestamp: new Date(eventEntry.timestamp).toISOString(),
        type: eventEntry.type,
        data: eventEntry.data
      }) + '\n';
      
      fs.appendFileSync(this.logFilePath, logEntry);
    } catch (error) {
      logger.error(`Failed to write event to log file: ${error}`);
    }
  }
  
  // Membaca event yang tersimpan dari file log
  private loadStoredEvents(): void {
    try {
      if (fs.existsSync(this.logFilePath)) {
        const fileContent = fs.readFileSync(this.logFilePath, 'utf8');
        const lines = fileContent.trim().split('\n');
        
        // Ambil beberapa baris terakhir sesuai MAX_STORED_EVENTS
        const recentLines = lines.slice(-MAX_STORED_EVENTS);
        
        for (const line of recentLines) {
          try {
            const event = JSON.parse(line);
            this.recentEvents.push({
              timestamp: new Date(event.timestamp).getTime(),
              type: event.type,
              data: event.data
            });
          } catch (parseError) {
            logger.warn(`Failed to parse stored event: ${parseError}`);
          }
        }
        
        logger.info(`Loaded ${this.recentEvents.length} stored events`);
      }
    } catch (error) {
      logger.warn(`Failed to load stored events: ${error}`);
    }
  }

  private async connect(): Promise<void> {
    try {
      // Close any existing socket
      if (this.socket) {
        this.socket.close();
      }

      // Reset message buffer
      this.messageBuffer = '';
      this.pendingPayload = null;

      logger.info(`Connecting to PumpFun WebSocket: ${config.pumpfun.websocketUrl}`);
      
      // Create a new native WebSocket connection
      this.socket = new WebSocket(config.pumpfun.websocketUrl);

      // Set up event listeners
      this.setupSocketEventListeners();

      // Wait for connection to be established
      await new Promise<void>((resolve, reject) => {
        if (!this.socket) return reject(new Error('Socket is null'));

        const connectTimeout = setTimeout(() => {
          reject(new Error('Connection timeout'));
        }, 10000);

        this.socket.onopen = () => {
          clearTimeout(connectTimeout);
          logger.info('WebSocket connection opened, sending NATS CONNECT');
          this.sendNatsConnect();
          resolve();
        };

        this.socket.onerror = (error: WebSocket.ErrorEvent) => {
          clearTimeout(connectTimeout);
          reject(error);
        };
      });

      this.reconnectAttempts = 0;
      logger.info('Connected to PumpFun WebSocket');
    } catch (error) {
      logger.error(`Failed to connect to PumpFun WebSocket: ${error}`);
      await this.scheduleReconnect();
    }
  }
  
  private sendNatsConnect(): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      logger.error('Cannot send NATS CONNECT: Socket not open');
      return;
    }
    
    // Kirim pesan CONNECT untuk protokol NATS
    const connectMsg = 'CONNECT {"no_responders":true,"protocol":1,"verbose":false,"pedantic":false,"user":"subscriber","pass":"OktDhmZ2D3CtYUiM","lang":"nats.ws","version":"1.29.2","headers":true}\r\n';
    logger.debug('Sending NATS CONNECT message');
    
    // Log pesan yang dikirim
    this.storeEvent('websocket_raw', {
      timestamp: Date.now(),
      direction: 'SENT',
      data: connectMsg
    });
    
    this.socket.send(connectMsg);
  }
  
  private subscribeToEvents(): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      logger.error('Cannot subscribe to events: Socket not open');
      return;
    }
    
    // Kirim pesan SUB untuk berlangganan event yang diinginkan
    logger.info('Subscribing to PumpFun events');
    
    try {
      // Subscribe ke coinImageUpdated events
      const sub1 = 'SUB coinImageUpdated.> 1\r\n';
      this.socket.send(sub1);
      this.storeEvent('websocket_raw', {
        timestamp: Date.now(),
        direction: 'SENT',
        data: sub1
      });
      logger.debug('Subscribed to coinImageUpdated events');
      
      // Subscribe ke advancedCoinGraduated events
      const sub2 = 'SUB advancedCoinGraduated 2\r\n';
      this.socket.send(sub2);
      this.storeEvent('websocket_raw', {
        timestamp: Date.now(),
        direction: 'SENT',
        data: sub2
      });
      logger.debug('Subscribed to advancedCoinGraduated events');
      
      // Subscribe ke advancedNewCoinCreated events
      const sub3 = 'SUB advancedNewCoinCreated 3\r\n';
      this.socket.send(sub3);
      this.storeEvent('websocket_raw', {
        timestamp: Date.now(),
        direction: 'SENT',
        data: sub3
      });
      logger.debug('Subscribed to advancedNewCoinCreated events');
    } catch (error) {
      logger.error(`Error subscribing to events: ${error}`);
      // Coba reconnect jika gagal subscribe
      this.scheduleReconnect();
    }
  }

  private setupSocketEventListeners(): void {
    if (!this.socket) return;

    // Handle connection open event
    this.socket.onopen = () => {
      logger.info('Connected to PumpFun WebSocket');
      this.reconnectAttempts = 0;
      this.sendNatsConnect();
    };

    // Handle connection close event
    this.socket.onclose = (event: WebSocket.CloseEvent) => {
      logger.warn(`Disconnected from PumpFun WebSocket: ${event.code} - ${event.reason}`);
      this.isConnected = false;
      this.messageBuffer = '';
      this.pendingPayload = null;
      this.scheduleReconnect();
    };

    // Handle connection error event
    this.socket.onerror = (error: WebSocket.ErrorEvent) => {
      logger.error(`Connection error: ${error}`);
      // WebSocket will automatically close after error
      // scheduleReconnect will be called by onclose handler
    };

    // Handle incoming messages
    this.socket.onmessage = (event: WebSocket.MessageEvent) => {
      try {
        const data = event.data.toString();
        
        // Log data raw untuk debugging
        const rawEvent = {
          timestamp: Date.now(),
          direction: 'RECEIVED',
          data: data
        };
        
        // Simpan semua pesan WebSocket yang diterima
        this.storeEvent('websocket_raw', rawEvent);
        
        // Log data untuk debugging level
        if (data.length < 100) {
          logger.debug(`Received WebSocket data: ${data}`);
        } else {
          logger.debug(`Received WebSocket data: ${data.substring(0, 100)}... (${data.length} bytes)`);
        }
        
        // Tambahkan data ke buffer
        this.messageBuffer += data;
        
        // Proses buffer pesan
        this.processBuffer();
      } catch (error) {
        logger.error(`Error processing WebSocket message: ${error}`);
      }
    };
  }
  
  private processBuffer(): void {
    try {
      // Jika ada payload yang tertunda, proses itu terlebih dahulu
      if (this.pendingPayload) {
        if (this.messageBuffer.length >= this.pendingPayload.size) {
          logger.debug(`Processing pending payload for subject: ${this.pendingPayload.subject}, size: ${this.pendingPayload.size}`);
          
          const payload = this.messageBuffer.substring(0, this.pendingPayload.size);
          this.messageBuffer = this.messageBuffer.substring(this.pendingPayload.size);
          
          // Proses payload berdasarkan subject
          if (this.pendingPayload.subject === 'advancedCoinGraduated') {
            this.processAdvancedCoinGraduated(payload);
          } else if (this.pendingPayload.subject === 'advancedNewCoinCreated') {
            logger.debug(`Received advancedNewCoinCreated event`);
            // Proses advancedNewCoinCreated jika diperlukan
          } else if (this.pendingPayload.subject.startsWith('coinImageUpdated.')) {
            logger.debug(`Received coinImageUpdated event`);
            // Proses coinImageUpdated jika diperlukan
          }
          
          const subject = this.pendingPayload.subject;
          this.pendingPayload = null;
          
          // Cek CRLF setelah payload (jika ada)
          if (this.messageBuffer.startsWith('\r\n')) {
            logger.debug(`Found CRLF after payload for ${subject}`);
            this.messageBuffer = this.messageBuffer.substring(2);
          }
          
          // Lanjutkan proses buffer untuk pesan lain
          this.processBuffer();
          return;
        } else {
          // Belum cukup data untuk payload, tunggu lebih banyak data
          logger.debug(`Waiting for more data. Have ${this.messageBuffer.length} bytes, need ${this.pendingPayload.size} bytes for subject ${this.pendingPayload.subject}`);
          return;
        }
      }
      
      // Cari pesan NATS yang lengkap (diakhiri dengan \r\n)
      const endOfLine = this.messageBuffer.indexOf('\r\n');
      if (endOfLine === -1) {
        // Tidak ada pesan lengkap, tunggu lebih banyak data
        if (this.messageBuffer.length > 0) {
          logger.debug(`Incomplete message in buffer (${this.messageBuffer.length} bytes), waiting for more data`);
        }
        return;
      }
      
      // Ekstrak satu baris pesan
      const line = this.messageBuffer.substring(0, endOfLine);
      this.messageBuffer = this.messageBuffer.substring(endOfLine + 2); // +2 untuk \r\n
      
      // Proses baris pesan
      if (line.startsWith('PING')) {
        // Respon PING dengan PONG
        logger.debug('Received PING from server, sending PONG');
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
          const pongMsg = 'PONG\r\n';
          this.socket.send(pongMsg);
          
          // Log PONG response
          this.storeEvent('websocket_raw', {
            timestamp: Date.now(),
            direction: 'SENT',
            data: pongMsg
          });
        }
        
        // Jika ini adalah PING pertama setelah connect, kirim SUB
        if (!this.isConnected) {
          logger.info('Received first PING, we are connected to NATS server');
          this.isConnected = true;
          this.subscribeToEvents();
        }
      } else if (line.startsWith('INFO')) {
        // Abaikan pesan INFO
        logger.debug(`Received INFO from server: ${line}`);
      } else if (line.startsWith('MSG')) {
        // Pecah baris MSG
        // Format: MSG subject sid size
        const parts = line.split(' ');
        if (parts.length >= 4) {
          const subject = parts[1];
          const sid = parseInt(parts[2], 10);
          const size = parseInt(parts[3], 10);
          
          logger.debug(`Received MSG header: subject=${subject}, sid=${sid}, size=${size}`);
          
          // Set pending payload untuk diproses nanti
          this.pendingPayload = { subject, sid, size };
          
          // Langsung coba proses jika data sudah cukup
          this.processBuffer();
        } else {
          logger.warn(`Invalid MSG format: ${line}`);
        }
      } else {
        logger.debug(`Received unknown NATS message: ${line}`);
      }
      
      // Jika masih ada data di buffer, lanjutkan pemrosesan
      if (this.messageBuffer.length > 0) {
        this.processBuffer();
      }
    } catch (error) {
      logger.error(`Error processing buffer: ${error}`);
      // Jika ada error, reset buffer
      this.messageBuffer = '';
      this.pendingPayload = null;
    }
  }
  
  private processAdvancedCoinGraduated(payload: string): void {
    try {
      // Sanitize payload for logging to prevent issues with non-printable characters
      const safePayloadPreview = payload
        .substring(0, 100)
        .replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
        .replace(/[^\x00-\x7F]/g, '?');
      
      logger.debug(`Processing advancedCoinGraduated payload: ${safePayloadPreview}...`);
      
      // Parse the JSON payload - handle both direct JSON objects and stringified JSON
      let eventData;
      try {
        // First, try to parse the payload as JSON
        eventData = JSON.parse(payload);
        
        // Check if the result is a string (double-encoded JSON)
        if (typeof eventData === 'string') {
          logger.debug('Detected double-encoded JSON, parsing inner JSON string');
          eventData = JSON.parse(eventData);
        }
      } catch (parseError) {
        logger.error(`Failed to parse JSON payload: ${parseError}`);
        // Log a sanitized version of the payload
        logger.debug(`Raw payload (sanitized): ${payload.replace(/[\u0000-\u001F\u007F-\u009F]/g, '').replace(/[^\x00-\x7F]/g, '?')}`);
        return;
      }
      
      // Check if eventData is valid
      if (!eventData) {
        logger.warn('Parsed eventData is null or undefined');
        return;
      }
      
      // Sanitize token symbol and name for logging
      const safeSymbol = (eventData.ticker || eventData.symbol || 'Unknown')
        .replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
        .replace(/[^\x00-\x7F]/g, '?')
        .trim()
        .substring(0, 20);
      
      logger.info(`Received graduated coin event: ${safeSymbol}`);
      
      // Simpan event raw ke dalam log
      this.storeEvent('advancedCoinGraduated', eventData);
      
      // Validate event data
      if (!this.validateEventData(eventData)) {
        logger.warn(`Invalid event data for advancedCoinGraduated: ${safeSymbol}`);
        return;
      }

      // Sanitize string fields to prevent issues with non-printable characters
      const sanitizeString = (input: string | null | undefined): string => {
        if (input === null || input === undefined) return '';
        if (typeof input !== 'string') return String(input);
        return input
          .replace(/[\u0000-\u001F\u007F-\u009F]/g, '') // Remove control characters
          .replace(/[^\x00-\x7F]/g, '?') // Replace non-ASCII with ?
          .trim()
          .substring(0, 100); // Limit length
      };

      // Parse event data berdasarkan format JSON yang diberikan
      const event: PumpFunGraduatedEvent = {
        coinMint: sanitizeString(eventData.coinMint),
        symbol: sanitizeString(eventData.ticker || eventData.symbol || 'UNKNOWN'),
        name: sanitizeString(eventData.name || eventData.ticker || eventData.symbol || 'Unknown'),
        coinAta: sanitizeString(eventData.coinAta || ''),
        lpMint: sanitizeString(eventData.poolAddress || ''), // Use poolAddress as lpMint
        numHolders: typeof eventData.numHolders === 'number' ? eventData.numHolders : parseInt(String(eventData.numHolders || '0')) || 0,
        price: typeof eventData.currentMarketPrice === 'number' ? eventData.currentMarketPrice : parseFloat(String(eventData.currentMarketPrice || '0')) || 0,
        marketCap: typeof eventData.marketCap === 'number' ? eventData.marketCap : parseFloat(String(eventData.marketCap || '0')) || 0,
        coinSupply: typeof eventData.totalSupply === 'number' ? eventData.totalSupply : parseFloat(String(eventData.totalSupply || '0')) || 0,
        sniperCount: typeof eventData.sniperCount === 'number' ? eventData.sniperCount : parseInt(String(eventData.sniperCount || '0')) || 0,
        website: sanitizeString(eventData.website || null),
        twitter: sanitizeString(eventData.twitter || null),
        telegram: sanitizeString(eventData.telegram || null),
        discord: sanitizeString(eventData.discord || null),
        devHoldingsPercentage: sanitizeString(eventData.devHoldingsPercentage || '0'),
        imageUrl: sanitizeString(eventData.imageUrl || ''),
        creationTime: typeof eventData.creationTime === 'number' ? eventData.creationTime : parseInt(String(eventData.creationTime || '0')) || 0,
        graduationDate: typeof eventData.graduationDate === 'number' ? eventData.graduationDate : parseInt(String(eventData.graduationDate || '0')) || 0,
        volume: typeof eventData.volume === 'string' ? parseFloat(eventData.volume) : (typeof eventData.volume === 'number' ? eventData.volume : 0),
        holders: Array.isArray(eventData.holders) ? eventData.holders.map((holder: {
          holderId: string;
          ownedPercentage?: number | string;
          totalTokenAmountHeld?: number | string;
          isSniper?: boolean | number | string;
        }) => ({
          holderId: sanitizeString(holder.holderId),
          ownedPercentage: typeof holder.ownedPercentage === 'number' ? holder.ownedPercentage : parseFloat(String(holder.ownedPercentage || '0')) || 0,
          totalTokenAmountHeld: typeof holder.totalTokenAmountHeld === 'number' ? holder.totalTokenAmountHeld : parseFloat(String(holder.totalTokenAmountHeld || '0')) || 0,
          isSniper: holder.isSniper === 1 || holder.isSniper === true || holder.isSniper === '1' || holder.isSniper === 'true'
        })) : []
      };

      // Use sanitized values in logs
      logger.info(`Processing graduated token: ${event.symbol} (${event.coinMint}), price: ${event.price} SOL, marketCap: ${event.marketCap} SOL, holders: ${event.numHolders}, dev: ${event.devHoldingsPercentage}%`);
      
      // Simpan event yang sudah diproses ke dalam log
      this.storeEvent('processedGraduatedEvent', {
        symbol: event.symbol,
        name: event.name,
        coinMint: event.coinMint,
        price: event.price,
        marketCap: event.marketCap,
        numHolders: event.numHolders,
        devHoldingsPercentage: event.devHoldingsPercentage,
        time: new Date().toISOString()
      });
      
      // Call all registered callbacks
      const callbackCount = this.graduatedEventCallbacks.length;
      logger.debug(`Calling ${callbackCount} registered callbacks`);
      
      for (const callback of this.graduatedEventCallbacks) {
        try {
          callback(event);
        } catch (error) {
          logger.error(`Error in graduatedEvent callback: ${error}`);
        }
      }
    } catch (error) {
      // Sanitize payload for error logging
      const safePayload = payload
        .replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
        .replace(/[^\x00-\x7F]/g, '?')
        .substring(0, 200);
      
      logger.error(`Error processing advancedCoinGraduated event: ${error}`);
      logger.debug(`Raw payload (sanitized): ${safePayload}`);
      
      // Store error event for debugging
      this.storeEvent('advancedCoinGraduatedError', {
        error: String(error),
        timestamp: new Date().toISOString(),
        payloadPreview: safePayload.substring(0, 100)
      });
    }
  }

  private validateEventData(data: any): boolean {
    if (!data) {
      logger.warn('Received null or undefined event data');
      return false;
    }

    // Log the entire event data for debugging
    logger.debug(`Validating event data: ${JSON.stringify(data, null, 2)}`);

    // Check for coinMint field with more detailed logging
    if (!data.coinMint) {
      logger.warn('Event data missing coinMint field');
      // Try to use dev field as a fallback if available
      if (data.dev && typeof data.dev === 'string') {
        logger.info(`Using dev field as fallback for coinMint: ${data.dev}`);
        data.coinMint = data.dev;
      } else {
        return false;
      }
    } else if (typeof data.coinMint !== 'string') {
      logger.warn(`coinMint is not a string: ${typeof data.coinMint}`);
      return false;
    }

    // Check for ticker or symbol with more detailed logging
    if (!data.ticker && !data.symbol) {
      logger.warn('Event data missing both ticker and symbol fields');
      return false;
    }
    
    if (data.ticker && typeof data.ticker !== 'string') {
      logger.warn(`ticker is not a string: ${typeof data.ticker}`);
      return false;
    }
    
    if (data.symbol && typeof data.symbol !== 'string') {
      logger.warn(`symbol is not a string: ${typeof data.symbol}`);
      return false;
    }
    
    // Check for poolAddress which is required for LP trading
    if (!data.poolAddress) {
      logger.warn('Event data missing poolAddress field');
      // Some events might use different field names
      if (data.lpMint) {
        logger.info(`Using lpMint as fallback for poolAddress: ${data.lpMint}`);
        data.poolAddress = data.lpMint;
      } else {
        return false;
      }
    } else if (typeof data.poolAddress !== 'string') {
      logger.warn(`poolAddress is not a string: ${typeof data.poolAddress}`);
      return false;
    }

    // Ensure volume is properly formatted
    if (data.volume) {
      if (typeof data.volume === 'string') {
        try {
          data.volume = parseFloat(data.volume);
        } catch (e) {
          logger.warn(`Could not parse volume string: ${data.volume}`);
          data.volume = 0;
        }
      }
    }

    logger.debug('Event data validation passed');
    return true;
  }

  private async scheduleReconnect(): Promise<void> {
    // Clear any existing reconnect timeout
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    // Check if we've exceeded the maximum number of reconnect attempts
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.error(`Failed to reconnect after ${this.reconnectAttempts} attempts`);
      return;
    }

    this.reconnectAttempts++;
    
    // Calculate delay with exponential backoff (1s, 2s, 4s, 8s, etc.)
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 30000);
    
    logger.info(`Scheduling reconnect attempt ${this.reconnectAttempts} in ${delay}ms`);
    
    this.reconnectTimeout = setTimeout(async () => {
      try {
        logger.info(`Attempting to reconnect (attempt ${this.reconnectAttempts})`);
        await this.connect();
      } catch (error) {
        logger.error(`Reconnect attempt failed: ${error}`);
      }
    }, delay);
  }
} 
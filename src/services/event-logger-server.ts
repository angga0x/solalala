import http from 'http';
import fs from 'fs';
import path from 'path';
import { PumpFunListener } from '../core/pump-fun-listener';
import logger from '../utils/logger';

export class EventLoggerServer {
  private server: http.Server;
  private port: number;
  private pumpfunListener: PumpFunListener;
  
  constructor(pumpfunListener: PumpFunListener, port: number = 3001) {
    this.port = port;
    this.pumpfunListener = pumpfunListener;
    
    this.server = http.createServer((req, res) => {
      this.handleRequest(req, res);
    });
  }
  
  start(): void {
    this.server.listen(this.port, () => {
      logger.info(`Event logger server running at http://localhost:${this.port}`);
    });
  }
  
  stop(): void {
    this.server.close();
    logger.info('Event logger server stopped');
  }
  
  private handleRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    // Handle preflight OPTIONS request
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }
    
    // Only handle GET requests
    if (req.method !== 'GET') {
      res.writeHead(405, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Method not allowed' }));
      return;
    }
    
    const url = req.url || '/';
    
    if (url === '/') {
      // Serve HTML interface
      this.serveHtmlInterface(res);
    } else if (url === '/api/events') {
      // Return recent events as JSON
      this.serveRecentEvents(res);
    } else if (url === '/api/log') {
      // Return the full log file
      this.serveLogFile(res);
    } else {
      // Not found
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found' }));
    }
  }
  
  private serveHtmlInterface(res: http.ServerResponse): void {
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Pump.fun Event Logger</title>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 1200px;
          margin: 0 auto;
          padding: 20px;
          background-color: #f7f9fc;
        }
        h1 {
          color: #2c3e50;
          border-bottom: 2px solid #3498db;
          padding-bottom: 10px;
        }
        .card {
          background: white;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          margin-bottom: 20px;
          padding: 20px;
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        .card:hover {
          transform: translateY(-5px);
          box-shadow: 0 5px 15px rgba(0,0,0,0.1);
        }
        .event-type {
          display: inline-block;
          padding: 3px 8px;
          border-radius: 4px;
          font-size: 12px;
          font-weight: bold;
          color: white;
          background-color: #3498db;
          margin-bottom: 10px;
          margin-right: 10px;
        }
        .direction-tag {
          display: inline-block;
          padding: 3px 8px;
          border-radius: 4px;
          font-size: 12px;
          font-weight: bold;
          color: white;
          margin-bottom: 10px;
        }
        .sent {
          background-color: #2ecc71;
        }
        .received {
          background-color: #e74c3c;
        }
        .time {
          color: #7f8c8d;
          font-size: 14px;
          margin-bottom: 15px;
        }
        pre {
          background: #f8f8f8;
          border-radius: 4px;
          padding: 10px;
          overflow-x: auto;
          font-size: 14px;
        }
        .ws-message {
          background: #2c3e50;
          color: #ecf0f1;
          border-radius: 4px;
          padding: 10px;
          overflow-x: auto;
          font-size: 14px;
          font-family: monospace;
        }
        .actions {
          margin-bottom: 20px;
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          align-items: center;
        }
        button {
          background: #3498db;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
        }
        button:hover {
          background: #2980b9;
        }
        .filter-group {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          align-items: center;
          margin-left: 20px;
        }
        .filter-btn {
          background: #95a5a6;
          padding: 4px 10px;
          font-size: 12px;
        }
        .filter-btn.active {
          background: #16a085;
        }
        .empty-state {
          text-align: center;
          padding: 40px;
          color: #7f8c8d;
        }
        .loading {
          text-align: center;
          padding: 40px;
          color: #3498db;
        }
        .tabs {
          display: flex;
          border-bottom: 1px solid #ddd;
          margin-bottom: 20px;
        }
        .tab {
          padding: 10px 20px;
          cursor: pointer;
          border-radius: 4px 4px 0 0;
          margin-right: 5px;
        }
        .tab.active {
          background: #3498db;
          color: white;
        }
        .tab:hover:not(.active) {
          background: #eee;
        }
      </style>
    </head>
    <body>
      <h1>Pump.fun Event Logger</h1>
      
      <div class="tabs">
        <div class="tab active" data-tab="all">Semua Event</div>
        <div class="tab" data-tab="websocket">Log WebSocket</div>
        <div class="tab" data-tab="graduated">Token Graduated</div>
      </div>
      
      <div class="actions">
        <button id="refreshBtn">Refresh</button>
        <button id="downloadBtn">Download Log</button>
        
        <div class="filter-group">
          <span>Filter:</span>
          <button class="filter-btn active" data-filter="all">Semua</button>
          <button class="filter-btn" data-filter="websocket_raw">WebSocket</button>
          <button class="filter-btn" data-filter="advancedCoinGraduated">Graduated Event</button>
          <button class="filter-btn" data-filter="processedGraduatedEvent">Processed Event</button>
        </div>
      </div>
      
      <div id="events">
        <div class="loading">Loading events...</div>
      </div>
      
      <script>
        // Variabel global untuk data events
        let allEvents = [];
        let activeTab = 'all';
        let activeFilter = 'all';
        
        // Function to format timestamps
        function formatTime(timestamp) {
          const date = new Date(timestamp);
          return date.toLocaleString();
        }
        
        // Function to fetch and cache events
        async function fetchEvents() {
          const eventsContainer = document.getElementById('events');
          eventsContainer.innerHTML = '<div class="loading">Loading events...</div>';
          
          try {
            const response = await fetch('/api/events');
            allEvents = await response.json();
            
            // Render events based on current filter and tab
            renderEvents();
          } catch (error) {
            eventsContainer.innerHTML = '<div class="empty-state">Error loading events: ' + error.message + '</div>';
          }
        }
        
        // Function to render events based on filters
        function renderEvents() {
          const eventsContainer = document.getElementById('events');
          
          // Filter events based on active tab
          let filteredEvents = [...allEvents];
          
          if (activeTab === 'websocket') {
            filteredEvents = allEvents.filter(event => event.type === 'websocket_raw');
          } else if (activeTab === 'graduated') {
            filteredEvents = allEvents.filter(event => 
              event.type === 'advancedCoinGraduated' || 
              event.type === 'processedGraduatedEvent'
            );
          }
          
          // Apply additional type filter if not "all"
          if (activeFilter !== 'all') {
            filteredEvents = filteredEvents.filter(event => event.type === activeFilter);
          }
          
          if (filteredEvents.length === 0) {
            eventsContainer.innerHTML = '<div class="empty-state">No matching events found</div>';
            return;
          }
          
          eventsContainer.innerHTML = '';
          
          filteredEvents.forEach(event => {
            const card = document.createElement('div');
            card.className = 'card';
            
            const typeSpan = document.createElement('div');
            typeSpan.className = 'event-type';
            typeSpan.textContent = event.type;
            
            const timeDiv = document.createElement('div');
            timeDiv.className = 'time';
            timeDiv.textContent = formatTime(event.timestamp);
            
            card.appendChild(typeSpan);
            
            // If it's a websocket_raw event, show direction
            if (event.type === 'websocket_raw' && event.data.direction) {
              const directionSpan = document.createElement('div');
              directionSpan.className = 'direction-tag ' + event.data.direction.toLowerCase();
              directionSpan.textContent = event.data.direction;
              card.appendChild(directionSpan);
            }
            
            card.appendChild(timeDiv);
            
            // Special formatting for WebSocket messages
            if (event.type === 'websocket_raw') {
              const wsData = event.data.data || event.data;
              const messageDiv = document.createElement('div');
              messageDiv.className = 'ws-message';
              
              // Clean up the message content (handle control characters)
              const cleanMessage = wsData
                .replace(/\r/g, '\\r')
                .replace(/\n/g, '\\n');
              
              messageDiv.textContent = cleanMessage;
              card.appendChild(messageDiv);
            } else {
              // Normal JSON formatting for other events
              const dataPre = document.createElement('pre');
              dataPre.textContent = JSON.stringify(event.data, null, 2);
              card.appendChild(dataPre);
            }
            
            eventsContainer.appendChild(card);
          });
        }
        
        // Set up tab switching
        document.querySelectorAll('.tab').forEach(tab => {
          tab.addEventListener('click', () => {
            // Remove active class from all tabs
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            
            // Add active class to clicked tab
            tab.classList.add('active');
            
            // Update active tab
            activeTab = tab.getAttribute('data-tab');
            
            // Re-render events
            renderEvents();
          });
        });
        
        // Set up filter buttons
        document.querySelectorAll('.filter-btn').forEach(btn => {
          btn.addEventListener('click', () => {
            // Remove active class from all filter buttons
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            
            // Add active class to clicked button
            btn.classList.add('active');
            
            // Update active filter
            activeFilter = btn.getAttribute('data-filter');
            
            // Re-render events
            renderEvents();
          });
        });
        
        // Set up event listeners
        document.getElementById('refreshBtn').addEventListener('click', fetchEvents);
        
        document.getElementById('downloadBtn').addEventListener('click', async () => {
          try {
            const response = await fetch('/api/log');
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'pumpfun-events.log';
            document.body.appendChild(a);
            a.click();
            a.remove();
          } catch (error) {
            alert('Error downloading log: ' + error.message);
          }
        });
        
        // Initial fetch
        fetchEvents();
        
        // Refresh every 10 seconds
        setInterval(fetchEvents, 10000);
      </script>
    </body>
    </html>
    `;
    
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(html);
  }
  
  private serveRecentEvents(res: http.ServerResponse): void {
    const events = this.pumpfunListener.getRecentEvents();
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(events));
  }
  
  private serveLogFile(res: http.ServerResponse): void {
    const logFilePath = path.join(process.cwd(), 'pumpfun-events.log');
    
    try {
      if (fs.existsSync(logFilePath)) {
        const fileContent = fs.readFileSync(logFilePath, 'utf8');
        res.writeHead(200, { 
          'Content-Type': 'text/plain',
          'Content-Disposition': 'attachment; filename="pumpfun-events.log"'
        });
        res.end(fileContent);
      } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Log file not found' }));
      }
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Failed to read log file' }));
    }
  }
} 
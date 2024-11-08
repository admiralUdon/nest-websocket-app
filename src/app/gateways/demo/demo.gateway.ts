import { Injectable, OnModuleInit } from '@nestjs/common';
import { LogService } from 'app/core/providers/log/log.service';
import { DemoService } from 'app/core/services/demo/demo.service';
import { IncomingMessage } from 'http';
import * as url from 'url';
import { v4 } from 'uuid';
import { WebSocket, WebSocketServer } from 'ws';

@Injectable()
export class DemoGateway implements OnModuleInit {

    private clients: Map<string, WebSocket> = new Map();
    private server: WebSocketServer;
    private readonly PING_INTERVAL = 30000; // 30 seconds interval for pinging clients
    private readonly BROADCAST_INTERVAL = 1000 // 1 second interval for brodcast clients

    /**
     * Constructor
     */
    constructor(
        private _logService: LogService,
        private _demoService: DemoService
    ) {
        this._logService.registerClassName(DemoGateway.name);
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Lifecycle hooks
    // -----------------------------------------------------------------------------------------------------

    onModuleInit() {
        this.server = new WebSocketServer({ noServer: true });
        this.server.on('connection', async (webSocket: WebSocket, request: IncomingMessage) => {
            const { clientId, queryParams, pathname } = await this.handleConnection(webSocket, request);
            webSocket.on('message', async (message) => {
                await this.handleMessage(webSocket, message);
            });
            
            webSocket.on('close', async () => {
                await this.handleClose(clientId);
            });

            // Start the ping-pong mechanism to maintain the connection
            this.handleHeartbeat(clientId, webSocket);

            this.handleBroadcast();
        });
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Private methods
    // -----------------------------------------------------------------------------------------------------

    /**
     * Handle a new WebSocket connection.
     * @param client - The WebSocket client
     * @param request - The incoming HTTP request that initiated the WebSocket connection
     */
    private async handleConnection(websocket: WebSocket, request: IncomingMessage) 
    {
        const queryParams = url.parse(request.url || '', true).query; // Parse query parameters
        const pathname = url.parse(request.url || '', true).pathname; // Parse the requested path
        
        // If no valid path is provided, close the connection
        if (!pathname) {
            this._logService.warn('No path provided, rejecting client');
            websocket.close();
            return;
        }

        // Generate a unique client ID using UUID
        const clientId = v4();
        // Log the new connection
        this._logService.debug(`Client ${clientId} connected to ${pathname}`);

        this.clients.set(clientId, websocket);
        
        // Return connection details
        return { clientId, queryParams, pathname };
    }

    private async handleMessage(webSocket: WebSocket, message) 
    {
        this._logService.debug(`DemoGateway received: ${message}`);
        const msg = await this._demoService.getDemo();
        webSocket.send(`DemoGateway response: ${msg}`);
    }

    private async handleClose(clientId: string) 
    {
        // Remove the client from the tracking map
        this.clients.delete(clientId);
        this._logService.debug(`Client ${clientId} disconnected from DemoGateway`);
    }

    /**
     * Set up a ping-pong heartbeat to ensure WebSocket connections remain alive.
     * @param clientId - The ID of the client
     * @param webSocket - The WebSocket instance
     */
    private handleHeartbeat(clientId: string, webSocket: WebSocket) {
        // Set a timer to send pings to the client at regular intervals
        const pingInterval = setInterval(() => {
            if (webSocket.readyState === WebSocket.OPEN) {
                webSocket.ping(); // Send a ping if the connection is open
            }
        }, this.PING_INTERVAL);

        // Handle 'pong' events from the client (response to ping)
        webSocket.on('pong', () => {
            this._logService.debug(`Pong received from client ${clientId}`);
        });

        // Handle the 'close' event when the client disconnects
        webSocket.on('close', () => {
            clearInterval(pingInterval); // Stop the ping-pong mechanism
        });

        // Handle WebSocket errors
        webSocket.on('error', (webSocket: WebSocket, error) => {
            this._logService.error('Error from client', error);
            clearInterval(pingInterval); // Stop the ping-pong mechanism in case of errors
        });
    }

    private async handleBroadcast()
    {
        const message = await this._demoService.getDemo();
        this.clients.forEach((webSocket: WebSocket, clientId: string)=>{
            // Set a timer to send broadcasts to the client at regular intervals
            const broadcastInterval = setInterval(() => {
                if (webSocket.readyState === WebSocket.OPEN) {
                    webSocket.send(message); // Send a broadcast if the connection is open
                }
            }, this.BROADCAST_INTERVAL);

            // Handle the 'close' event when the client disconnects
            webSocket.on('close', () => {
                clearInterval(broadcastInterval); // Stop the broadcast mechanism
            });
        });
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Public methods
    // -----------------------------------------------------------------------------------------------------

    handleUpgrade(request, webSocket, head) 
    {
        this.server.handleUpgrade(request, webSocket, head, (ws) => {
            this.server.emit('connection', ws, request);
        });
    }
}
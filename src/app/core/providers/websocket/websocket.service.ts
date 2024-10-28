import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { HttpAdapterHost, ModuleRef } from '@nestjs/core';
import { WebSocketGateway, OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { appRoutes } from 'app.routes';
import { IncomingMessage } from 'http';
import * as url from 'url';
import { v4 } from 'uuid';
import { Server, ServerOptions, WebSocket } from 'ws';
import { WebSocketHandler } from './websocket.types';

@Injectable()
@WebSocketGateway()
export class WebSocketService implements OnModuleInit, OnGatewayConnection, OnGatewayDisconnect {

    private webSocketServer: Server; // Instance of the WebSocket server
    private readonly PING_INTERVAL = 30000; // 30 seconds interval for pinging clients

    // Track all WebSocket event emitters for different paths
    private paths: Map<string, { gateway: WebSocketHandler, clients?: Map<string, WebSocket>}> = new Map();

    private readonly SERVER_ADDRESS = process.env.SERVER_ADDRESS || "127.0.0.1";
    private readonly SERVER_PORT = process.env.SERVER_PORT || 3000;
    private readonly SERVER_CONTEXT = process.env.SERVER_CONTEXT || "";

    /**
     * Constructor
     */
    constructor(
        private readonly _httpAdapterHost: HttpAdapterHost,
        private readonly _moduleRef: ModuleRef,
    ) {}

    // -----------------------------------------------------------------------------------------------------
    // @ Lifecycle hooks
    // -----------------------------------------------------------------------------------------------------

    /**
     * Called when the module is initialized.
     * Starts the WebSocket server and registers WebSocket events based on app routes.
     */
    onModuleInit() {
        // Find the WebSocket routes from app routes
        const wsRoutes = appRoutes.find((route) => route.path === "ws");
        const SERVER_CONTEXT = process.env.SERVER_CONTEXT ?? "";
        // Get WebSocket event classes from app routes and register them
        const routes = wsRoutes 
            ? this.getRoutePaths(wsRoutes.children, SERVER_CONTEXT ? `${SERVER_CONTEXT}/ws` : 'ws') 
            : new Map();
        // Register WebSocket event handlers based on the discovered routes
        this.registerWebSocketPath(routes);
        // Initialize WebSocket server
        this.initializeConnection(this.paths); 
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Public Method
    // -----------------------------------------------------------------------------------------------------

    /**
     * Handle a new WebSocket connection.
     * @param client - The WebSocket client
     * @param request - The incoming HTTP request that initiated the WebSocket connection
     */
    async handleConnection(websocket: WebSocket, request: IncomingMessage) 
    {
        const queryParams = url.parse(request.url || '', true).query; // Parse query parameters
        const pathname = url.parse(request.url || '', true).pathname; // Parse the requested path
        
        // If no valid path is provided, close the connection
        if (!pathname) {
            Logger.warn('No path provided, rejecting client', "WebSocketService");
            websocket.close();
            return;
        }

        // Get the message handler for the requested path
        const gateway = this.paths.get(pathname).gateway
        const initiate = gateway.initialise.bind(gateway);

        if (initiate) {
            initiate(websocket);
        } else {
            Logger.error(`Gateway for ${pathname} does not met the minimal requirement for the WebSocket`);
        }

        // Generate a unique client ID using UUID
        const clientId = v4();
        // Log the new connection
        Logger.debug(`Client ${clientId} connected to ${pathname}`, "WebSocketService");

        const clients: Map<string, WebSocket> = this.paths.get(pathname).clients;
        if (clients) {
            clients.set(clientId, websocket);
            this.paths.set(pathname, {gateway, clients});
        } else {
            const clients: Map<string, WebSocket> = new Map();
            clients.set(clientId, websocket);
            // Store client information (path and WebSocket instance)
            this.paths.set(pathname, {gateway, clients});
        }
        
        // Return connection details
        return { clientId, queryParams, pathname };
    }

    /**
     * Handle client disconnection.
     * @param clientId - The unique ID of the client being disconnected
     */
    handleDisconnect({pathname, clientId}: { pathname: string, clientId: string}) 
    {     
        const clients = this.paths.get(pathname).clients;   
        // const client = clients.get(clientId); // Get the client data

        // Remove associated cron job if it exists
        // this._schedulerRegistry.deleteCronJob(`job-${client?.path}-${clientId}`);

        // Remove the client from the tracking map
        clients.delete(clientId);
        Logger.debug(`Client ${clientId} disconnected`, "WebSocketService");
        return clientId;
    }
    
    // -----------------------------------------------------------------------------------------------------
    // @ Private Method
    // -----------------------------------------------------------------------------------------------------

    /**
     * Initialize the WebSocket server and set up connection handlers.
     */
    private initializeConnection(paths: Map<string, { gateway: WebSocketHandler, clients?: Map<string, WebSocket>}>) {
        const httpServer = this._httpAdapterHost.httpAdapter.getHttpServer(); // Get the HTTP server instance
        const options: ServerOptions = { server: httpServer }; // Define WebSocket server options

        // Initialize WebSocket server using the HTTP server
        this.webSocketServer = new Server(options);

        // Set up the connection handler for new WebSocket connections
        this.webSocketServer.on('connection', async (webSocket: WebSocket, request: IncomingMessage) => {
            // Handle Connection
            const { clientId, queryParams, pathname } = await this.handleConnection(webSocket, request);
            // Start the ping-pong mechanism to maintain the connection
            this.setupHeartbeat(pathname, clientId, webSocket);
        });

        Logger.debug(`WebSocket Server is running on http://${this.SERVER_ADDRESS}:${this.SERVER_PORT}/${this.SERVER_CONTEXT}`, "WebSocketService");
    }

    /**
     * Set up a ping-pong heartbeat to ensure WebSocket connections remain alive.
     * @param clientId - The ID of the client
     * @param webSocket - The WebSocket instance
     */
    private setupHeartbeat(pathname: string, clientId: string, webSocket: WebSocket) {
        // Set a timer to send pings to the client at regular intervals
        const pingInterval = setInterval(() => {
            if (webSocket.readyState === WebSocket.OPEN) {
                webSocket.ping(); // Send a ping if the connection is open
            }
        }, this.PING_INTERVAL);

        // Handle 'pong' events from the client (response to ping)
        webSocket.on('pong', () => {
            Logger.debug(`Pong received from client ${clientId}`, "WebSocketService");
        });

        // Handle the 'close' event when the client disconnects
        webSocket.on('close', () => {
            this.handleDisconnect({pathname, clientId}); // Handle disconnection logic
            clearInterval(pingInterval); // Stop the ping-pong mechanism
        });

        // Handle WebSocket errors
        webSocket.on('error', () => {
            Logger.error('Error from client', "WebSocketService");
            clearInterval(pingInterval); // Stop the ping-pong mechanism in case of errors
        });
    }

    /**
     * Register WebSocket events for each defined route.
     * @param events - A map of WebSocket events to be registered
     */
    private registerWebSocketPath(events: Map<string, WebSocketHandler>) {
        events.forEach(async (gateway, path) => {            
            if (typeof gateway === 'function') {
                // Use ModuleRef to resolve the instance of WebSocketEvent
                const instance = await this._moduleRef.resolve(gateway);
                // Store the class instance in the event emitter map
                this.paths.set(path, { gateway: instance});
                Logger.debug(`Handler for path ${path} initiated`, 'WebSocketService');
            } else {
                Logger.error(`Handler for path ${path} is not a valid constructor`, 'WebSocketService');
            }
        });
    }

    /**
     * Retrieve route paths from the application's routing configuration.
     * @param routes - The routes to process
     * @param parentPath - The parent path to prepend
     * @returns A map of WebSocket paths and their associated events
     */
    private getRoutePaths(routes: any[], basePath: string): Map<string, WebSocketHandler> {
        return routes.flatMap(route => {
            const fullPath = `/${basePath}/${route.path}`.replace('//', '/');
            const currentEntry = route.module ? [[fullPath, route.module]] : [];            
            
            return route.children 
                ? [...currentEntry, ...this.getRoutePaths(route.children, fullPath)] 
                : currentEntry;
        }).reduce((map, [path, module]) => map.set(path, module), new Map());
    }
}
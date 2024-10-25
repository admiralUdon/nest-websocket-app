import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { WebSocketGateway, OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { appRoutes } from 'app.routes';
import { IncomingMessage } from 'http';
import * as url from 'url';
import { v4 } from 'uuid';
import { Server, ServerOptions, WebSocket } from 'ws';
import { WebSocketGatewayEvent, WebSocketGatewayEventEmitter } from './websocket.types';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';

@Injectable()
@WebSocketGateway()
export class WebSocketService implements OnModuleInit, OnGatewayConnection, OnGatewayDisconnect {

    private webSocketServer: Server; // Instance of the WebSocket server
    private readonly PING_INTERVAL = 30000; // 30 seconds interval for pinging clients

    // Track all connected clients using a Map with unique client IDs as keys
    private clients: Map<string, { path: string; ws: WebSocket, cronJobId?: string}> = new Map();

    // Track all WebSocket event emitters for different paths
    private eventEmitter: Map<string, WebSocketGatewayEventEmitter> = new Map();

    private readonly SERVER_ADDRESS = process.env.SERVER_ADDRESS || "127.0.0.1";
    private readonly SERVER_PORT = process.env.SERVER_PORT || 3000;
    private readonly SERVER_CONTEXT = process.env.SERVER_CONTEXT || "";

    /**
     * Constructor
     */
    constructor(
        private readonly _httpAdapterHost: HttpAdapterHost,
        private _schedulerRegistry: SchedulerRegistry
    ) {}

    // -----------------------------------------------------------------------------------------------------
    // @ Lifecycle hooks
    // -----------------------------------------------------------------------------------------------------

    /**
     * Called when the module is initialized.
     * Starts the WebSocket server and registers WebSocket events based on app routes.
     */
    onModuleInit() {
        this.initializeConnection(); // Initialize WebSocket server
        
        // Find the WebSocket routes from app routes
        const wsRoutes = appRoutes.find((route) => route.path === "ws");
        const SERVER_CONTEXT = process.env.SERVER_CONTEXT ?? "";

        // Get WebSocket event classes from app routes and register them
        const gateways: Map<string, WebSocketGatewayEvent> = wsRoutes 
            ? this.getRoutePaths(wsRoutes.children, SERVER_CONTEXT ? `${SERVER_CONTEXT}/ws` : 'ws') 
            : new Map();

        // Register WebSocket event handlers based on the discovered routes
        this.registerWebSocketEvent(gateways);
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Public Method
    // -----------------------------------------------------------------------------------------------------

    /**
     * Handle a new WebSocket connection.
     * @param client - The WebSocket client
     * @param request - The incoming HTTP request that initiated the WebSocket connection
     */
    async handleConnection(client: WebSocket, request: IncomingMessage) {
        const queryParams = url.parse(request.url || '', true).query; // Parse query parameters
        const pathname = url.parse(request.url || '', true).pathname; // Parse the requested path
        
        // If no valid path is provided, close the connection
        if (!pathname) {
            Logger.warn('No path provided, rejecting client', "WebSocketService");
            client.close();
            return;
        }

        // Get the message handler for the requested path
        const messageHandler = this.getHandler(pathname);
        if (messageHandler) {
            // If a valid handler exists, invoke it
            messageHandler(client);
        } else {
            // If no valid handler exists, close the connection
            Logger.warn(`Unknown path ${pathname}, closing connection`, "WebSocketService");
            client.close();
        }

        // Generate a unique client ID using UUID
        const clientId = v4();
        // Log the new connection
        Logger.debug(`Client ${clientId} connected to ${pathname}`, "WebSocketService");

        // Store client information (path and WebSocket instance)
        this.clients.set(clientId, { path: pathname, ws: client });
        
        // Handle message broadcasting for the connected client
        await this.handleBroadcast(pathname);
        
        // Return connection details
        return { clientId, queryParams, pathname };
    }

    /**
     * Handle client disconnection.
     * @param clientId - The unique ID of the client being disconnected
     */
    handleDisconnect(clientId: string) {        
        const client = this.clients.get(clientId); // Get the client data

        // Remove associated cron job if it exists
        this._schedulerRegistry.deleteCronJob(`job-${client?.path}-${clientId}`);

        // Remove the client from the tracking map
        this.clients.delete(clientId);
        Logger.debug(`Client ${clientId} disconnected`, "WebSocketService");
        return clientId;
    }

    /**
     * Broadcast messages to all connected clients based on the path.
     * @param broadcastPath - The WebSocket path for which to broadcast messages
     */
    async handleBroadcast(broadcastPath: string) {
        const event = this.eventEmitter.get(broadcastPath); // Retrieve the event for the given path
        if (!event) {
            Logger.error(`No event found for path ${broadcastPath}`, 'WebSocketService');
            return;
        }

        // Loop over all connected clients
        this.clients.forEach((value, key) => {
            // Check if the client is connected to the target path and does not have a cron job
            if (value.path === broadcastPath && !value.cronJobId) {
                const cronExpression = event.broadcast().cronExpression; // Get cron expression
                const cronFunction = event.broadcast().cronFunction(value.ws); // Get cron function

                // Create a new cron job for broadcasting messages to this client
                const cronJob = new CronJob(cronExpression, cronFunction);
                const cronJobId = `job-${broadcastPath}-${key}`; // Generate unique cron job ID
                
                // Add the cron job to the scheduler registry
                this._schedulerRegistry.addCronJob(cronJobId, cronJob);

                // Update the client's cron job ID in the tracking map
                this.clients.set(key, { ...value, cronJobId });

                // Start the cron job
                cronJob.start();
            }
        });

        // Optional delay to allow cron jobs to be fully initialized
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // -----------------------------------------------------------------------------------------------------
    // @ Private Method
    // -----------------------------------------------------------------------------------------------------

    /**
     * Initialize the WebSocket server and set up connection handlers.
     */
    private initializeConnection() {
        const httpServer = this._httpAdapterHost.httpAdapter.getHttpServer(); // Get the HTTP server instance
        const options: ServerOptions = { server: httpServer }; // Define WebSocket server options

        // Initialize WebSocket server using the HTTP server
        this.webSocketServer = new Server(options);

        // Set up the connection handler for new WebSocket connections
        this.webSocketServer.on('connection', async (webSocket: WebSocket, request: IncomingMessage) => {
            const { clientId, queryParams, pathname } = await this.handleConnection(webSocket, request);
            
            // Store the client ID and WebSocket instance
            this.clients.set(clientId, { path: pathname, ws: webSocket });
            
            // Start the ping-pong mechanism to maintain the connection
            this.setupHeartbeat(clientId, webSocket);
        });

        Logger.debug(`WebSocket Server is running on http://${this.SERVER_ADDRESS}:${this.SERVER_PORT}/${this.SERVER_CONTEXT}`, "WebSocketService");
    }

    /**
     * Set up a ping-pong heartbeat to ensure WebSocket connections remain alive.
     * @param clientId - The ID of the client
     * @param webSocket - The WebSocket instance
     */
    private setupHeartbeat(clientId: string, webSocket: WebSocket) {
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
            this.handleDisconnect(clientId); // Handle disconnection logic
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
    private registerWebSocketEvent(events: Map<string, WebSocketGatewayEvent>) {
        events.forEach((WebSocketEvent, path) => {
            if (typeof WebSocketEvent === 'function') {
                // Instantiate the handler class for the WebSocket event
                const instance = new WebSocketEvent();

                // Store the class instance in the event emitter map
                this.eventEmitter.set(path, instance);

                Logger.debug(`Handler for path ${path} initiated`, 'WebSocketService');
            } else {
                Logger.error(`Handler for path ${path} is not a valid constructor`, 'WebSocketService');
            }
        });
    }

    /**
     * Get the WebSocket handler function for a given path.
     * @param path - The requested WebSocket path
     * @returns The WebSocket handler function
     */
    private getHandler(path: string): ((webSocket: WebSocket) => void) | undefined {
        Logger.debug(`Get handler for path: ${path}`, "WebSocketService");
        const instance = this.eventEmitter.get(path);
        if (instance && typeof instance.handler === 'function') {
            return instance.handler.bind(instance);
        } else {
            Logger.error(`No handleMessage method found for handler on path: ${path}`, 'WebSocketService');
        }
        return undefined;
    }

    /**
     * Retrieve route paths from the application's routing configuration.
     * @param routes - The routes to process
     * @param parentPath - The parent path to prepend
     * @returns A map of WebSocket paths and their associated events
     */
    private getRoutePaths(routes: any[], basePath: string): Map<string, WebSocketGatewayEvent> {
        return routes.flatMap(route => {
            const fullPath = `/${basePath}/${route.path}`.replace('//', '/');
            const currentEntry = route.module ? [[fullPath, route.module]] : [];            
            
            return route.children 
                ? [...currentEntry, ...this.getRoutePaths(route.children, fullPath)] 
                : currentEntry;
        }).reduce((map, [path, module]) => map.set(path, module), new Map());
    }
}
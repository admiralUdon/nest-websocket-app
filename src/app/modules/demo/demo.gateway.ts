import { Injectable, OnModuleInit } from '@nestjs/common';
import { WebSocketGateway, OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Server, ServerOptions, WebSocket } from 'ws';
import { HttpAdapterHost } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { IncomingMessage } from 'http';
import * as url from 'url';

@Injectable()
@WebSocketGateway()
export class DemoGateway implements OnModuleInit, OnGatewayConnection, OnGatewayDisconnect {
    private webSocketServer: Server;

    constructor(private readonly _httpAdapterHost: HttpAdapterHost) {}

    onModuleInit() {
        const SERVER_ADDRESS = process.env.SERVER_ADDRESS || "127.0.0.1";
        const SERVER_PORT = process.env.SERVER_PORT || 3000;
        const SERVER_CONTEXT = process.env.SERVER_CONTEXT || "";
        const httpServer = this._httpAdapterHost.httpAdapter.getHttpServer();

        const options: ServerOptions = { server: httpServer, path: `/${SERVER_CONTEXT}` };
        // Attach WebSocket server to the existing NestJS HTTP server
        this.webSocketServer = new Server(options);

        this.webSocketServer.on('connection', (webSocket: WebSocket, request: IncomingMessage) => {

            const queryParams = url.parse(request.url || '', true).query;
            Logger.debug(`Client connected `, "BasicGateway");
            
            webSocket.on('message', (message) => {
                console.log('Received:', message);
                webSocket.send(`Echo: ${message}`); // Echo back the received message
            });

            webSocket.on('close', () => {
                Logger.debug(`Client disconnected`, "BasicGateway");
            });
        });

        Logger.log(`NestJS app is running on http://${SERVER_ADDRESS}:${SERVER_PORT}/${SERVER_CONTEXT}`, "BasicGateway");
    }

    handleConnection() {
        // Logic when a new client connects
    }

    handleDisconnect() {
        // Logic when a client disconnects
    }
}
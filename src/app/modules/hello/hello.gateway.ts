import { Logger } from '@nestjs/common';
import { CronExpression } from '@nestjs/schedule';
import { WebSocket } from 'ws';

export class HelloGateway  {

    protected _webSocket: WebSocket;

    /**
     * Constructor
     */
    constructor()
    {}

    // -----------------------------------------------------------------------------------------------------
    // @ Private methods
    // -----------------------------------------------------------------------------------------------------

    private sendMessage(message: string)
    {
        if (this._webSocket) {
            this._webSocket.send(message);
            Logger.debug(`Send message: ${message}`, "DemoGateway");
        }
    }

    private receiveMessage(message)
    {
        Logger.debug(`Received message: ${message}`, "HelloGateway");
        this.sendMessage(`${message}`);
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Protected methods
    // -----------------------------------------------------------------------------------------------------

    protected initialise(webSocket: WebSocket)
    {
        this._webSocket = webSocket;
        this.handler(webSocket);
    }

    protected handler(webSocket: WebSocket): void
    {
        Logger.debug(`Client connected to ${process.env.SERVER_CONTEXT}/general-status`, "HelloGateway");

        // Handle client messages
        webSocket.on('message', (message) => {
            this.receiveMessage(message);
        });
    
        // Handle connection close
        webSocket.on('close', () => {
            Logger.debug(`Client disconnected from ${process.env.SERVER_CONTEXT}/general-status`, "HelloGateway");
        });
    
        // Handle WebSocket errors
        webSocket.on('error', (error: Error) => {
            Logger.error(`WebSocket error: ${error.message}`, "HelloGateway");
        });
    }

}
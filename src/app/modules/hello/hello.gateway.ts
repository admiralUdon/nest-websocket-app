import { Logger } from '@nestjs/common';
import { CronExpression } from '@nestjs/schedule';
import { WebSocket } from 'ws';

export class HelloGateway  {

    /**
     * Constructor
     */
    constructor()
    {}

    // -----------------------------------------------------------------------------------------------------
    // @ Private methods
    // -----------------------------------------------------------------------------------------------------

    private sendMessage(webSocket: WebSocket)
    {        
        const message = "Hello";
        webSocket.send(message);
        Logger.debug(`Send message: ${message}`, "HelloGateway");

    }

    private receiveMessage(message)
    {
        Logger.debug(`Received message: ${message}`, "HelloGateway");
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Protected methods
    // -----------------------------------------------------------------------------------------------------

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

    protected broadcast() : { cronExpression: CronExpression, cronFunction: (webSocket: WebSocket) => void  }
    {
        const cronExpression: CronExpression = CronExpression.EVERY_SECOND;
        return {
            cronExpression,
            cronFunction: (webSocket: WebSocket): (() => void) => {
                return () => {
                    // Example to broadcast message
                    this.sendMessage(webSocket)
                }
            }
        }
    }
}
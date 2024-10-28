import { Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DemoService } from 'app/core/services/demo/demo.service';
import { WebSocket } from 'ws';

export class DemoGateway  {

    protected _webSocket: WebSocket;

    /**
     * Constructor
     */
    constructor(
        private _demoService: DemoService // this does not works, yet.
    )
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
        const timestamp = this.getTimestamp();
        Logger.debug(`Received message: ${message}`, "DemoGateway");

        const response = `${timestamp} :- ${message}`;
        this._demoService.demo = {
            timestamp,
            message: response,
            client: null
        }
        this.sendMessage(JSON.stringify(response));
    }

    private getTimestamp() 
    {
        const datetimeString = new Date().toLocaleString('en-GB', { 
            day: '2-digit', 
            month: '2-digit', 
            year: 'numeric', 
            hour: '2-digit', 
            minute: '2-digit', 
            second: '2-digit', 
            hour12: false 
        }).replace(',', '');

        return datetimeString;
    }

    @Cron(CronExpression.EVERY_5_MINUTES)
    private blastMessage()
    {
        if (this._webSocket) {
            const datetimeString = new Date().toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).replace(',', '');
            this._webSocket.send(datetimeString);
        }
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
        Logger.debug(`Client connected to ${process.env.SERVER_CONTEXT}/general-status`, "DemoGateway");

        // Handle client messages
        webSocket.on('message', (message) => {
            this.receiveMessage(message);
        });
    
        // Handle connection close
        webSocket.on('close', () => {
            Logger.debug(`Client disconnected from ${process.env.SERVER_CONTEXT}/general-status`, "DemoGateway");
        });
    
        // Handle WebSocket errors
        webSocket.on('error', (error: Error) => {
            Logger.error(`WebSocket error: ${error.message}`, "DemoGateway");
        });
    }
}
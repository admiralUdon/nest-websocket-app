import { Injectable, OnModuleInit } from '@nestjs/common';
import { LogService } from 'app/core/providers/log/log.service';
import { WebSocketServer } from 'ws';

@Injectable()
export class HelloGateway implements OnModuleInit {

    private server: WebSocketServer;

    /**
     * Constructor
     */
    constructor(
        private _logService: LogService,
    ) {
        this._logService.registerClassName(HelloGateway.name);
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Lifecycle hooks
    // -----------------------------------------------------------------------------------------------------

    onModuleInit() {
        this.server = new WebSocketServer({ noServer: true });

        this.server.on('connection', (socket) => {
            console.log('Client connected to HelloGateway');

            socket.on('message', (message) => {
                console.log(`HelloGateway received: ${message}`);
                socket.send(`HelloGateway response: ${message}`);
            });

            socket.on('close', () => {
                console.log('Client disconnected from HelloGateway');
            });
        });
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Public methods
    // -----------------------------------------------------------------------------------------------------

    handleUpgrade(request, socket, head) {
        this.server.handleUpgrade(request, socket, head, (ws) => {
            this.server.emit('connection', ws, request);
        });
    }
}
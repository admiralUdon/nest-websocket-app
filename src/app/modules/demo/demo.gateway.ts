import { OnGatewayConnection, OnGatewayDisconnect, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import * as dotenv from 'dotenv';
import { Server } from 'socket.io';

// Load .env file
dotenv.config();

@WebSocketGateway({ namespace: process.env.SERVER_CONTEXT, cors: true })
export class DemoGateway implements OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer() server: Server;

    handleConnection(client: any) {
        console.log(`Client connected: ${client.id}`);
    }

    handleDisconnect(client: any) {
        console.log(`Client disconnected: ${client.id}`);
    }

    @SubscribeMessage('message')
    handleMessage(client: any, payload: any) {
        console.log(`message: ${payload}`)
        this.server.emit('message', payload);
    }
}

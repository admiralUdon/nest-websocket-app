import { CronExpression } from '@nestjs/schedule';
import { WebSocket } from 'ws';


export interface WebSocketGatewayEventEmitter {
    handler(webSocket: WebSocket): void;
    broadcast(): { cronExpression: CronExpression, cronFunction: (webSocket: WebSocket) => () => void  } ;
}

export type WebSocketGatewayEvent = new () => WebSocketGatewayEventEmitter;
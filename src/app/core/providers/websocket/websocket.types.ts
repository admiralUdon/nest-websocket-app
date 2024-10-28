import { WebSocket } from 'ws';

export interface WebSocketHandler {
    initialise(webSocket: WebSocket): void;
    handler(): void;
}

export type WebSocketHandlerConstructor = new () => WebSocketHandler;
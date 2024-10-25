import { Module } from '@nestjs/common';
import { WebSocketService } from 'app/core/providers/websocket/websocket.service';

@Module({
    providers: [WebSocketService],
    exports: [WebSocketService]
})
export class WebSocketServiceModule { }
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, RouterModule } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { appRoutes } from 'app.routes';
import { throttlerConfig } from 'app/config/throttler.config';
import { CoreService } from 'app/core/core.service';
import { WebSocketModule } from 'app/core/providers/websocket/websocket.module';
import { DemoGatewayModule } from 'app/gateways/demo/demo.module';
import { HelloGatewayModule } from 'app/gateways/hello/hello.module';
import { HelloModule } from 'app/modules/hello/hello.module';

@Module({
    imports: [
        // Config modules
        ScheduleModule.forRoot(),
        ConfigModule.forRoot({expandVariables: true}),
        ThrottlerModule.forRoot(throttlerConfig),
        WebSocketModule.forRoot(),
        // Custom modules
        HelloModule,
        DemoGatewayModule, // See demo module for websocket demo
        HelloGatewayModule,
        // Router modules
        RouterModule.register(appRoutes)
    ],
    providers: [
        {
            provide: APP_GUARD,
            useClass: ThrottlerGuard
        },
        CoreService
    ]
})
export class AppModule {}
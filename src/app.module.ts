import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, RouterModule } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { appRoutes } from 'app.routes';
import { throttlerConfig } from 'app/config/throttler.config';
import { CoreService } from 'app/core/core.service';
import { HelloModule } from 'app/modules/hello/hello.module';
import { DemoModule } from 'app/modules/demo/demo.module';

@Module({
    imports: [
        // Config modules
        ConfigModule.forRoot({expandVariables: true}),
        ThrottlerModule.forRoot(throttlerConfig),
        // Custom modules
        HelloModule,
        DemoModule, // See demo module for websocket demo
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
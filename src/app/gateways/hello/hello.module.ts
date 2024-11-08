import { Module } from '@nestjs/common';
import { LogServiceModule } from 'app/core/providers/log/log.module';
import { HelloGateway } from 'app/gateways/hello/hello.gateway';

@Module({
    imports: [LogServiceModule],
    providers: [HelloGateway],
    exports: [HelloGateway],
})
export class HelloGatewayModule {}
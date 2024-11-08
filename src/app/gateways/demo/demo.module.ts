import { Module } from '@nestjs/common';
import { LogServiceModule } from 'app/core/providers/log/log.module';
import { DemoServiceModule } from 'app/core/services/demo/demo.module';
import { DemoService } from 'app/core/services/demo/demo.service';
import { DemoGateway } from 'app/gateways/demo/demo.gateway';

@Module({
    imports: [DemoServiceModule, LogServiceModule],
    providers: [DemoService, DemoGateway],
    exports: [DemoGateway],
})
export class DemoGatewayModule {}
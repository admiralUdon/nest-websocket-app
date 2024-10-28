import { Module } from '@nestjs/common';
import { DemoServiceModule } from 'app/core/services/demo/demo.module';
import { DemoGateway } from 'app/modules/demo/demo.gateway';

@Module({
    imports: [DemoServiceModule],
    providers: [DemoGateway],
    exports: [DemoGateway]
})
export class DemoModule {}
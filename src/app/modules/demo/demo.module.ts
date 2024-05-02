import { Module } from '@nestjs/common';
import { DemoGateway } from 'app/modules/demo/demo.gateway';

@Module({
    providers: [DemoGateway],
    exports: [DemoGateway]
})
export class DemoModule {}
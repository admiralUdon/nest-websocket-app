import { Module } from '@nestjs/common';
import { DemoService } from 'app/core/services/demo/demo.service';

@Module({
    providers: [DemoService],
    exports: [DemoService]
})
export class DemoServiceModule {}
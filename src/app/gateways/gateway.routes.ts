import { DemoGateway } from "app/gateways/demo/demo.gateway";
import { DemoGatewayModule } from "app/gateways/demo/demo.module";
import { HelloGateway } from "app/gateways/hello/hello.gateway";
import { HelloGatewayModule } from "app/gateways/hello/hello.module";

export const gatewayRoutes = [
    {
        path: 'ws',
        children: [
            { path: 'demo', module: DemoGatewayModule, gatewayClass: DemoGateway },
            { path: 'hello', module: HelloGatewayModule, gatewayClass: HelloGateway },
        ],
    },
];
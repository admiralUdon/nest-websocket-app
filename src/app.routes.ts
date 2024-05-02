import { Routes } from "@nestjs/core";
import { HelloModule } from "app/modules/hello/hello.module";

/**
 * Note: Websocket uses gateway and because of this the websocket module (DemoModule)
 * will not be included over here. Look at app/modules/demo/demo.gateway.ts for example.
 * Also web socker endpoint will not be visible via /swagger ☹️.
 */

export const appRoutes: Routes = [
    {
        path: 'api',
        children: [
            { path: 'hello', module: HelloModule },
        ]
    }
]
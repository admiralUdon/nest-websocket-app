import { DynamicModule, Module } from '@nestjs/common';
import { WebSocketService } from 'app/core/providers/websocket/websocket.service';
import { WebSocketHandlerConstructor } from './websocket.types';
import { appRoutes } from 'app.routes';

@Module({})
export class WebSocketServiceModule {

    static forRoot(): DynamicModule {
        
        // Find the WebSocket routes from app routes
        const wsRoutes = appRoutes.find((route) => route.path === "ws");
        const SERVER_CONTEXT = process.env.SERVER_CONTEXT ?? "";

        // Get WebSocket event classes from app routes and register them
        const gateways: Map<string, WebSocketHandlerConstructor> = wsRoutes 
            ? this.getRoutePaths(wsRoutes.children, SERVER_CONTEXT ? `${SERVER_CONTEXT}/ws` : 'ws') 
            : new Map();

        const gatewaysArray = Array.from(gateways.values());

        const WebSocketServiceModuleResponse = {
            module: WebSocketServiceModule,
            imports: [],
            providers: [
                WebSocketService,
                ...gatewaysArray
            ],
            exports: [
                WebSocketService,
                ...gatewaysArray
            ],
        };        

        return WebSocketServiceModuleResponse
    }


    // {
    //     providers: [WebSocketService, DemoGateway, HelloGateway],
    //     exports: [WebSocketService]
    // }

    /**
     * Retrieve route paths from the application's routing configuration.
     * @param routes - The routes to process
     * @param parentPath - The parent path to prepend
     * @returns A map of WebSocket paths and their associated events
     */
    private static getRoutePaths(routes: any[], basePath: string): Map<string, WebSocketHandlerConstructor> {
        return routes.flatMap(route => {
            const fullPath = `/${basePath}/${route.path}`.replace('//', '/');
            const currentEntry = route.module ? [[fullPath, route.module]] : [];            
            
            return route.children 
                ? [...currentEntry, ...this.getRoutePaths(route.children, fullPath)] 
                : currentEntry;
        }).reduce((map, [path, module]) => map.set(path, module), new Map());
    }
}
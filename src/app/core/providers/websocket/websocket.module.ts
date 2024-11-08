import { DynamicModule, Logger, Module, OnModuleInit } from '@nestjs/common';
import { HttpAdapterHost, ModuleRef } from '@nestjs/core';
import { gatewayRoutes } from 'app/gateways/gateway.routes';

@Module({})
export class WebSocketModule implements OnModuleInit {

    private routes: Map<string, { gatewayClass: any; module: any }> = new Map();
    private readonly logger = new Logger(WebSocketModule.name);

    /**
     * Constructor
     */
    constructor(
        private readonly moduleRef: ModuleRef,
        private _httpAdapterHost: HttpAdapterHost
    ) {}

    // -----------------------------------------------------------------------------------------------------
    // @ Lifecycle hooks
    // -----------------------------------------------------------------------------------------------------

    async onModuleInit() {
        
        // Set up the HTTP server for handling WebSocket upgrades
        const server = this._httpAdapterHost.httpAdapter.getHttpServer();

        // Find the WebSocket routes from app routes
        const wsRoutes = gatewayRoutes.find((route) => route.path === "ws");
        const SERVER_CONTEXT = process.env.SERVER_CONTEXT ?? "";
        this.routes = this.getGatewayRoutes(wsRoutes.children, `${SERVER_CONTEXT}/ws`)        

        server.on('upgrade', async (request, socket, head) => {
            try {                
                const route = this.routes.get(request.url)              
                if (route) {
                    const module = await this.moduleRef.resolve(route.gatewayClass);                    
                    if (module && typeof module.handleUpgrade === 'function') {
                        module.handleUpgrade(request, socket, head);
                    } else {
                        this.logger.error(`handleUpgrade method not found for gateway in module ${route.module.name}`);
                        socket.destroy();
                    }
                } else {
                    throw new Error("Route not found")
                }
            } catch (error) {
                Logger.error(`Error catch: ${error}`)
                socket.destroy(); 
            }
            
        });
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Private methods
    // -----------------------------------------------------------------------------------------------------

    /**
     * Retrieve route paths from the application's routing configuration.
     * @param routes - The routes to process
     * @param parentPath - The parent path to prepend
     * @returns A map of WebSocket paths and their associated events
     */
    private getGatewayRoutes(routes: any, basePath: string): Map<string, { gatewayClass: any; module: any }> {
        return routes.flatMap(route => {
            const { module, gatewayClass } = route;
            const fullPath = `/${basePath}/${route.path}`.replace('//', '/');
            const currentEntry = (module && gatewayClass) ? [[fullPath, { module, gatewayClass }]] : [];            
            
            return route.children 
                ? [...currentEntry, ...this.getGatewayRoutes(route.children, fullPath)] 
                : currentEntry;
        }).reduce((map, [path, module]: [string, { gatewayClass: any; module: any }]) => map.set(path, module), new Map());
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Public methods
    // -----------------------------------------------------------------------------------------------------

    static forRoot(): DynamicModule {        
        // Extract all unique modules from appRoutes
        const gatewayModules = gatewayRoutes.flatMap(route => route.children).map(child => child.module);        
        const [gatewayDependenciesModules] = gatewayModules.map((module) => {
            const gatewayDependencyModule = Reflect.getMetadata('imports', module);            
            if (gatewayDependencyModule)
                return gatewayDependencyModule;
        }).filter(n=>n);        
        
        const gatewayClass = gatewayRoutes.flatMap(route => route.children).map(child => child.gatewayClass);
        return {
            module: WebSocketModule,
            imports: [
                ...gatewayDependenciesModules,
                ...gatewayModules
            ],
            providers: gatewayClass
        };
    }
}
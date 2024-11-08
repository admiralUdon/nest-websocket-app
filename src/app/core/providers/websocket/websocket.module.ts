import { DynamicModule, Logger, Module, OnModuleInit } from '@nestjs/common';
import { HttpAdapterHost, ModuleRef } from '@nestjs/core';
import { gatewayRoutes } from 'app/gateways/gateway.routes';

@Module({})
export class WebSocketModule implements OnModuleInit {

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
        // const server: Server = this.moduleRef.get(Server, { strict: false });
        const server = this._httpAdapterHost.httpAdapter.getHttpServer()

        server.on('upgrade', async (request, socket, head) => {
            try {
                const route = this.findRoute(request.url);                
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

    private findRoute(url: string) {
        // Parse the URL to find the matching route
        const [basePath, childPath] = url.replace(/^\/|\/$/g, '').split('/');

        const baseRoute = gatewayRoutes.find(route => route.path === basePath);
        if (!baseRoute || !baseRoute.children) return null;

        return baseRoute.children.find(route => route.path === childPath);
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
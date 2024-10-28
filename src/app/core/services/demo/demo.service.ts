import { Injectable, Logger } from "@nestjs/common"
import { BehaviorSubject, Observable } from "rxjs";
import { Demo } from "app/core/services/demo/demo.types";


@Injectable()
export class DemoService {

    private readonly logger = new Logger(DemoService.name);
    private _demo: BehaviorSubject<Demo> = new BehaviorSubject<Demo>(null);

    /**
     * Constructor
     */
    constructor(
    ) {}

    // -----------------------------------------------------------------------------------------------------
    // @ Accessors
    // -----------------------------------------------------------------------------------------------------
    
    /**
     * Setter & getter for demo
     *
     * @param value
     */
    set demo(value: Demo) {
        // Store the value
        this._demo.next(value);
    }

    get demo$(): Observable<Demo> {
        return this._demo.asObservable();
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Public methods
    // -----------------------------------------------------------------------------------------------------
    
}
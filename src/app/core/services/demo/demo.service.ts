import { Injectable } from "@nestjs/common"

@Injectable()
export class DemoService {

    /**
     * Constructor
     */
    constructor(
    ) {}

    // -----------------------------------------------------------------------------------------------------
    // @ Public methods
    // -----------------------------------------------------------------------------------------------------
 
    getDemo()
    {
        return "Hi mom";
    }
}
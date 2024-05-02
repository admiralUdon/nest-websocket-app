import { Controller, Get, HttpStatus, Query, Request, Response } from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import { LogService } from 'app/core/providers/log/log.service';
import { AppCode } from 'app/core/types/app.type';
import { DefaultHttpException } from 'app/shared/custom/http-exception/default.http-exception';
import { DefaultHttpResponse } from 'app/shared/custom/http-response/default.http-response';

@Controller()
export class HelloController {

    /**
     * Constructor
     */

    constructor(
        private _logService: LogService
    ){
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Public methods
    // -----------------------------------------------------------------------------------------------------

    @Get()
    @ApiOperation({ summary: "Display Hello", description: "A simple greeting API that returns a friendly \"Hello, World!\" message when accessed. It serves as a basic example or placeholder for API testing and demonstration purposes" })
    getHello(
        @Request() request,
        @Response() response,
        @Query("note") note: string
    ) {

        const host = request.headers?.host;

        if (!host) {
            const failedCode = AppCode.GENERAL_ERROR;
            throw new DefaultHttpException({
                message: failedCode.description,
                code: failedCode.code,
                statusCode: failedCode.status,
                error: {
                    reason: "no host"
                }
            });
        }

        const data = {
            message: "Hello, World!",
            host,
            note
        };

        this._logService.debug("Logging the data", data);

        const successCode = AppCode.OK;
        const result = new DefaultHttpResponse({
            code: successCode.code,
            message: successCode.description,
            statusCode: successCode.status,
            data
        });
        
        response.status(result.statusCode);
        response.json(result);
        return response;
    }

}
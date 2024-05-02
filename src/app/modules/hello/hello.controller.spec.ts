import { Test, TestingModule } from '@nestjs/testing';
import { AppCode } from 'app/core/types/app.type';
import { HelloController } from 'app/modules/hello/hello.controller';
import { DefaultHttpException, DefaultHttpExceptionType } from 'app/shared/custom/http-exception/default.http-exception';
import { DefaultHttpResponse } from 'app/shared/custom/http-response/default.http-response';

describe('HelloController', () => {
    let controller: HelloController;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [HelloController],
        }).compile();

        controller = module.get<HelloController>(HelloController);
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    it('should return a greeting message', () => {

        const successCode = AppCode.OK;
        const expectedResult = {
            code: successCode.code,
            message: successCode.description,
            statusCode: successCode.status,
            data: {
                message: "Hello, World!",
                host: "localhost:3000",
                note: "some query param note"
            }
        };

        const mockRequest = { headers: { host: "localhost:3000"} };
        const mockResponse = { statusCode: 200, json: jest.fn(), status: jest.fn() };
        const mockQueryParam = "some query param note";
    
        const result = controller.getHello(mockRequest, mockResponse, mockQueryParam);
    
        expect(result).toBe(mockResponse);
        expect(mockResponse.json).toHaveBeenCalledWith(new DefaultHttpResponse(expectedResult));
    });

    it('should throw an exception if cookies undefined/null', () => {
        const failedCode = AppCode.GENERAL_ERROR;
        const expectedResult = {
            code: failedCode.code,
            message: failedCode.description,
            statusCode: failedCode.status,
            error: {
                reason: "no host"
            },
            timestamp: expect.any(String)
        };

        const mockRequest = { headers: { host: null} }; // will be producing no host
        const mockResponse = { statusCode: 200, json: jest.fn(), status: jest.fn() };
        const mockQueryParam = "some query param note";

        expect(() => {
            controller.getHello(mockRequest, mockResponse, mockQueryParam);
        }).toThrow(DefaultHttpException);

        // Handle the thrown exception and check its properties
        try {
            controller.getHello(mockRequest, mockResponse, mockQueryParam);
        } catch (error) {
            const stack = error.getResponse() as DefaultHttpExceptionType;
            expect(stack).toEqual(expectedResult);
        }
    });
});
import { vi } from "vitest";
import { HttpService } from "@nestjs/axios";
import { of, throwError } from "rxjs";
import type { AxiosResponse, AxiosError } from "axios";

let mockHttpService: ReturnType<typeof createMockHttpService>;

export function createMockHttpService() {
  return {
    request: vi.fn().mockReturnValue(of({ data: {}, status: 200 } as AxiosResponse)),
    get: vi.fn().mockReturnValue(of({ data: {}, status: 200 } as AxiosResponse)),
    post: vi.fn().mockReturnValue(of({ data: {}, status: 200 } as AxiosResponse)),
    put: vi.fn().mockReturnValue(of({ data: {}, status: 200 } as AxiosResponse)),
    patch: vi.fn().mockReturnValue(of({ data: {}, status: 200 } as AxiosResponse)),
    delete: vi.fn().mockReturnValue(of({ data: {}, status: 200 } as AxiosResponse)),
    head: vi.fn().mockReturnValue(of({ data: {}, status: 200 } as AxiosResponse)),
    axiosRef: vi.fn(),
  };
}

export function getMockHttpService() {
  if (!mockHttpService) {
    mockHttpService = createMockHttpService();
  }
  return mockHttpService;
}

export function resetMockHttpService() {
  mockHttpService = createMockHttpService();
}

export function mockSuccess(response: AxiosResponse) {
  const service = getMockHttpService();
  service.request.mockReturnValue(of(response));
}

export function mockError(error: AxiosError) {
  const service = getMockHttpService();
  service.request.mockReturnValue(throwError(() => error));
}

vi.mock("@nestjs/axios", () => {
  const mockService = createMockHttpService();
  return {
    HttpService: vi.fn(() => mockService),
    HttpModule: {
      register: vi.fn().mockReturnValue({
        module: {},
        providers: [
          {
            provide: HttpService,
            useValue: mockService,
          },
        ],
        exports: [HttpService],
      }),
    },
  };
});

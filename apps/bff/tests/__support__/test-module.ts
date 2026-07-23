import { Test, type TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import { HttpService } from "@nestjs/axios";
import { AppModule } from "../../src/app.module";
import { createHttpServiceMock } from "./mocks/http-service.mock";

export async function createTestModule(): Promise<{
  app: INestApplication;
  httpService: ReturnType<typeof createHttpServiceMock>;
}> {
  const httpService = createHttpServiceMock();

  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(HttpService)
    .useValue(httpService)
    .compile();

  const app = moduleFixture.createNestApplication();
  await app.init();

  return { app, httpService };
}

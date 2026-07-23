import { Test, type TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { AppModule } from "../../src/app.module";

export async function createTestApp(): Promise<INestApplication> {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication();
  await app.init();
  return app;
}

export type TestClient = ReturnType<typeof request>;

export async function createTestClient(): Promise<{
  app: INestApplication;
  client: TestClient;
}> {
  const app = await createTestApp();
  return {
    app,
    client: request(app.getHttpServer()),
  };
}

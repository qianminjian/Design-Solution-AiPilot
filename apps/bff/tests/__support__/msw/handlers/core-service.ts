import { http, HttpResponse } from "msw";

export const coreServiceHandlers = [
  http.post("/api/v1/auth/login", ({ request }) => {
    return HttpResponse.json(
      {
        accessToken: "test-access-token",
        refreshToken: "test-refresh-token",
        user: { id: "u1", username: "testuser", role: "ARCHITECT" },
      },
      { status: 200 },
    );
  }),

  http.post("/api/v1/auth/register", ({ request }) => {
    return HttpResponse.json(
      {
        id: "u2",
        username: "newuser",
        email: "new@test.com",
      },
      { status: 201 },
    );
  }),

  http.post("/api/v1/auth/refresh", ({ request }) => {
    return HttpResponse.json(
      {
        accessToken: "new-access-token",
        refreshToken: "new-refresh-token",
      },
      { status: 200 },
    );
  }),

  http.post("/api/v1/auth/logout", ({ request }) => {
    return HttpResponse.json({ success: true }, { status: 200 });
  }),

  http.get("/api/v1/auth/me", ({ request }) => {
    const authHeader = request.headers.get("authorization");
    if (!authHeader) {
      return HttpResponse.json(
        { errorCode: "UNAUTHORIZED", message: "缺少认证信息" },
        { status: 401 },
      );
    }
    return HttpResponse.json({ id: "u1", username: "testuser" }, { status: 200 });
  }),

  http.get("/api/v1/projects", ({ request }) => {
    return HttpResponse.json(
      { items: [{ id: "p1", name: "项目A" }, { id: "p2", name: "项目B" }] },
      { status: 200 },
    );
  }),

  http.get("/api/v1/projects/:id", ({ params }) => {
    if (params.id === "not-found") {
      return HttpResponse.json(
        { errorCode: "NOT_FOUND", message: "项目不存在" },
        { status: 404 },
      );
    }
    return HttpResponse.json(
      { id: params.id, name: "测试项目", status: "ACTIVE" },
      { status: 200 },
    );
  }),

  http.post("/api/v1/projects", ({ request }) => {
    return HttpResponse.json(
      { id: "p3", name: "新项目", status: "DRAFT" },
      { status: 201 },
    );
  }),

  http.get("/api/v1/principals", ({ request }) => {
    return HttpResponse.json(
      { items: [{ id: "pr1", name: "主创建筑师" }] },
      { status: 200 },
    );
  }),

  http.get("/api/v1/internal-error", () => {
    return HttpResponse.json(
      { errorCode: "INTERNAL_ERROR", message: "服务器内部错误" },
      { status: 500 },
    );
  }),

  http.get("/api/v1/timeout", () => {
    return new Promise((resolve) => setTimeout(resolve, 60000));
  }),
];

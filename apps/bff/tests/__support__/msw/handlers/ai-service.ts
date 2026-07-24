import { http, HttpResponse } from "msw";

export const aiServiceHandlers = [
  http.post("/api/v1/capabilities/text-generation", () => {
    return HttpResponse.json(
      {
        id: "gen-1",
        content: "AI生成的设计文本内容",
        tokenUsage: { prompt: 100, completion: 200 },
      },
      { status: 200 },
    );
  }),

  http.post("/api/v1/capabilities/vision", () => {
    return HttpResponse.json(
      {
        id: "vision-1",
        detectedObjects: ["窗户", "门", "墙"],
        confidence: 0.95,
      },
      { status: 200 },
    );
  }),

  http.post("/api/v1/capabilities/embeddings", () => {
    return HttpResponse.json(
      {
        id: "embed-1",
        embedding: [0.1, 0.2, 0.3],
        dimensions: 3,
      },
      { status: 200 },
    );
  }),

  http.get("/api/v1/prompts", () => {
    return HttpResponse.json(
      {
        items: [
          { id: "prompt-1", name: "建筑设计模板", category: "design" },
          { id: "prompt-2", name: "结构分析模板", category: "structure" },
        ],
      },
      { status: 200 },
    );
  }),

  http.get("/api/v1/prompts/:id", ({ params }) => {
    if (params.id === "not-found") {
      return HttpResponse.json(
        { errorCode: "PROMPT_NOT_FOUND", message: "提示词不存在" },
        { status: 404 },
      );
    }
    return HttpResponse.json(
      {
        id: params.id,
        name: "详细设计模板",
        category: "design",
        content: "这是一个详细的设计提示词模板",
      },
      { status: 200 },
    );
  }),

  http.post("/api/v1/capabilities/rate-limit", () => {
    return HttpResponse.json(
      { errorCode: "RATE_LIMITED", message: "请求过于频繁" },
      { status: 429 },
    );
  }),

  http.post("/api/v1/capabilities/service-unavailable", () => {
    return HttpResponse.json(
      { errorCode: "SERVICE_UNAVAILABLE", message: "AI服务暂时不可用" },
      { status: 503 },
    );
  }),
];

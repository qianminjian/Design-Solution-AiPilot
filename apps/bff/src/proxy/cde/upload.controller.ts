import {
  Controller,
  Inject,
  Post,
  Req,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { CdeApiPaths, documentDtoSchema } from "@design-platform/shared";
import type { ZodType } from "zod";
import { Request } from "express";
import {
  ProxyResult,
  ProxyInterceptor,
} from "../../interceptors/proxy.interceptor";
import { ProxyService } from "../proxy.service";
import { SchemaValidator } from "../schema-validator.service";
import { StorageService } from "../../storage/storage.service";

/**
 * CDE 文件上传控制器
 *
 * V0 实现：BFF 接收文件 → 本地磁盘存储 → 调用 Core 创建文档/版本
 * V1 演进：MinIO 预签名 URL 直传，BFF 仅处理元数据
 *
 * 端点：
 *  - POST /api/v1/projects/:projectId/documents/upload（文件+元数据 → 创建文档+初始版本）
 */
@Controller("v1/projects/:projectId/documents")
@UseInterceptors(ProxyInterceptor)
export class CdeUploadController {
  constructor(
    @Inject(ProxyService) private readonly proxyService: ProxyService,
    @Inject(SchemaValidator) private readonly schemaValidator: SchemaValidator,
    @Inject(StorageService) private readonly storageService: StorageService,
  ) {}

  /**
   * 上传文件并创建文档
   *
   * 流程：
   * 1. 接收多部分表单文件（file）与元数据（comment 可选）
   * 2. 存储文件到本地磁盘，获取 storageKey + checksum
   * 3. 调用 Core Service 创建文档（含初始版本 v1）
   * 4. 返回 DocumentDto 响应
   */
  @Post("upload")
  @UseInterceptors(FileInterceptor("file"))
  async upload(
    @Req() request: Request,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<ProxyResult> {
    if (!file) {
      return {
        headers: {},
        data: { code: 400, message: "缺少上传文件", data: null },
        status: 400,
      };
    }

    const projectId = request.params["projectId"] as string;
    const comment = (request.body as Record<string, string> | undefined)
      ?.comment;
    const tenantId = request.header("x-tenant-id") ?? "default";

    // 1. 存储文件
    const stored = await this.storageService.store(
      file.buffer,
      file.originalname,
      file.mimetype,
      tenantId,
    );

    // 2. 构造创建文档请求（调用 Core）
    const createDocBody = {
      name: file.originalname,
      path: `/${projectId}/${stored.storageKey}`,
      mimeType: stored.mimeType,
      sizeBytes: stored.sizeBytes,
      storageKey: stored.storageKey,
      checksum: stored.checksum,
      comment,
    };

    // 3. 代理转发到 Core Service
    // 注意：原始请求是 multipart/form-data，但调用 Core 创建文档时是 application/json
    // 必须覆盖 content-type，否则 Core 端 @RequestBody 因 Content-Type 不匹配抛 HttpMediaTypeNotSupportedException
    const result = await this.proxyService.forward({
      method: "POST",
      path: CdeApiPaths.documents(projectId),
      body: createDocBody,
      headers: {
        ...this.extractForwardHeaders(request),
        "content-type": "application/json",
      },
      query: {},
    });

    // 4. 严格验证响应 schema
    if (result.status >= 200 && result.status < 300) {
      const businessData = this.schemaValidator.extractBusinessData(result);
      this.schemaValidator.validateStrict(
        businessData,
        documentDtoSchema as ZodType<unknown>,
        {
          domain: "cde-upload",
          operation: "upload",
          traceId: request.traceId,
          downstreamService: "core-service",
        },
      );
    }

    return result;
  }

  private extractForwardHeaders(
    request: Request,
  ): Record<string, string | string[]> {
    const headers: Record<string, string | string[]> = {};
    const forwardHeaderNames = [
      "authorization",
      "x-tenant-id",
      "x-user-id",
      "x-trace-id",
      "content-type",
      "accept-language",
    ];

    for (const name of forwardHeaderNames) {
      const value = request.header(name);
      if (value !== undefined && value.length > 0) {
        headers[name] = value;
      }
    }

    if (
      !headers["x-trace-id"] &&
      (request as unknown as Record<string, unknown>).traceId
    ) {
      headers["x-trace-id"] = (request as unknown as Record<string, unknown>)
        .traceId as string;
    }

    return headers;
  }
}

import { Injectable, Logger } from "@nestjs/common";
import { createHash, randomUUID } from "node:crypto";
import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

/** 文件存储根目录（Docker volume 挂载点） */
const STORAGE_ROOT =
  process.env.FILE_STORAGE_ROOT ?? "/home/AiDesign/data/files";

export interface StoredFile {
  storageKey: string;
  checksum: string;
  sizeBytes: number;
  originalName: string;
  mimeType: string;
}

/**
 * 文件存储服务（V0 本地磁盘存储，V1 迁移至 MinIO/S3）
 *
 * 存储路径：{STORAGE_ROOT}/{tenantId}/{uuid}/{originalName}
 * storageKey 格式：{uuid}/{originalName}（不含根路径，便于日后迁移至 S3 Key）
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);

  /**
   * 存储上传文件到本地磁盘
   *
   * @param buffer 文件内容
   * @param originalName 原始文件名
   * @param mimeType MIME 类型
   * @param tenantId 租户 ID
   * @returns 存储信息
   */
  async store(
    buffer: Buffer,
    originalName: string,
    mimeType: string,
    tenantId: string,
  ): Promise<StoredFile> {
    const uuid = randomUUID();
    const dir = join(STORAGE_ROOT, tenantId, uuid);
    const filePath = join(dir, originalName);

    await mkdir(dir, { recursive: true });
    await writeFile(filePath, buffer);

    const checksum = this.sha256(buffer);
    const storageKey = `${uuid}/${originalName}`;

    this.logger.log(
      { tenantId, storageKey, sizeBytes: buffer.length },
      "文件存储成功",
    );

    return {
      storageKey,
      checksum,
      sizeBytes: buffer.length,
      originalName,
      mimeType,
    };
  }

  private sha256(buffer: Buffer): string {
    return createHash("sha256").update(buffer).digest("hex");
  }
}

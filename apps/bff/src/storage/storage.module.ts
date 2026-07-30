import { Module } from "@nestjs/common";
import { StorageService } from "./storage.service";

/**
 * 存储模块
 * - V0：本地磁盘存储（Docker volume 挂载）
 * - V1：迁移至 MinIO/S3（替换 StorageService 实现）
 */
@Module({
  providers: [StorageService],
  exports: [StorageService],
})
export class StorageModule {}

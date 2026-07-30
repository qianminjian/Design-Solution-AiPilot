"use client";

import { useRef, useState } from "react";
import {
  Upload,
  App,
  Typography,
  Space,
  Progress,
  Button,
  List,
  Tag,
} from "antd";
import {
  InboxOutlined,
  FileTextOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  LoadingOutlined,
  ClockCircleOutlined,
  NumberOutlined,
} from "@ant-design/icons";
import { CdeApiPaths, documentDtoSchema } from "@design-platform/shared";

const { Dragger } = Upload;
const { Text } = Typography;

/** 允许上传的文件类型白名单（与 security.md §4 一致） */
const ALLOWED_EXTENSIONS = [
  ".rvt",
  ".rfa",
  ".3dm",
  ".skp",
  ".dwg",
  ".dxf",
  ".pdf",
  ".docx",
  ".xlsx",
  ".pptx",
  ".zip",
];

/** 文件大小上限：50MB */
const MAX_FILE_SIZE = 50 * 1024 * 1024;

/**
 * 上传队列状态机（对齐 D37.8 P04 CDE 资产库与上传中心）
 *
 * V0 简化映射：
 *  - queued      → 已入队，等待处理
 *  - hashing     → 前端计算 SHA256（D37.8 Manifest 占位）
 *  - uploading   → 上传到 BFF
 *  - verifying   → 等待 BFF/Core 响应、响应 schema 软校验
 *  - completed   → 上传成功
 *  - failed      → 上传失败，可重试
 *
 * V1 演进（需后端 D35 UploadSession 支持）：
 *  - paused      → 用户暂停
 *  - scanning    → 后端恶意扫描
 *  - rejected    → 扫描失败，禁止发布
 *  - verified    → VerifiedManifest 完成
 *  - binding     → 绑定到 AssetVersion
 */
type UploadStatus =
  "queued" | "hashing" | "uploading" | "verifying" | "completed" | "failed";

/** 状态 → Badge 颜色 */
const STATUS_TAG_COLOR: Record<UploadStatus, string> = {
  queued: "default",
  hashing: "blue",
  uploading: "processing",
  verifying: "warning",
  completed: "success",
  failed: "error",
};

/** 状态 → 中文标签 */
const STATUS_LABEL: Record<UploadStatus, string> = {
  queued: "已入队",
  hashing: "计算哈希",
  uploading: "上传中",
  verifying: "校验中",
  completed: "已完成",
  failed: "失败",
};

/** 状态 → 图标 */
const STATUS_ICON: Record<UploadStatus, React.ReactNode> = {
  queued: <ClockCircleOutlined />,
  hashing: <LoadingOutlined />,
  uploading: <LoadingOutlined />,
  verifying: <LoadingOutlined />,
  completed: <CheckCircleOutlined />,
  failed: <CloseCircleOutlined />,
};

interface UploadQueueItem {
  /** 唯一 ID（前端生成） */
  uid: string;
  /** 原始文件 */
  file: File;
  /** 当前状态 */
  status: UploadStatus;
  /** 上传进度（0-100） */
  progress: number;
  /** 错误信息（失败时） */
  error?: string;
  /** SHA256 哈希摘要（D37.8 Manifest 占位） */
  hash?: string;
  /** 服务端返回的文档 ID（成功后） */
  documentId?: string;
}

interface DocumentUploadProps {
  /** 项目 ID，用于构造上传 URL */
  projectId: string;
  /** 上传完成回调（任一文件成功后触发，父组件刷新列表） */
  onUploadComplete?: () => void;
}

/**
 * 文档拖拽上传组件（V0 实现已对齐 D37.8 上传状态机）
 *
 * V0 实现：
 *  - 文件入队 → 前端 SHA256 计算 → 上传 BFF → 响应 schema 软校验 → 完成/失败
 *  - 队列展示每项状态、进度、哈希摘要、重试按钮
 *  - 失败项可单独重试
 *
 * V1 演进：MinIO 预签名 URL 直传 + Multipart 队列 + 后端扫描状态
 */
export function DocumentUpload({
  projectId,
  onUploadComplete,
}: DocumentUploadProps) {
  const { message } = App.useApp();
  const [items, setItems] = useState<UploadQueueItem[]>([]);
  /** 当前处理的项 UID（保证串行，避免并发冲突） */
  const processingUidRef = useRef<string | null>(null);
  /** 待处理队列（FIFO） */
  const pendingQueueRef = useRef<UploadQueueItem[]>([]);

  /** 文件类型与大小校验 */
  const isValidFile = (file: File): { ok: boolean; reason?: string } => {
    const lower = file.name.toLowerCase();
    if (!ALLOWED_EXTENSIONS.some((ext) => lower.endsWith(ext))) {
      return {
        ok: false,
        reason: `不支持的类型，仅允许 ${ALLOWED_EXTENSIONS.join(", ")}`,
      };
    }
    if (file.size > MAX_FILE_SIZE) {
      return { ok: false, reason: "文件过大，最大支持 50MB" };
    }
    if (file.size === 0) {
      return { ok: false, reason: "文件为空" };
    }
    return { ok: true };
  };

  /** 计算 SHA256（D37.8 Manifest 占位，V1 由后端 VerifiedManifest 接管） */
  const computeSha256 = async (file: File): Promise<string> => {
    const buffer = await file.arrayBuffer();
    const digest = await crypto.subtle.digest("SHA-256", buffer);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  };

  /** 单文件上传处理 */
  const uploadFile = async (item: UploadQueueItem): Promise<void> => {
    // 1. hashing
    updateItem(item.uid, { status: "hashing", progress: 0 });
    let hash: string;
    try {
      hash = await computeSha256(item.file);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "哈希计算失败";
      updateItem(item.uid, { status: "failed", error: msg });
      return;
    }
    updateItem(item.uid, { hash });

    // 2. uploading
    updateItem(item.uid, { status: "uploading", progress: 0 });

    const formData = new FormData();
    formData.append("file", item.file);
    formData.append("comment", `V0 upload: ${item.file.name}`);
    // 传递前端计算的 hash 供后端校验（V1 改由后端 VerifiedManifest）
    formData.append("clientSha256", hash);

    try {
      const xhr = new XMLHttpRequest();
      await new Promise<void>((resolve, reject) => {
        xhr.upload.addEventListener("progress", (e) => {
          if (e.lengthComputable) {
            updateItem(item.uid, {
              progress: Math.round((e.loaded / e.total) * 100),
            });
          }
        });

        xhr.addEventListener("load", () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            // 3. verifying（响应 schema 软校验）
            updateItem(item.uid, { status: "verifying" });
            try {
              const resp = JSON.parse(xhr.responseText);
              const parsed = documentDtoSchema.safeParse(resp.data ?? resp);
              if (!parsed.success) {
                // eslint-disable-next-line no-console
                console.warn(
                  "[DocumentUpload] 响应 schema 验证警告",
                  parsed.error.flatten(),
                );
              }
              const docId = parsed.success ? parsed.data.id : undefined;
              // 4. completed
              updateItem(item.uid, {
                status: "completed",
                progress: 100,
                documentId: docId,
              });
              resolve();
            } catch {
              // HTTP 成功但响应体异常，仍视为完成
              updateItem(item.uid, { status: "completed", progress: 100 });
              resolve();
            }
          } else {
            reject(new Error(`HTTP ${xhr.status}`));
          }
        });

        xhr.addEventListener("error", () => reject(new Error("网络错误")));
        xhr.addEventListener("abort", () => reject(new Error("上传被取消")));

        xhr.open("POST", CdeApiPaths.upload(projectId));
        xhr.withCredentials = true;
        xhr.send(formData);
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "上传失败";
      updateItem(item.uid, { status: "failed", error: msg });
      throw err;
    }
  };

  /** 更新队列项 */
  const updateItem = (uid: string, patch: Partial<UploadQueueItem>) => {
    setItems((prev) =>
      prev.map((it) => (it.uid === uid ? { ...it, ...patch } : it)),
    );
  };

  /** 处理下一个待处理项 */
  const processNext = async () => {
    if (processingUidRef.current) return;
    const next = pendingQueueRef.current.shift();
    if (!next) return;

    processingUidRef.current = next.uid;
    try {
      await uploadFile(next);
      if (next.status === "completed") {
        onUploadComplete?.();
      }
    } finally {
      processingUidRef.current = null;
      // 递归处理后续项
      if (pendingQueueRef.current.length > 0) {
        void processNext();
      }
    }
  };

  /** 文件入队并触发处理 */
  const enqueueFiles = (files: File[]) => {
    const newItems: UploadQueueItem[] = [];
    for (const file of files) {
      const valid = isValidFile(file);
      if (!valid.ok) {
        message.error(`${file.name}: ${valid.reason}`);
        continue;
      }
      newItems.push({
        uid: `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        file,
        status: "queued",
        progress: 0,
      });
    }
    if (newItems.length === 0) return;

    setItems((prev) => [...prev, ...newItems]);
    pendingQueueRef.current.push(...newItems);
    void processNext();
  };

  /** 重试失败项 */
  const retryItem = async (item: UploadQueueItem) => {
    updateItem(item.uid, { status: "queued", progress: 0, error: undefined });
    pendingQueueRef.current.push({ ...item, status: "queued", progress: 0 });
    void processNext();
  };

  /** 移除已完成项 */
  const clearCompleted = () => {
    setItems((prev) => prev.filter((it) => it.status !== "completed"));
  };

  const completedCount = items.filter((it) => it.status === "completed").length;
  const failedCount = items.filter((it) => it.status === "failed").length;

  return (
    <Space direction="vertical" size="middle" style={{ width: "100%" }}>
      <Dragger
        multiple
        showUploadList={false}
        beforeUpload={(file) => {
          // multiple 模式下 antd 会逐个调用 beforeUpload，这里只做拦截
          // 实际入队由 onChange 处理（见下方 fileList）
          const valid = isValidFile(file);
          if (!valid.ok) {
            message.error(`${file.name}: ${valid.reason}`);
            return Upload.LIST_IGNORE;
          }
          // 返回 false 阻止 antd 自动上传，由 customRequest 处理
          return false;
        }}
        onChange={(info) => {
          // antd multiple + showUploadList=false 时，从 info.fileList 收集原生 File
          const files: File[] = [];
          for (const f of info.fileList) {
            if (f.originFileObj) {
              files.push(f.originFileObj as File);
            }
          }
          if (files.length > 0) {
            enqueueFiles(files);
          }
        }}
        aria-label="文档上传区域"
      >
        <p className="ant-upload-drag-icon">
          <InboxOutlined />
        </p>
        <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
        <p className="ant-upload-hint">
          <Text type="secondary">
            支持格式：{ALLOWED_EXTENSIONS.join(", ")} | 最大 50MB
          </Text>
        </p>
      </Dragger>

      {/* 上传队列展示（D37.8 要求：上传中心为可恢复队列） */}
      {items.length > 0 && (
        <div
          style={{
            border: "1px solid #e2e8f0",
            borderRadius: 8,
            padding: 12,
            background: "#f8fafc",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 8,
            }}
          >
            <Space size="small">
              <Text strong>上传队列</Text>
              <Text type="secondary">
                共 {items.length} 项 · 成功 {completedCount} · 失败{" "}
                {failedCount}
              </Text>
            </Space>
            {completedCount > 0 && (
              <Button
                size="small"
                type="link"
                onClick={clearCompleted}
                aria-label="清除已完成项"
              >
                清除已完成
              </Button>
            )}
          </div>
          <List
            size="small"
            dataSource={items}
            renderItem={(item) => (
              <List.Item
                key={item.uid}
                actions={
                  item.status === "failed"
                    ? [
                        <Button
                          key="retry"
                          size="small"
                          type="link"
                          icon={<ReloadOutlined />}
                          onClick={() => void retryItem(item)}
                          aria-label={`重试 ${item.file.name}`}
                        >
                          重试
                        </Button>,
                      ]
                    : undefined
                }
              >
                <Space direction="vertical" size={2} style={{ width: "100%" }}>
                  <Space size="small" style={{ width: "100%" }}>
                    <FileTextOutlined />
                    <Text
                      strong
                      ellipsis
                      style={{ maxWidth: 240 }}
                      title={item.file.name}
                    >
                      {item.file.name}
                    </Text>
                    <Tag
                      color={STATUS_TAG_COLOR[item.status]}
                      icon={STATUS_ICON[item.status]}
                    >
                      {STATUS_LABEL[item.status]}
                    </Tag>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {(item.file.size / 1024).toFixed(1)} KB
                    </Text>
                  </Space>
                  {(item.status === "uploading" ||
                    item.status === "hashing" ||
                    item.status === "verifying") && (
                    <Progress percent={item.progress} size="small" />
                  )}
                  {item.hash && (
                    <Space size={4} style={{ fontSize: 11 }}>
                      <NumberOutlined style={{ color: "#64748b" }} />
                      <Text
                        type="secondary"
                        style={{ fontSize: 11, fontFamily: "monospace" }}
                      >
                        SHA256: {item.hash.slice(0, 16)}...
                      </Text>
                    </Space>
                  )}
                  {item.error && (
                    <Text type="danger" style={{ fontSize: 12 }}>
                      {item.error}
                    </Text>
                  )}
                </Space>
              </List.Item>
            )}
          />
        </div>
      )}
    </Space>
  );
}

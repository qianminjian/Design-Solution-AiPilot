"use client";

import { useState } from "react";
import { Upload, App, Typography, Space } from "antd";
import { InboxOutlined } from "@ant-design/icons";
import type { UploadFile } from "antd/es/upload";

const { Dragger } = Upload;
const { Text } = Typography;

/** 允许上传的文件类型白名单（与 security.md §4 一致） */
const ALLOWED_EXTENSIONS = [
  ".rvt", ".rfa", ".3dm", ".skp", ".dwg", ".dxf",
  ".pdf", ".docx", ".xlsx", ".pptx", ".zip",
];

interface DocumentUploadProps {
  /** 项目 ID，用于构造上传 URL */
  projectId: string;
  /** 上传完成回调 */
  onUploadComplete?: () => void;
}

/**
 * 文档拖拽上传区域
 * - 使用 Ant Design Dragger 组件
 * - 文件类型白名单校验（设计文件格式，security.md §4）
 * - 上传完成后触发回调刷新列表
 */
export function DocumentUpload({ projectId: _projectId, onUploadComplete }: DocumentUploadProps) {
  const { message } = App.useApp();
  const [fileList, setFileList] = useState<UploadFile[]>([]);

  // 校验文件扩展名
  const isValidExtension = (fileName: string): boolean => {
    const lower = fileName.toLowerCase();
    return ALLOWED_EXTENSIONS.some((ext) => lower.endsWith(ext));
  };

  return (
    <Space direction="vertical" size="middle" style={{ width: "100%" }}>
      <Dragger
        multiple
        fileList={fileList}
        onChange={({ fileList: newFileList }) => setFileList(newFileList)}
        beforeUpload={(file) => {
          if (!isValidExtension(file.name)) {
            message.error(`不支持的文件类型：${file.name}，仅允许 ${ALLOWED_EXTENSIONS.join(", ")}`);
            return Upload.LIST_IGNORE;
          }
          return true;
        }}
        customRequest={({ onSuccess }) => {
          // V1 阶段：上传功能建设中，模拟成功
          setTimeout(() => {
            onSuccess?.("ok");
            message.info("文档上传功能建设中");
            onUploadComplete?.();
          }, 500);
        }}
        aria-label="文档上传区域"
      >
        <p className="ant-upload-drag-icon">
          <InboxOutlined />
        </p>
        <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
        <p className="ant-upload-hint">
          <Text type="secondary">
            支持格式：{ALLOWED_EXTENSIONS.join(", ")}
          </Text>
        </p>
      </Dragger>
    </Space>
  );
}

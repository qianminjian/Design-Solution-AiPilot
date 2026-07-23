"use client";

import { useEffect } from "react";
import { Modal, Form, Input, Select, InputNumber, App } from "antd";
import type {
  BuildingType,
  CreateProjectRequest,
} from "@design-platform/shared";
import { useCreateProject } from "@/hooks/use-projects";
import { ApiError } from "@/lib/api-client";

/** 表单字段值 */
interface CreateProjectFormValues {
  name: string;
  code: string;
  description?: string;
  buildingType: BuildingType;
  floorsMin: number;
  floorsMax: number;
}

/** 建筑类型选项 */
const BUILDING_TYPE_OPTIONS: { label: string; value: BuildingType }[] = [
  { label: "Office (办公)", value: "office" },
  { label: "Residential (住宅)", value: "residential" },
  { label: "Commercial (商业)", value: "commercial" },
  { label: "Mixed-use (综合)", value: "mixed" },
];

interface CreateProjectModalProps {
  open: boolean;
  onClose: () => void;
}

/**
 * 新建项目弹窗
 * - 6 个字段：name / code / description / buildingType / floorsMin / floorsMax
 * - 提交时调用 useCreateProject()，自动注入 Idempotency-Key
 * - 成功后关闭弹窗 + 通知父组件刷新列表 + message.success
 */
export function CreateProjectModal({ open, onClose }: CreateProjectModalProps) {
  const { message } = App.useApp();
  const [form] = Form.useForm<CreateProjectFormValues>();
  const createMutation = useCreateProject();

  // 弹窗关闭时重置表单与 mutation 状态
  useEffect(() => {
    if (!open) {
      form.resetFields();
      createMutation.reset();
    }
  }, [open, form, createMutation]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const payload: CreateProjectRequest = {
        name: values.name.trim(),
        code: values.code.trim().toUpperCase(),
        description: values.description?.trim() || undefined,
        buildingType: values.buildingType,
        floorsMin: values.floorsMin,
        floorsMax: values.floorsMax,
      };
      await createMutation.mutateAsync(payload);
      message.success("项目创建成功");
      onClose();
    } catch (error) {
      // 表单校验失败由 Form 自身处理，仅处理 API 错误
      if (error instanceof ApiError) {
        message.error(error.message || "项目创建失败");
      } else if (error instanceof Error) {
        // validateFields 抛出的 ValidationError 包含 errorFields，无需提示
        if (!("errorFields" in error)) {
          message.error(error.message);
        }
      }
    }
  };

  return (
    <Modal
      title="新建项目"
      open={open}
      onCancel={onClose}
      onOk={handleSubmit}
      okText="创建"
      cancelText="取消"
      confirmLoading={createMutation.isPending}
      destroyOnClose
      maskClosable={false}
    >
      <Form<CreateProjectFormValues>
        form={form}
        layout="vertical"
        initialValues={{
          buildingType: "office",
          floorsMin: 5,
          floorsMax: 15,
        }}
      >
        <Form.Item
          label="项目名称"
          name="name"
          rules={[
            { required: true, message: "请输入项目名称" },
            { max: 128, message: "项目名称不超过 128 字符" },
          ]}
        >
          <Input placeholder="如：Shanghai Office Tower" allowClear />
        </Form.Item>
        <Form.Item
          label="项目编码"
          name="code"
          rules={[
            { required: true, message: "请输入项目编码" },
            {
              pattern: /^[A-Z0-9-]+$/,
              message: "只允许大写字母、数字与连字符",
            },
            { max: 64, message: "项目编码不超过 64 字符" },
          ]}
          extra="只允许大写字母、数字与连字符，如 SH-OFFICE-001"
        >
          <Input
            placeholder="SH-OFFICE-001"
            allowClear
            onChange={(e) => {
              // 输入时强制大写，改善体验
              const upper = e.target.value.toUpperCase();
              if (upper !== e.target.value) {
                form.setFieldValue("code", upper);
              }
            }}
          />
        </Form.Item>
        <Form.Item
          label="描述"
          name="description"
          rules={[{ max: 1024, message: "描述不超过 1024 字符" }]}
        >
          <Input.TextArea
            rows={3}
            placeholder="项目背景、范围、目标等说明"
            allowClear
          />
        </Form.Item>
        <Form.Item label="建筑类型" name="buildingType">
          <Select options={BUILDING_TYPE_OPTIONS} />
        </Form.Item>
        <Form.Item
          label="最小层数"
          name="floorsMin"
          rules={[
            { required: true, message: "请输入最小层数" },
            { type: "number", min: 1, max: 100, message: "范围 1-100" },
          ]}
        >
          <InputNumber min={1} max={100} style={{ width: "100%" }} />
        </Form.Item>
        <Form.Item
          label="最大层数"
          name="floorsMax"
          rules={[
            { required: true, message: "请输入最大层数" },
            { type: "number", min: 1, max: 100, message: "范围 1-100" },
            {
              validator: (_, value: number) => {
                const min = form.getFieldValue("floorsMin");
                if (
                  typeof min === "number" &&
                  typeof value === "number" &&
                  value < min
                ) {
                  return Promise.reject(new Error("最大层数不能小于最小层数"));
                }
                return Promise.resolve();
              },
            },
          ]}
        >
          <InputNumber min={1} max={100} style={{ width: "100%" }} />
        </Form.Item>
      </Form>
    </Modal>
  );
}

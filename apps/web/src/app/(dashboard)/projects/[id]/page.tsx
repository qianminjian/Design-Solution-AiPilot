"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import { Button, Space, Spin } from "antd";
import {
  ArrowLeftOutlined,
  FolderOutlined,
  ApartmentOutlined,
  ExperimentOutlined,
} from "@ant-design/icons";
import { useProjectDetail } from "@/hooks/use-project-detail";
import { useGates } from "@/hooks/use-gates";
import { ProjectHeader } from "@/components/project/project-header";
import { ReadinessDashboard } from "@/components/project/readiness-dashboard";
import { StageTimeline } from "@/components/project/stage-timeline";
import { GateDecisionList } from "@/components/project/gate-decision-list";
import { DataErrorAlert } from "@/components/common/data-error-alert";
import type { StageInstanceDto } from "@design-platform/shared";

/**
 * 项目详情页
 * - 服务端路由参数 params.id 通过 React 19 use() 解包（Next.js 15 params 为 Promise）
 * - 数据获取：useProjectDetail（项目 + 阶段列表聚合）
 * - 门禁决策：取首个非 closed 阶段关联的门禁（避免一次性拉取所有阶段门禁）
 * - 加载/错误三态处理（错误使用 DataErrorAlert 统一展示，不再弹 toast）
 *
 * 参考 design-ui-system/pages/project-home.html 的项目头部 + 门控横条布局
 */
export default function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: projectId } = use(params);
  const router = useRouter();

  const { data, isLoading, isError, error } = useProjectDetail(projectId);

  // 取首个非 closed/cancelled 阶段作为当前阶段，查询其门禁决策
  // 避免一次性拉取所有阶段门禁造成请求放大
  const currentStage: StageInstanceDto | undefined = data?.stages.find(
    (s) => s.status !== "closed" && s.status !== "cancelled",
  );
  const { data: gates, isLoading: gatesLoading } = useGates(
    currentStage?.id ?? null,
  );

  // 加载态
  if (isLoading) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: 400,
        }}
      >
        <Spin size="large" />
      </div>
    );
  }

  // 错误态：使用 DataErrorAlert 统一展示，404/403/500/schema 失败均通过该组件
  if (isError || !data) {
    return (
      <DataErrorAlert
        error={error}
        context="项目"
        variant="result"
        onRetry={() => router.push("/projects")}
        retryLabel="返回项目列表"
      />
    );
  }

  const { project, stages } = data;

  return (
    <Space direction="vertical" size="middle" style={{ width: "100%" }}>
      {/* 顶部操作栏：返回 + 跳转文档库 */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <Button
          type="link"
          icon={<ArrowLeftOutlined />}
          onClick={() => router.push("/projects")}
          style={{ paddingLeft: 0 }}
        >
          返回项目列表
        </Button>
        <Space>
          <Button
            icon={<ExperimentOutlined />}
            onClick={() => router.push(`/projects/${projectId}/design-options`)}
          >
            设计选项
          </Button>
          <Button
            icon={<FolderOutlined />}
            onClick={() => router.push(`/projects/${projectId}/documents`)}
          >
            文档库
          </Button>
          <Button
            icon={<ApartmentOutlined />}
            onClick={() => router.push(`/projects/${projectId}/coordination`)}
          >
            多专业协调
          </Button>
        </Space>
      </div>

      {/* 项目头部 */}
      <ProjectHeader project={project} />

      {/* 项目驾驶舱（D37.7 P02 Readiness 仪表盘） */}
      <ReadinessDashboard stages={stages} projectId={projectId} />

      {/* 阶段时间线 */}
      <StageTimeline stages={stages} />

      {/* 门禁决策列表（关联当前阶段） */}
      <GateDecisionList gates={gates ?? []} loading={gatesLoading} />
    </Space>
  );
}

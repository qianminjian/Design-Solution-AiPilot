"use client";

import { use, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button, Space, Spin, Result, App } from "antd";
import { ArrowLeftOutlined, FolderOutlined } from "@ant-design/icons";
import { useProjectDetail } from "@/hooks/use-project-detail";
import { useGates } from "@/hooks/use-gates";
import { ProjectHeader } from "@/components/project/project-header";
import { StageTimeline } from "@/components/project/stage-timeline";
import { GateDecisionList } from "@/components/project/gate-decision-list";
import { ApiError } from "@/lib/api-client";
import type { StageInstanceDto } from "@design-platform/shared";

/**
 * 项目详情页
 * - 服务端路由参数 params.id 通过 React 19 use() 解包（Next.js 15 params 为 Promise）
 * - 数据获取：useProjectDetail（项目 + 阶段列表聚合）
 * - 门禁决策：取首个非 closed 阶段关联的门禁（避免一次性拉取所有阶段门禁）
 * - 加载/错误三态处理
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
  const { message } = App.useApp();

  const { data, isLoading, isError, error } = useProjectDetail(projectId);

  // 取首个非 closed/cancelled 阶段作为当前阶段，查询其门禁决策
  // 避免一次性拉取所有阶段门禁造成请求放大
  const currentStage: StageInstanceDto | undefined = data?.stages.find(
    (s) => s.status !== "closed" && s.status !== "cancelled",
  );
  const { data: gates, isLoading: gatesLoading } = useGates(
    currentStage?.id ?? null,
  );

  // 错误提示（404 时显示 Result，其他错误用 message）
  useEffect(() => {
    if (isError && error) {
      const tip =
        error instanceof ApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : "项目详情加载失败";
      message.error(tip);
    }
  }, [isError, error, message]);

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

  // 错误态：404 显示专用 Result，其他错误显示通用 Result
  if (isError || !data) {
    const isNotFound = error instanceof ApiError && error.status === 404;
    return (
      <Result
        status={isNotFound ? "404" : "error"}
        title={isNotFound ? "项目不存在" : "加载失败"}
        subTitle={
          isNotFound
            ? "该项目可能已被删除或您无权访问"
            : error instanceof Error
              ? error.message
              : "请稍后重试"
        }
        extra={
          <Button type="primary" onClick={() => router.push("/projects")}>
            返回项目列表
          </Button>
        }
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
        <Button
          icon={<FolderOutlined />}
          onClick={() => router.push(`/projects/${projectId}/documents`)}
        >
          文档库
        </Button>
      </div>

      {/* 项目头部 */}
      <ProjectHeader project={project} />

      {/* 阶段时间线 */}
      <StageTimeline stages={stages} />

      {/* 门禁决策列表（关联当前阶段） */}
      <GateDecisionList gates={gates ?? []} loading={gatesLoading} />
    </Space>
  );
}

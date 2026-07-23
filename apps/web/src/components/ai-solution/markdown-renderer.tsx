"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Typography } from "antd";

const { Text } = Typography;

/**
 * 轻量 Markdown 渲染器
 *
 * 用于渲染 AI 生成方案候选的 Markdown 内容，支持 GFM（表格、删除线、任务列表等）。
 *
 * 安全性：react-markdown 默认不解析 HTML，避免 XSS 风险（security.md §6.1）。
 * 如未来需要嵌入 HTML，必须先经过 DOMPurify 消毒。
 */
export function MarkdownRenderer({ content }: { content: string }) {
  if (!content) {
    return <Text type="secondary">（无内容）</Text>;
  }

  return (
    <div
      className="ai-markdown"
      style={{
        fontSize: 14,
        lineHeight: 1.7,
        wordBreak: "break-word",
      }}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // 表格响应式包装
          table: ({ node: _node, ...props }) => (
            <div style={{ overflowX: "auto" }}>
              <table
                style={{
                  borderCollapse: "collapse",
                  width: "100%",
                  fontSize: 13,
                  margin: "8px 0",
                }}
                {...props}
              />
            </div>
          ),
          th: ({ node: _node, ...props }) => (
            <th
              style={{
                border: "1px solid #e8e8e8",
                padding: "6px 10px",
                background: "#fafafa",
                textAlign: "left",
              }}
              {...props}
            />
          ),
          td: ({ node: _node, ...props }) => (
            <td
              style={{
                border: "1px solid #e8e8e8",
                padding: "6px 10px",
              }}
              {...props}
            />
          ),
          // 代码块
          pre: ({ node: _node, ...props }) => (
            <pre
              style={{
                background: "#f6f8fa",
                padding: 12,
                borderRadius: 6,
                overflowX: "auto",
                fontSize: 13,
              }}
              {...props}
            />
          ),
          code: ({ node: _node, ...props }) => (
            <code
              style={{
                background: "#f6f8fa",
                padding: "2px 4px",
                borderRadius: 3,
                fontSize: 13,
                fontFamily:
                  "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
              }}
              {...props}
            />
          ),
          // 引用块
          blockquote: ({ node: _node, ...props }) => (
            <blockquote
              style={{
                borderLeft: "3px solid #d9d9d9",
                paddingLeft: 12,
                margin: "8px 0",
                color: "#595959",
              }}
              {...props}
            />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

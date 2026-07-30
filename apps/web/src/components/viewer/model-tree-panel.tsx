"use client";

import { Card, Empty, Input, Space, Tag, Typography, Tree } from "antd";
import { SearchOutlined, ApartmentOutlined } from "@ant-design/icons";
import type { DataNode } from "antd/es/tree";
import { useState } from "react";

const { Text } = Typography;

/**
 * D37.9 P05 左侧模型树
 *
 * V0 占位：展示模型对象分组的骨架结构，不渲染真实对象树
 * V1 接入：3D SDK 加载模型后，通过 SDK API 获取对象树
 *
 * 对齐 D37.9 §选择模型：
 *  - Focus 与 Selection 分离
 *  - 对象树、Canvas、属性/Issue 同步
 *  - 多选显示共同属性和数量
 */
export function ModelTreePanel() {
  const [search, setSearch] = useState("");

  const treeData: DataNode[] = [
    {
      key: "levels",
      title: (
        <Space size={4}>
          <ApartmentOutlined />
          <Text strong style={{ fontSize: 12 }}>
            Levels
          </Text>
          <Tag color="blue" style={{ fontSize: 10, margin: 0 }}>
            4
          </Tag>
        </Space>
      ),
      selectable: false,
      children: [
        {
          key: "level-1",
          title: <Text style={{ fontSize: 12 }}>Level 1</Text>,
        },
        {
          key: "level-2",
          title: <Text style={{ fontSize: 12 }}>Level 2</Text>,
        },
        {
          key: "level-3",
          title: <Text style={{ fontSize: 12 }}>Level 3</Text>,
        },
        {
          key: "level-4",
          title: <Text style={{ fontSize: 12 }}>Level 4</Text>,
        },
      ],
    },
    {
      key: "categories",
      title: (
        <Space size={4}>
          <ApartmentOutlined />
          <Text strong style={{ fontSize: 12 }}>
            By Category
          </Text>
          <Tag color="geekblue" style={{ fontSize: 10, margin: 0 }}>
            6
          </Tag>
        </Space>
      ),
      selectable: false,
      children: [
        {
          key: "walls",
          title: <Text style={{ fontSize: 12 }}>Walls (12)</Text>,
        },
        {
          key: "doors",
          title: <Text style={{ fontSize: 12 }}>Doors (8)</Text>,
        },
        {
          key: "windows",
          title: <Text style={{ fontSize: 12 }}>Windows (15)</Text>,
        },
        {
          key: "floors",
          title: <Text style={{ fontSize: 12 }}>Floors (4)</Text>,
        },
        {
          key: "roofs",
          title: <Text style={{ fontSize: 12 }}>Roofs (1)</Text>,
        },
        {
          key: "furniture",
          title: <Text style={{ fontSize: 12 }}>Furniture (45)</Text>,
        },
      ],
    },
  ];

  return (
    <Card
      size="small"
      title={
        <Space size={4}>
          <ApartmentOutlined />
          <Text strong style={{ fontSize: 13 }}>
            Model Tree
          </Text>
        </Space>
      }
      bodyStyle={{ padding: 8 }}
      style={{ height: "100%" }}
    >
      <Input
        allowClear
        prefix={<SearchOutlined />}
        placeholder="搜索对象..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        size="small"
        style={{ marginBottom: 8 }}
        aria-label="搜索模型对象"
      />
      <div
        style={{
          maxHeight: 460,
          overflowY: "auto",
          fontSize: 12,
        }}
      >
        <Tree
          treeData={treeData}
          defaultExpandAll
          showLine
          multiple
          onSelect={(keys) => {
            // V0：仅记录选中，V1 接入 SDK 后高亮对象
            if (keys.length > 0) {
              // eslint-disable-next-line no-console
              console.debug("[V0 Viewer] selected:", keys);
            }
          }}
        />
      </div>
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description={
          <Text type="secondary" style={{ fontSize: 11 }}>
            V0 占位：待 V1 接入 SDK
          </Text>
        }
        style={{ padding: 8, display: "none" }}
      />
    </Card>
  );
}

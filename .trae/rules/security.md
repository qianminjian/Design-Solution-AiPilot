---
alwaysApply: true
description: 安全、隐私与认证核心原则——所有语言通用，始终生效
---

# 安全与隐私核心规则（安全+隐私+认证统一）

> 来源：PrismScan L2-project 规则适配

## 适用范围

本规则适用于本项目全部技术栈（NestJS 11 / Java 21 + Spring Boot 3.4 / Python 3.12 + FastAPI / PostgreSQL 16 / S3-MinIO / Hybrid-Site 部署），始终生效。

## 1. 密钥管理

- 所有密钥、Token、连接串必须通过环境变量读取，禁止硬编码到源码。
- `.env` 必须在 `.gitignore` 中，禁止提交到 Git 仓库。
- `.env.example` 仅记录变量名与说明（不含真实值），随仓库提交供团队参考。
- 应用启动时必须验证关键配置（`DB_PASSWORD`、`JWT_SECRET`、`LLM_API_KEY`、`S3_SECRET_KEY` 等）是否存在，缺失即拒绝启动。
- 生产环境密钥使用 KMS（Key Management Service）托管，禁止明文落盘。
- 密钥 90 天轮换一次，轮换期间新旧密钥并行 7 天，确保平滑切换。
- 禁止行为清单：
  - 禁止硬编码密钥到源码、配置文件、注释。
  - 禁止密钥进入 Git 历史（如已误提交，须用 `git filter-repo` 清理并轮换密钥）。
  - 禁止在日志、错误信息、APM 追踪中打印密钥明文。

## 2. 敏感信息保护

### 2.1 传输安全

- HTTPS 强制，HTTP 请求 301 重定向到 HTTPS。
- 启用 HSTS（`Strict-Transport-Security: max-age=31536000; includeSubDomains`）。

### 2.2 认证 Token

- JWT access token 有效期 ≤ 15 分钟。
- JWT refresh token 有效期 ≤ 7 天，且支持 rotation（每次刷新后旧 token 失效）。
- refresh token 必须存储在 httpOnly + Secure + SameSite=Strict 的 Cookie 中，禁止存 localStorage。
- access token 可存内存（前端），禁止存 localStorage（防 XSS 窃取）。

### 2.3 密码存储

- 密码使用 bcrypt（cost ≥ 12）或 argon2id 存储。
- 禁止 MD5 / SHA1 / 明文存储。
- 禁止在日志、异常、响应中返回密码哈希。

## 3. 日志脱敏

以下信息在日志中必须脱敏：手机号、邮箱、身份证号、银行卡号、设计文件路径。

### 3.1 TypeScript 版本（NestJS BFF）

```typescript
/**
 * 敏感信息脱敏工具
 * @param value 原始值
 * @param type 类型：phone | email | idCard | bankCard | filePath
 * @returns 脱敏后的字符串
 */
function maskSensitive(
  value: string,
  type: 'phone' | 'email' | 'idCard' | 'bankCard' | 'filePath',
): string {
  if (!value) return value;
  switch (type) {
    case 'phone':
      // 保留前3后4，中间4位掩码
      return value.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2');
    case 'email':
      // 保留首字符与@后域名
      const [name, domain] = value.split('@');
      return `${name[0]}***@${domain}`;
    case 'idCard':
      // 保留前3后4
      return value.replace(/(\d{3})\d*(\d{4})/, '$1***********$2');
    case 'bankCard':
      // 保留后4位
      return `**** **** **** ${value.slice(-4)}`;
    case 'filePath':
      // 设计文件路径仅保留文件名哈希前缀
      const fileName = value.split('/').pop() ?? value;
      return `[file:${fileName.slice(0, 8)}***]`;
    default:
      return '***';
  }
}
```

### 3.2 Python 版本（FastAPI AI 服务）

```python
import re
from typing import Literal

SensitiveType = Literal["phone", "email", "id_card", "bank_card", "file_path"]


def mask_sensitive(value: str, sensitive_type: SensitiveType) -> str:
    """敏感信息脱敏工具

    Args:
        value: 原始值
        sensitive_type: 类型 phone/email/id_card/bank_card/file_path

    Returns:
        脱敏后的字符串
    """
    if not value:
        return value

    match sensitive_type:
        case "phone":
            return re.sub(r"(\d{3})\d{4}(\d{4})", r"\1****\2", value)
        case "email":
            name, _, domain = value.partition("@")
            return f"{name[0]}***@{domain}" if domain else "***"
        case "id_card":
            return re.sub(r"(\d{3})\d*(\d{4})", r"\1***********\2", value)
        case "bank_card":
            return f"**** **** **** {value[-4:]}"
        case "file_path":
            file_name = value.rsplit("/", 1)[-1]
            return f"[file:{file_name[:8]}***]"
        case _:
            return "***"
```

### 3.3 Java 版本（Spring Boot 核心服务）

```java
package com.platform.core.common.util;

/**
 * 敏感信息脱敏工具
 */
public final class MaskUtil {

    private MaskUtil() {}

    /**
     * 敏感信息脱敏
     * @param value 原始值
     * @param type 类型：phone/email/idCard/bankCard/filePath
     * @return 脱敏后的字符串
     */
    public static String maskSensitive(String value, SensitiveType type) {
        if (value == null || value.isEmpty()) {
            return value;
        }
        return switch (type) {
            case PHONE -> value.replaceAll("(\\d{3})\\d{4}(\\d{4})", "$1****$2");
            case EMAIL -> {
                int at = value.indexOf('@');
                if (at <= 0) yield "***";
                yield value.charAt(0) + "***" + value.substring(at);
            }
            case ID_CARD -> value.replaceAll("(\\d{3})\\d*(\\d{4})", "$1***********$2");
            case BANK_CARD -> "**** **** **** " + value.substring(value.length() - 4);
            case FILE_PATH -> {
                String fileName = value.substring(value.lastIndexOf('/') + 1);
                yield "[file:" + fileName.substring(0, Math.min(8, fileName.length())) + "***]";
            }
        };
    }

    public enum SensitiveType {
        PHONE, EMAIL, ID_CARD, BANK_CARD, FILE_PATH
    }
}
```

## 4. 输入校验

- TypeScript（NestJS）：使用 Zod 或 class-validator + `@Validated` 进行 DTO 校验。
- Python（FastAPI）：使用 Pydantic v2 模型校验，启用 `strict` 模式。
- Java（Spring Boot）：使用 Bean Validation（`@NotNull` / `@Size` / `@Pattern` 等）+ `@Validated`。
- 文件上传白名单：仅允许 `.rvt` / `.3dm` / `.skp` / `.dwg` / `.rfa` / `.dxf` 等设计文件格式，服务端二次校验 MIME 与文件头魔数。
- 前端校验仅为用户体验，服务端必须二次校验（不可信任前端）。

## 5. SQL 注入防护

- 所有数据库查询使用参数化查询或 ORM（JPA / SQLAlchemy / Prisma）。
- 禁止字符串拼接 SQL 语句。
- 使用原生 SQL 时，必须使用 `$1` / `?` 占位符绑定参数。

```java
// 正确：参数化查询
@Query("SELECT p FROM Project p WHERE p.name = :name")
Project findByName(@Param("name") String name);

// 禁止：字符串拼接
// String sql = "SELECT * FROM project WHERE name = '" + name + "'";
```

## 6. XSS / CSRF / 路径穿越

### 6.1 XSS 防护

- React JSX 默认自动转义，禁止使用 `dangerouslySetInnerHTML` 除非内容已消毒。
- 富文本输入使用 DOMPurify 消毒后存储。

### 6.2 CSRF 防护

- 使用 CSRF Token 或 SameSite=Strict Cookie。
- 状态变更请求（POST/PUT/PATCH/DELETE）必须携带 CSRF Token。

### 6.3 路径穿越防护

- 文件路径必须使用 `path.resolve` 解析后校验是否在允许的根目录内。
- 禁止直接拼接用户输入到文件路径。
- 执行外部命令使用 `execFile` + 数组参数，禁止 `exec` + 字符串拼接。

```typescript
import path from 'node:path';
import fs from 'node:fs';

// 正确：路径穿越防护
const ALLOWED_ROOT = '/data/uploads';
function safeReadFile(userInput: string): Buffer {
  const resolved = path.resolve(ALLOWED_ROOT, userInput);
  if (!resolved.startsWith(ALLOWED_ROOT + path.sep)) {
    throw new Error('非法文件路径');
  }
  return fs.readFileSync(resolved);
}
```

## 7. CORS 与安全 Header

- 禁止 `Access-Control-Allow-Origin: *`，必须指定白名单域名。
- 安全 Header 强制配置：

| Header | 值 | 作用 |
|--------|-----|------|
| `X-Frame-Options` | `DENY` | 防止点击劫持 |
| `X-Content-Type-Options` | `nosniff` | 防止 MIME 嗅探 |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` | 强制 HTTPS |
| `Content-Security-Policy` | `default-src 'self'` | 限制资源加载来源 |

## 8. PII 数据分级

| 等级 | 说明 | 示例 | 处理要求 |
|------|------|------|----------|
| L1 | 直接识别信息 | 姓名、手机号、身份证号、邮箱 | 加密存储 + 访问审计 + 日志脱敏 |
| L2 | 间接识别信息 | 部门、岗位、工号 | 访问控制 + 日志脱敏 |
| L3 | 敏感业务数据 | 项目预算、合同金额 | 加密存储 + 访问审计 |
| L4 | 专业设计成果 | 方案图纸、BIM 模型 | 访问控制 + 水印 + 版本追溯 |
| L5 | 业务核心设计文件 | 施工图终版、审批签章文件 | 加密存储 + 最小权限 + 全量审计 + 防泄露水印 |

- 数据库列注释必须标注 PII 等级（如 `-- PII: L1 手机号`）。
- L1 / L5 数据访问须记录审计日志。

## 9. 数据生命周期与用户权利

### 9.1 数据生命周期（7 步）

1. **采集**：最小必要原则，明确告知用途。
2. **存储**：加密存储（L1/L5 字段级加密）。
3. **使用**：按授权范围使用，禁止超范围。
4. **共享**：第三方共享须签 DPA + 用户同意。
5. **留存**：按法定期限留存，到期自动删除。
6. **销毁**：安全销毁（覆写 + 加密密钥销毁）。
7. **审计**：全生命周期操作可审计。

### 9.2 用户权利（8 项）

| 权利 | 说明 |
|------|------|
| 知情权 | 告知数据采集目的与范围 |
| 访问权 | 用户可查询自己的数据 |
| 更正权 | 用户可修改不准确的数据 |
| 删除权 | 用户可请求数据删除（被遗忘权） |
| 限制处理权 | 用户可限制数据处理 |
| 可携带权 | 用户可导出数据 |
| 反对权 | 用户可反对特定数据处理 |
| 自动决策拒绝权 | 用户可拒绝纯自动化决策（含 AI） |

## 10. 第三方 DPA（OD-05 外部 AI 接入）

- 外部 AI Provider 接入须签署 DPA（数据处理协议）。
- LLM 供应商合同中须明确：API 提交的数据不进入模型训练集。
- 建筑专业 AI（EVAI / 小库 AI / 建筑学长）在 V1 维持 ManualHandoff（见 OD-05 决策），未获正式 API / 许可不得自动接入。
- 第三方数据传输前须完成安全评估，传输过程加密（TLS 1.2+）。

## 11. 跨境数据传输（Hybrid-Site 部署）

- Hybrid-Site 部署模式下（OD-06），客户站点数据出境须满足：
  1. 法律评估：确认目标国家 / 地区数据保护法律 adequacy。
  2. 安全评估：通过信息安全评估（含数据分类、加密方案）。
  3. 用户同意：明示告知数据跨境传输并取得用户同意。
  4. 加密传输：传输使用 TLS 1.2+，存储使用 AES-256。
- 境外云 Region（OD-01）部署时，数据驻留策略须符合当地法规（如 GDPR）。

## 12. AI 安全红线

- 所有 AI 输出必须标记为"AI 辅助"，不作为最终专业判断。
- AI 不替代注册建筑师 / 工程师的专业审签和监管审批。
- 所有 AI 结果按风险等级进入人工复核流程：

| 风险等级 | 说明 | 复核要求 |
|----------|------|----------|
| 低 | 文本摘要、标签生成 | 抽检复核 |
| 中 | 方案建议、规范检查 | 逐项复核 |
| 高 | 结构计算、施工图生成 | 强制专业复核 + 签章 |
| 极高 | 合规判定、安全评估 | 双人复核 + 注册师签章 |

- AI 调用须设置超时（默认 30s）与重试策略。
- AI 调用结果须记录 trace、latency、prompt 摘要到日志（不含敏感 PII）。

## 13. CI 安全门禁

| 门禁项 | 工具 | 触发条件 |
|--------|------|----------|
| 密钥扫描 | gitleaks / trufflehog | 每次提交 + PR |
| 依赖漏洞 | npm audit / pip-audit / mvn dependency-check | 每日 + PR |
| SAST 静态分析 | semgrep | 每次 PR |
| 容器镜像扫描 | trivy | 每次镜像构建 |
| 许可证检查 | license-checker | 每次依赖变更 |

- 高危漏洞（CVSS ≥ 7.0）阻断 CI 合并。
- 密钥泄露告警须立即轮换密钥并清理 Git 历史。

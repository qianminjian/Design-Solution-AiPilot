package com.platform.core.iam.controller;

import com.platform.core.common.response.ApiResponse;
import com.platform.core.iam.dto.ApiTokenDto;
import com.platform.core.iam.dto.CreateApiTokenRequest;
import com.platform.core.iam.dto.CreateApiTokenResponse;
import com.platform.core.iam.dto.RevokeApiTokenRequest;
import com.platform.core.iam.service.ApiTokenService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * IAM API Token Controller
 *
 * <p>端点（V1）：
 * <ul>
 *   <li>GET    /api/v1/iam/tokens            查询当前用户的所有 Token（不含明文）</li>
 *   <li>POST   /api/v1/iam/tokens            创建新 Token（返回明文，仅本次）</li>
 *   <li>DELETE /api/v1/iam/tokens/{id}       撤销指定 Token（软撤销）</li>
 * </ul>
 *
 * <p>身份从 JWT 解析的 SecurityContext 获取，不读取 x-user-id 请求头（防伪造）。
 *
 * <p>安全红线：
 * <ul>
 *   <li>明文 token 仅在 POST 响应中返回一次</li>
 *   <li>撤销他人 Token 抛 IllegalStateException（403 by GlobalExceptionHandler）</li>
 *   <li>所有操作触发审计日志（INFO 级别）</li>
 * </ul>
 */
@RestController
@RequestMapping("/api/v1/iam/tokens")
public class ApiTokenController {

    private final ApiTokenService service;

    public ApiTokenController(ApiTokenService service) {
        this.service = service;
    }

    /**
     * 查询当前用户的所有 Token
     */
    @GetMapping
    public ApiResponse<List<ApiTokenDto>> listMyTokens() {
        return ApiResponse.success(service.listMyTokens());
    }

    /**
     * 创建新 Token（返回明文，仅本次响应）
     */
    @PostMapping
    public ApiResponse<CreateApiTokenResponse> createToken(
            @Valid @RequestBody CreateApiTokenRequest request) {
        return ApiResponse.success(service.createToken(request));
    }

    /**
     * 撤销指定 Token（软撤销）
     */
    @DeleteMapping("/{tokenId}")
    public ApiResponse<ApiTokenDto> revokeToken(
            @PathVariable UUID tokenId,
            @RequestBody(required = false) RevokeApiTokenRequest request) {
        // request 可能为 null（无 body），使用空对象兜底
        RevokeApiTokenRequest req = request != null ? request : new RevokeApiTokenRequest(null);
        return ApiResponse.success(service.revokeToken(tokenId, req));
    }
}

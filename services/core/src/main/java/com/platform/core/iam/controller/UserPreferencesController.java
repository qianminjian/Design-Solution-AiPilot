package com.platform.core.iam.controller;

import com.platform.core.common.response.ApiResponse;
import com.platform.core.iam.dto.UpdateUserPreferencesRequest;
import com.platform.core.iam.dto.UserPreferencesDto;
import com.platform.core.iam.service.UserPreferencesService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 用户偏好设置 Controller
 *
 * 端点：
 *  - GET  /api/v1/users/me/preferences  查询当前用户偏好（不存在则返回默认值）
 *  - PUT  /api/v1/users/me/preferences  更新（或首次创建）当前用户偏好
 *
 * 身份从 JWT 解析的 SecurityContext 获取，不读取 x-user-id 请求头（防伪造）。
 */
@RestController
@RequestMapping("/api/v1/users/me/preferences")
public class UserPreferencesController {

    private final UserPreferencesService service;

    public UserPreferencesController(UserPreferencesService service) {
        this.service = service;
    }

    /**
     * 查询当前用户偏好设置
     */
    @GetMapping
    public ApiResponse<UserPreferencesDto> getMyPreferences() {
        return ApiResponse.success(service.getMyPreferences());
    }

    /**
     * 更新（或首次创建）当前用户偏好设置
     */
    @PutMapping
    public ApiResponse<UserPreferencesDto> updateMyPreferences(
            @Valid @RequestBody UpdateUserPreferencesRequest request) {
        return ApiResponse.success(service.updateMyPreferences(request));
    }
}

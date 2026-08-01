package com.platform.core.iam.repository;

import com.platform.core.iam.domain.UserPreferences;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

/**
 * 用户偏好设置 Repository
 */
@Repository
public interface UserPreferencesRepository extends JpaRepository<UserPreferences, UUID> {

    /**
     * 按主体 ID 查询偏好设置（一对一）
     */
    Optional<UserPreferences> findByPrincipalId(UUID principalId);
}

package com.nova.backend.repository;

import com.nova.backend.entity.RefreshToken;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

public interface RefreshTokenRepository extends JpaRepository<RefreshToken, UUID> {

    Optional<RefreshToken> findByTokenHashAndRevokedFalseAndExpiresAtAfter(String tokenHash, Instant now);

    @Modifying
    @Query("update RefreshToken rt set rt.revoked = true where rt.user.id = :userId and rt.revoked = false")
    int revokeAllActiveForUser(@Param("userId") UUID userId);
}

package com.nova.backend.repository;

import com.nova.backend.entity.CycleLog;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface CycleLogRepository extends JpaRepository<CycleLog, UUID> {
    List<CycleLog> findByUserIdOrderByTimestampDesc(UUID userId);

    Optional<CycleLog> findByIdAndUserId(UUID id, UUID userId);
}

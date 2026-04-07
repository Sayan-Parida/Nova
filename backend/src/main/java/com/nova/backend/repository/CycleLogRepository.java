package com.nova.backend.repository;

import com.nova.backend.entity.CycleLog;
import com.nova.backend.entity.DataType;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface CycleLogRepository extends JpaRepository<CycleLog, UUID> {
    List<CycleLog> findByUserIdOrderByTimestampDesc(UUID userId);

    Optional<CycleLog> findByIdAndUserId(UUID id, UUID userId);

    Optional<CycleLog> findByUserIdAndDataTypeAndLogDate(UUID userId, DataType dataType, LocalDate logDate);
}

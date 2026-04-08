package com.nova.backend.repository;

import com.nova.backend.entity.CycleLog;
import com.nova.backend.entity.DataType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface CycleLogRepository extends JpaRepository<CycleLog, UUID> {
    List<CycleLog> findByUserIdOrderByTimestampDesc(UUID userId);

    Page<CycleLog> findByUserIdOrderByTimestampDesc(UUID userId, Pageable pageable);

    Optional<CycleLog> findByIdAndUserId(UUID id, UUID userId);

    Optional<CycleLog> findByUserIdAndDataTypeAndLogDate(UUID userId, DataType dataType, LocalDate logDate);

    long deleteByUserId(UUID userId);
}

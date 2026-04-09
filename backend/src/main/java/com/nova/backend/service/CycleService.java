package com.nova.backend.service;

import com.nova.backend.dto.CycleLogRequest;
import com.nova.backend.dto.CycleLogResponse;
import com.nova.backend.entity.CycleLog;
import com.nova.backend.entity.DataType;
import com.nova.backend.entity.User;
import com.nova.backend.exception.BadRequestException;
import com.nova.backend.exception.ResourceNotFoundException;
import com.nova.backend.exception.UnauthorizedException;
import com.nova.backend.repository.CycleLogRepository;
import com.nova.backend.repository.UserRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.Base64;
import java.util.List;
import java.util.UUID;

@Service
public class CycleService {

    private final CycleLogRepository cycleLogRepository;
    private final UserRepository userRepository;
    private final TimezoneResolverService timezoneResolverService;

    public CycleService(
            CycleLogRepository cycleLogRepository,
            UserRepository userRepository,
            TimezoneResolverService timezoneResolverService
    ) {
        this.cycleLogRepository = cycleLogRepository;
        this.userRepository = userRepository;
        this.timezoneResolverService = timezoneResolverService;
    }

    public CycleLogResponse createLog(UUID authenticatedUserId, CycleLogRequest request, String timezoneOffsetHeader) {
        User user = userRepository.findById(authenticatedUserId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found."));

        byte[] encryptedBytes = decodeEncryptedData(request.encryptedData());
        LocalDate logDate = resolveAndValidateLogDate(request, timezoneOffsetHeader);

        if (request.dataType() == DataType.CYCLE && logDate != null) {
            CycleLog existing = cycleLogRepository
                    .findByUserIdAndDataTypeAndLogDate(authenticatedUserId, DataType.CYCLE, logDate)
                    .orElse(null);

            if (existing != null) {
                existing.setEncryptedData(encryptedBytes);
                existing.setDataType(DataType.CYCLE);
                existing.setLogDate(logDate);
                return toResponse(cycleLogRepository.save(existing));
            }
        }

        CycleLog cycleLog = new CycleLog();
        cycleLog.setUser(user);
        cycleLog.setEncryptedData(encryptedBytes);
        cycleLog.setDataType(request.dataType());
        cycleLog.setLogDate(logDate);

        CycleLog saved = cycleLogRepository.save(cycleLog);
        return toResponse(saved);
    }

    public CycleLogResponse updateLog(UUID logId, UUID authenticatedUserId, CycleLogRequest request, String timezoneOffsetHeader) {
        CycleLog existing = cycleLogRepository.findByIdAndUserId(logId, authenticatedUserId)
                .orElseThrow(() -> new ResourceNotFoundException("Cycle log not found."));

        byte[] encryptedBytes = decodeEncryptedData(request.encryptedData());
        LocalDate logDate = resolveAndValidateLogDate(request, timezoneOffsetHeader);

        if (request.dataType() == DataType.CYCLE && logDate != null) {
            CycleLog sameDayLog = cycleLogRepository
                    .findByUserIdAndDataTypeAndLogDate(authenticatedUserId, DataType.CYCLE, logDate)
                    .orElse(null);

            if (sameDayLog != null && !sameDayLog.getId().equals(existing.getId())) {
                throw new BadRequestException("Only one cycle log is allowed per day.");
            }
        }

        existing.setEncryptedData(encryptedBytes);
        existing.setDataType(request.dataType());
        existing.setLogDate(logDate);

        return toResponse(cycleLogRepository.save(existing));
    }

    public List<CycleLogResponse> getLogsByUser(UUID requestedUserId, UUID authenticatedUserId, int page, int size) {
        if (!requestedUserId.equals(authenticatedUserId)) {
            throw new UnauthorizedException("You can only access your own encrypted logs.");
        }

        int safePage = Math.max(page, 0);
        int safeSize = Math.max(1, Math.min(size, 100));

        return cycleLogRepository.findByUserIdOrderByTimestampDesc(requestedUserId, PageRequest.of(safePage, safeSize))
                .stream()
                .map(this::toResponse)
                .toList();
    }

    public void deleteLog(UUID logId, UUID authenticatedUserId) {
        CycleLog log = cycleLogRepository.findByIdAndUserId(logId, authenticatedUserId)
                .orElseThrow(() -> new ResourceNotFoundException("Cycle log not found."));
        cycleLogRepository.delete(log);
    }

    public long deleteAllLogsByUser(UUID requestedUserId, UUID authenticatedUserId) {
        if (!requestedUserId.equals(authenticatedUserId)) {
            throw new UnauthorizedException("You can only delete your own encrypted logs.");
        }

        return cycleLogRepository.deleteByUserId(requestedUserId);
    }

    private CycleLogResponse toResponse(CycleLog cycleLog) {
        return new CycleLogResponse(
                cycleLog.getId(),
                cycleLog.getUser().getId(),
                Base64.getEncoder().encodeToString(cycleLog.getEncryptedData()),
                cycleLog.getTimestamp(),
                cycleLog.getDataType(),
                cycleLog.getLogDate()
        );
    }

    private byte[] decodeEncryptedData(String encryptedData) {
        try {
            return Base64.getDecoder().decode(encryptedData);
        } catch (IllegalArgumentException ex) {
            throw new BadRequestException("encryptedData must be valid Base64.");
        }
    }

    private LocalDate resolveAndValidateLogDate(CycleLogRequest request, String timezoneOffsetHeader) {
        if (request.dataType() != DataType.CYCLE) {
            return parseOptionalLogDate(request.logDate(), timezoneOffsetHeader);
        }

        if (request.logDate() == null || request.logDate().isBlank()) {
            throw new BadRequestException("logDate is required for cycle logs.");
        }

        LocalDate resolvedToday = timezoneResolverService.resolveToday(timezoneOffsetHeader);
        LocalDate requestDate = parseDate(request.logDate(), resolvedToday);

        if (!requestDate.equals(resolvedToday)) {
            throw new BadRequestException("Cycle logs are only allowed for today's date in your local timezone.");
        }

        return requestDate;
    }

    private LocalDate parseOptionalLogDate(String value, String timezoneOffsetHeader) {
        if (value == null || value.isBlank()) {
            return null;
        }

        return parseDate(value, timezoneResolverService.resolveToday(timezoneOffsetHeader));
    }

    private LocalDate parseDate(String value, LocalDate maxAllowedDate) {
        try {
            LocalDate parsed = LocalDate.parse(value);
            if (parsed.isAfter(maxAllowedDate)) {
                throw new BadRequestException("logDate cannot be in the future.");
            }
            return parsed;
        } catch (Exception ex) {
            if (ex instanceof BadRequestException badRequestException) {
                throw badRequestException;
            }
            throw new BadRequestException("logDate must be a valid ISO date (YYYY-MM-DD).");
        }
    }
}

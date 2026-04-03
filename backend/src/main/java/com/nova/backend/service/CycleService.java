package com.nova.backend.service;

import com.nova.backend.dto.CycleLogRequest;
import com.nova.backend.dto.CycleLogResponse;
import com.nova.backend.entity.CycleLog;
import com.nova.backend.entity.User;
import com.nova.backend.exception.BadRequestException;
import com.nova.backend.exception.ResourceNotFoundException;
import com.nova.backend.exception.UnauthorizedException;
import com.nova.backend.repository.CycleLogRepository;
import com.nova.backend.repository.UserRepository;
import org.springframework.stereotype.Service;

import java.util.Base64;
import java.util.List;
import java.util.UUID;

@Service
public class CycleService {

    private final CycleLogRepository cycleLogRepository;
    private final UserRepository userRepository;

    public CycleService(CycleLogRepository cycleLogRepository, UserRepository userRepository) {
        this.cycleLogRepository = cycleLogRepository;
        this.userRepository = userRepository;
    }

    public CycleLogResponse createLog(UUID authenticatedUserId, CycleLogRequest request) {
        User user = userRepository.findById(authenticatedUserId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found."));

        byte[] encryptedBytes;
        try {
            encryptedBytes = Base64.getDecoder().decode(request.encryptedData());
        } catch (IllegalArgumentException ex) {
            throw new BadRequestException("encryptedData must be valid Base64.");
        }

        CycleLog cycleLog = new CycleLog();
        cycleLog.setUser(user);
        cycleLog.setEncryptedData(encryptedBytes);
        cycleLog.setDataType(request.dataType());

        CycleLog saved = cycleLogRepository.save(cycleLog);
        return toResponse(saved);
    }

    public List<CycleLogResponse> getLogsByUser(UUID requestedUserId, UUID authenticatedUserId) {
        if (!requestedUserId.equals(authenticatedUserId)) {
            throw new UnauthorizedException("You can only access your own encrypted logs.");
        }

        return cycleLogRepository.findByUserIdOrderByTimestampDesc(requestedUserId)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    public void deleteLog(UUID logId, UUID authenticatedUserId) {
        CycleLog log = cycleLogRepository.findByIdAndUserId(logId, authenticatedUserId)
                .orElseThrow(() -> new ResourceNotFoundException("Cycle log not found."));
        cycleLogRepository.delete(log);
    }

    private CycleLogResponse toResponse(CycleLog cycleLog) {
        return new CycleLogResponse(
                cycleLog.getId(),
                cycleLog.getUser().getId(),
                Base64.getEncoder().encodeToString(cycleLog.getEncryptedData()),
                cycleLog.getTimestamp(),
                cycleLog.getDataType()
        );
    }
}

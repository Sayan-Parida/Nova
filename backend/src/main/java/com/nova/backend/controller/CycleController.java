package com.nova.backend.controller;

import com.nova.backend.dto.CycleLogRequest;
import com.nova.backend.dto.CycleLogResponse;
import com.nova.backend.security.AuthenticatedUser;
import com.nova.backend.service.CycleService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/cycles")
public class CycleController {

    private final CycleService cycleService;

    public CycleController(CycleService cycleService) {
        this.cycleService = cycleService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public CycleLogResponse createCycleLog(
            @Valid @RequestBody CycleLogRequest request,
            @RequestHeader(value = "X-Timezone-Offset", required = false) String timezoneOffset,
            Authentication authentication
    ) {
        AuthenticatedUser principal = (AuthenticatedUser) authentication.getPrincipal();
        return cycleService.createLog(principal.userId(), request, timezoneOffset);
    }

    @PutMapping("/{id}")
    public CycleLogResponse updateCycleLog(
            @PathVariable UUID id,
            @Valid @RequestBody CycleLogRequest request,
            @RequestHeader(value = "X-Timezone-Offset", required = false) String timezoneOffset,
            Authentication authentication
    ) {
        AuthenticatedUser principal = (AuthenticatedUser) authentication.getPrincipal();
        return cycleService.updateLog(id, principal.userId(), request, timezoneOffset);
    }

    @GetMapping("/{userId}")
    public List<CycleLogResponse> getCycleLogs(@PathVariable UUID userId, Authentication authentication) {
        AuthenticatedUser principal = (AuthenticatedUser) authentication.getPrincipal();
        return cycleService.getLogsByUser(userId, principal.userId());
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteCycleLog(@PathVariable UUID id, Authentication authentication) {
        AuthenticatedUser principal = (AuthenticatedUser) authentication.getPrincipal();
        cycleService.deleteLog(id, principal.userId());
    }
}

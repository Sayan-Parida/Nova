package com.nova.backend.dto;

public record AuthResponse(
        String token,
        String accessToken,
        long expiresInSeconds
) {
}

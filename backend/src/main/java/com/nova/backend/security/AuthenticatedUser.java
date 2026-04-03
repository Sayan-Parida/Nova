package com.nova.backend.security;

import java.util.UUID;

public record AuthenticatedUser(
        UUID userId,
        String email
) {
}

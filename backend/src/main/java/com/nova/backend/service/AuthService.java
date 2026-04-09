package com.nova.backend.service;

import com.nova.backend.dto.LoginRequest;
import com.nova.backend.dto.RegisterRequest;
import com.nova.backend.entity.RefreshToken;
import com.nova.backend.entity.User;
import com.nova.backend.exception.BadRequestException;
import com.nova.backend.exception.ConflictException;
import com.nova.backend.exception.UnauthorizedException;
import com.nova.backend.repository.RefreshTokenRepository;
import com.nova.backend.repository.UserRepository;
import com.nova.backend.security.JwtUtil;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.Base64;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;

@Service
public class AuthService {

    private final UserRepository userRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;
    private final long refreshExpirationMs;

    public AuthService(
            UserRepository userRepository,
            RefreshTokenRepository refreshTokenRepository,
            PasswordEncoder passwordEncoder,
            JwtUtil jwtUtil,
                @Value("${app.jwt.refresh-expiration-ms}") long refreshExpirationMs
    ) {
        this.userRepository = userRepository;
        this.refreshTokenRepository = refreshTokenRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtUtil = jwtUtil;
        this.refreshExpirationMs = refreshExpirationMs;
    }

    @Transactional
    public TokenPair register(RegisterRequest request) {
        String normalizedEmail = request.email().trim().toLowerCase();
        if (userRepository.existsByEmail(normalizedEmail)) {
            throw new ConflictException("Email already registered.");
        }

        User user = new User();
        user.setEmail(normalizedEmail);
        user.setPasswordHash(passwordEncoder.encode(request.password()));
        user.setTimezone(request.timezone() == null || request.timezone().isBlank() ? null : request.timezone().trim());

        User savedUser;
        try {
            savedUser = userRepository.save(user);
        } catch (DataIntegrityViolationException ex) {
            throw new ConflictException("Email already registered.");
        }

        return issueTokenPair(savedUser);
    }

    @Transactional
    public TokenPair login(LoginRequest request) {
        String normalizedEmail = request.email().trim().toLowerCase();
        User user = userRepository.findByEmail(normalizedEmail)
                .orElseThrow(() -> new UnauthorizedException("Invalid email or password."));

        if (!passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            throw new UnauthorizedException("Invalid email or password.");
        }

        return issueTokenPair(user);
    }

    @Transactional
    public TokenPair refresh(String refreshTokenValue) {
        if (refreshTokenValue == null || refreshTokenValue.isBlank()) {
            throw new UnauthorizedException("Refresh token is missing.");
        }

        String refreshTokenHash = sha256Hex(refreshTokenValue);
        RefreshToken refreshToken = refreshTokenRepository
                .findByTokenHashAndRevokedFalseAndExpiresAtAfter(refreshTokenHash, Instant.now())
                .orElseThrow(() -> new UnauthorizedException("Refresh token is invalid or expired."));

        refreshToken.setRevoked(true);
        refreshTokenRepository.save(refreshToken);

        return issueTokenPair(refreshToken.getUser());
    }

    @Transactional
    public void logout(UUID userId) {
        refreshTokenRepository.revokeAllActiveForUser(userId);
    }

    private TokenPair issueTokenPair(User user) {
        String accessToken = jwtUtil.generateToken(user.getId(), user.getEmail());
        String refreshTokenValue = generateOpaqueToken();

        RefreshToken refreshToken = new RefreshToken();
        refreshToken.setUser(user);
        refreshToken.setTokenHash(sha256Hex(refreshTokenValue));
        refreshToken.setExpiresAt(Instant.now().plusMillis(refreshExpirationMs));
        refreshToken.setRevoked(false);
        refreshTokenRepository.save(refreshToken);

        return new TokenPair(accessToken, refreshTokenValue, jwtUtil.getExpirationMs() / 1000);
    }

    private String generateOpaqueToken() {
        byte[] buffer = new byte[48];
        ThreadLocalRandom.current().nextBytes(buffer);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(buffer);
    }

    private String sha256Hex(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(value.getBytes(StandardCharsets.UTF_8));
            StringBuilder builder = new StringBuilder(hash.length * 2);
            for (byte b : hash) {
                builder.append(String.format("%02x", b));
            }
            return builder.toString();
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException("SHA-256 not available", ex);
        }
    }

    public record TokenPair(
            String accessToken,
            String refreshToken,
            long expiresInSeconds
    ) {
    }
}

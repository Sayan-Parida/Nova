package com.nova.backend.controller;

import com.nova.backend.dto.AuthResponse;
import com.nova.backend.dto.LoginRequest;
import com.nova.backend.dto.RegisterRequest;
import com.nova.backend.security.AuthenticatedUser;
import com.nova.backend.service.AuthService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;
    private final boolean refreshCookieSecure;

    public AuthController(AuthService authService, @Value("${app.auth.refresh-cookie-secure:false}") boolean refreshCookieSecure) {
        this.authService = authService;
        this.refreshCookieSecure = refreshCookieSecure;
    }

    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    public ResponseEntity<AuthResponse> register(@Valid @RequestBody RegisterRequest request) {
        AuthService.TokenPair tokens = authService.register(request);
        return buildAuthResponse(tokens, HttpStatus.CREATED);
    }

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@Valid @RequestBody LoginRequest request) {
        AuthService.TokenPair tokens = authService.login(request);
        return buildAuthResponse(tokens, HttpStatus.OK);
    }

    @PostMapping("/refresh")
    public ResponseEntity<AuthResponse> refresh(
            @CookieValue(name = "refresh_token", required = false) String refreshToken
    ) {
        AuthService.TokenPair tokens = authService.refresh(refreshToken);
        return buildAuthResponse(tokens, HttpStatus.OK);
    }

    @PostMapping("/logout")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public ResponseEntity<Void> logout(Authentication authentication) {
        if (authentication != null && authentication.getPrincipal() instanceof AuthenticatedUser principal) {
            authService.logout(principal.userId());
        }

        ResponseCookie clearCookie = ResponseCookie.from("refresh_token", "")
                .httpOnly(true)
                .secure(refreshCookieSecure)
                .sameSite("Lax")
                .path("/api/auth")
                .maxAge(0)
                .build();

        return ResponseEntity.noContent()
                .header(HttpHeaders.SET_COOKIE, clearCookie.toString())
                .build();
    }

    private ResponseEntity<AuthResponse> buildAuthResponse(AuthService.TokenPair tokenPair, HttpStatus status) {
        ResponseCookie refreshCookie = ResponseCookie.from("refresh_token", tokenPair.refreshToken())
                .httpOnly(true)
                .secure(refreshCookieSecure)
                .sameSite("Lax")
                .path("/api/auth")
                .maxAge(60L * 60L * 24L * 7L)
                .build();

        AuthResponse body = new AuthResponse(tokenPair.accessToken(), tokenPair.accessToken(), tokenPair.expiresInSeconds());

        return ResponseEntity.status(status)
                .header(HttpHeaders.SET_COOKIE, refreshCookie.toString())
                .body(body);
    }
}

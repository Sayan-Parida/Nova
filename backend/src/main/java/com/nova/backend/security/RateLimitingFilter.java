package com.nova.backend.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import com.nova.backend.exception.TooManyRequestsException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Duration;
import java.time.Instant;

@Component
public class RateLimitingFilter extends OncePerRequestFilter {

    private final RequestRateLimiterService rateLimiterService;

    public RateLimitingFilter(RequestRateLimiterService rateLimiterService) {
        this.rateLimiterService = rateLimiterService;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        try {
            String path = request.getRequestURI();

            if (isAuthEndpoint(path)) {
                String ip = resolveClientIp(request);
                rateLimiterService.assertWithinLimit("auth:" + ip + ":" + path, 5, Duration.ofMinutes(1));
            }

            if (path.startsWith("/api/cycles")) {
                String userKey = resolveUserKey(request);
                rateLimiterService.assertWithinLimit("cycles:" + userKey, 60, Duration.ofMinutes(1));
            }

            filterChain.doFilter(request, response);
        } catch (TooManyRequestsException ex) {
            response.setStatus(429);
            response.setContentType("application/json");
            response.getWriter().write("{\"timestamp\":\"" + Instant.now() + "\",\"status\":429,\"error\":\"Too Many Requests\",\"message\":\"" + ex.getMessage() + "\"}");
        }
    }

    private boolean isAuthEndpoint(String path) {
        return "/api/auth/register".equals(path) || "/api/auth/login".equals(path);
    }

    private String resolveClientIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            return forwarded.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }

    private String resolveUserKey(HttpServletRequest request) {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null && authentication.getPrincipal() instanceof AuthenticatedUser user) {
            return user.userId().toString();
        }

        return resolveClientIp(request);
    }
}

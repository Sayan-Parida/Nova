package com.nova.backend.security;

import com.nova.backend.exception.TooManyRequestsException;
import com.nova.backend.entity.RateLimitBucket;
import com.nova.backend.repository.RateLimitBucketRepository;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;

@Service
public class RequestRateLimiterService {

    private final RateLimitBucketRepository rateLimitBucketRepository;

    public RequestRateLimiterService(RateLimitBucketRepository rateLimitBucketRepository) {
        this.rateLimitBucketRepository = rateLimitBucketRepository;
    }

    @Transactional
    public void assertWithinLimit(String key, int maxRequests, Duration window) {
        Instant now = Instant.now();
        Instant bucketStart = now.truncatedTo(ChronoUnit.MINUTES);

        rateLimitBucketRepository.deleteExpiredBuckets(now.minus(window.multipliedBy(2)));

        RateLimitBucket bucket = rateLimitBucketRepository
                .findByBucketKeyAndWindowStart(key, bucketStart)
                .orElseGet(() -> {
                    RateLimitBucket created = new RateLimitBucket();
                    created.setBucketKey(key);
                    created.setWindowStart(bucketStart);
                    created.setRequestCount(0);
                    created.setExpiresAt(bucketStart.plus(window).plusSeconds(60));
                    return created;
                });

        if (bucket.getRequestCount() >= maxRequests) {
            throw new TooManyRequestsException("Rate limit exceeded. Please try again shortly.");
        }

        bucket.setRequestCount(bucket.getRequestCount() + 1);
        bucket.setUpdatedAt(now);
        bucket.setExpiresAt(bucketStart.plus(window).plusSeconds(60));

        rateLimitBucketRepository.save(bucket);
    }
}

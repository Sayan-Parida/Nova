package com.nova.backend.repository;

import com.nova.backend.entity.RateLimitBucket;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import jakarta.persistence.LockModeType;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

public interface RateLimitBucketRepository extends JpaRepository<RateLimitBucket, UUID> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    Optional<RateLimitBucket> findByBucketKeyAndWindowStart(String bucketKey, Instant windowStart);

    @Modifying
    @Query("delete from RateLimitBucket bucket where bucket.expiresAt < :now")
    int deleteExpiredBuckets(Instant now);
}

package com.travel.ai.ai;

import com.travel.ai.config.AppProperties;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Duration;
import java.util.*;
import java.util.concurrent.Semaphore;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;
import java.util.function.Supplier;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Flux;

/** LLM 调用统一入口：限流、并发保护、流式超时、LRU 缓存和运行时指标。 */
@Service
public class AiGateway {
  private final AppProperties.Ai config; private final Semaphore semaphore; private final Map<String, Bucket> buckets = new HashMap<>();
  private final LruCache cache; private final AtomicLong total = new AtomicLong(), success = new AtomicLong(), failed = new AtomicLong(), hits = new AtomicLong(), limited = new AtomicLong(), timedOut = new AtomicLong(), rejected = new AtomicLong(), latency = new AtomicLong(); private final AtomicInteger active = new AtomicInteger(); private final long startedAt = System.currentTimeMillis();
  public AiGateway(AppProperties properties) { this.config = properties.ai(); this.semaphore = new Semaphore(config.maxConcurrency()); this.cache = new LruCache(config.cacheMax(), config.cacheTtlMs()); }
  public Flux<String> stream(String rateKey, String cacheKey, Supplier<Flux<String>> call) {
    return Flux.defer(() -> {
      total.incrementAndGet(); long start = System.currentTimeMillis(); BucketDecision decision = acquireToken(rateKey);
      if (!decision.allowed) { limited.incrementAndGet(); return Flux.error(new GatewayException("请求过于频繁，请 " + decision.retryAfter + " 秒后再试", 429)); }
      if (!semaphore.tryAcquire()) { rejected.incrementAndGet(); return Flux.error(new GatewayException("当前生成请求过多，请稍后再试", 503)); }
      active.incrementAndGet();
      String cached = cacheKey == null ? null : cache.get(cacheKey);
      Flux<String> result = cached != null ? cachedChunks(cached) : call.get().timeout(Duration.ofMillis(config.stallMs())).timeout(Duration.ofMillis(config.timeoutMs())).doOnComplete(() -> {});
      if (cached != null) hits.incrementAndGet();
      StringBuilder full = new StringBuilder();
      return result.doOnNext(full::append).doOnComplete(() -> { if (cached == null && cacheKey != null && !full.isEmpty()) cache.put(cacheKey, full.toString()); success.incrementAndGet(); latency.addAndGet(System.currentTimeMillis() - start); })
          .doOnError(err -> { failed.incrementAndGet(); if (err instanceof java.util.concurrent.TimeoutException) timedOut.incrementAndGet(); })
          .onErrorMap(err -> err instanceof GatewayException ? err : new GatewayException(err instanceof java.util.concurrent.TimeoutException ? "模型响应超时或长时间无数据" : "模型调用失败：" + err.getMessage(), err instanceof java.util.concurrent.TimeoutException ? 504 : 502))
          .doFinally(signal -> { active.decrementAndGet(); semaphore.release(); });
    });
  }
  private Flux<String> cachedChunks(String text) { List<String> parts = new ArrayList<>(); for (int i=0;i<text.length();i+=24) parts.add(text.substring(i,Math.min(text.length(),i+24))); return Flux.fromIterable(parts).delayElements(Duration.ofMillis(12)); }
  private synchronized BucketDecision acquireToken(String key) { long now=System.currentTimeMillis(); Bucket b=buckets.computeIfAbsent(key,k -> new Bucket(config.rateCapacity(),now)); double elapsed=(now-b.updatedAt)/1000d; b.tokens=Math.min(config.rateCapacity(),b.tokens+elapsed*config.rateRefillPerSec()); b.updatedAt=now; if(b.tokens>=1){b.tokens--;return new BucketDecision(true,0);} return new BucketDecision(false,(long)Math.ceil((1-b.tokens)/config.rateRefillPerSec())); }
  public Map<String,Object> metrics() { Map<String,Object> data=new LinkedHashMap<>(); data.put("totalRequests",total.get());data.put("successCount",success.get());data.put("failureCount",failed.get());data.put("cacheHits",hits.get());data.put("rateLimitedCount",limited.get());data.put("timeoutCount",timedOut.get());data.put("concurrencyRejectedCount",rejected.get());data.put("activeCount",active.get());data.put("avgLatencyMs",success.get()==0?0:latency.get()/success.get());data.put("uptimeSec",(System.currentTimeMillis()-startedAt)/1000);data.put("config",Map.of("maxConcurrency",config.maxConcurrency(),"timeoutMs",config.timeoutMs(),"cacheMax",config.cacheMax()));return data; }
  public static String hash(String value) { try { byte[] bytes=MessageDigest.getInstance("MD5").digest(value.getBytes(StandardCharsets.UTF_8)); StringBuilder out=new StringBuilder();for(byte b:bytes)out.append(String.format("%02x",b));return out.toString(); }catch(Exception e){throw new IllegalStateException(e);} }
  private static final class Bucket { double tokens; long updatedAt; Bucket(double t,long time){tokens=t;updatedAt=time;} } private record BucketDecision(boolean allowed,long retryAfter) {}
  private static final class LruCache { private final int max; private final long ttl; private final LinkedHashMap<String,Entry> entries=new LinkedHashMap<>(16,.75f,true); LruCache(int max,long ttl){this.max=max;this.ttl=ttl;} synchronized String get(String key){Entry e=entries.get(key);if(e==null)return null;if(e.expiresAt<System.currentTimeMillis()){entries.remove(key);return null;}return e.value;} synchronized void put(String key,String value){entries.put(key,new Entry(value,System.currentTimeMillis()+ttl));while(entries.size()>max)entries.remove(entries.keySet().iterator().next());} private record Entry(String value,long expiresAt){} }
}

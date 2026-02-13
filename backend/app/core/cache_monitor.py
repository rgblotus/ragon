"""
Cache Monitoring and Metrics Collection for Olivia Backend
Provides comprehensive monitoring, alerting, and performance analysis for the caching system.
"""

import time
import threading
import logging
from typing import Dict, List, Any, Optional, Callable
from datetime import datetime, timedelta
from collections import defaultdict, deque
import json

from app.core.cache_service import cache_service
from app.rag.service import rag_service
from app.rag.config import settings
from app.core.logging_config import performance_logger

logger = logging.getLogger(__name__)


class CacheMonitor:
    """Comprehensive cache monitoring and metrics collection system."""

    def __init__(self):
        self.metrics_history = deque(maxlen=1000)  # Keep last 1000 metric snapshots
        self.alerts = []
        self.alert_callbacks = []
        self.monitoring_active = False
        self.monitor_thread = None
        self.collection_interval = getattr(
            settings, "CACHE_MONITORING_INTERVAL", 60
        )  # seconds
        self.alert_thresholds = {
            "hit_rate_low": 0.1,  # Alert if hit rate drops below 10% (less aggressive)
            "error_rate_high": 0.1,  # Alert if error rate exceeds 10%
            "memory_usage_high": 0.8,  # Alert if memory usage exceeds 80%
            "response_time_high": 0.1,  # Alert if avg response time exceeds 100ms
        }

    def start_monitoring(self):
        """Start background monitoring."""
        if self.monitoring_active:
            return

        self.monitoring_active = True
        self.monitor_thread = threading.Thread(
            target=self._monitoring_loop, daemon=True
        )
        self.monitor_thread.start()
        logger.info("Cache monitoring started")

    def stop_monitoring(self):
        """Stop background monitoring."""
        self.monitoring_active = False
        if self.monitor_thread:
            self.monitor_thread.join(timeout=5)
        logger.info("Cache monitoring stopped")

    def _monitoring_loop(self):
        """Main monitoring loop."""
        while self.monitoring_active:
            try:
                self._collect_metrics()
                self._check_alerts()
                time.sleep(self.collection_interval)
            except Exception as e:
                logger.error(f"Error in monitoring loop: {e}")
                time.sleep(self.collection_interval)

    def _collect_metrics(self):
        """Collect comprehensive cache metrics."""
        try:
            timestamp = time.time()

            # Get cache service metrics
            cache_stats = cache_service.get_stats()

            # Get RAG service specific metrics
            rag_stats = rag_service.get_cache_stats()

            # System metrics
            system_stats = self._get_system_stats()

            # Combine all metrics
            metrics_snapshot = {
                "timestamp": timestamp,
                "cache": cache_stats,
                "rag": rag_stats,
                "system": system_stats,
                "derived_metrics": self._calculate_derived_metrics(
                    cache_stats, rag_stats
                ),
            }

            self.metrics_history.append(metrics_snapshot)

            # Log summary
            self._log_metrics_summary(metrics_snapshot)

        except Exception as e:
            logger.error(f"Error collecting metrics: {e}")

    def _get_system_stats(self) -> Dict[str, Any]:
        """Get system-level statistics."""
        try:
            import psutil

            return {
                "cpu_percent": psutil.cpu_percent(interval=1),
                "memory_percent": psutil.virtual_memory().percent,
                "memory_used_mb": psutil.virtual_memory().used / 1024 / 1024,
                "memory_available_mb": psutil.virtual_memory().available / 1024 / 1024,
                "disk_usage_percent": psutil.disk_usage("/").percent,
            }
        except ImportError:
            logger.warning("psutil not available, skipping system stats")
            return {}
        except Exception as e:
            logger.error(f"Error getting system stats: {e}")
            return {}

    def _calculate_derived_metrics(
        self, cache_stats: Dict, rag_stats: Dict
    ) -> Dict[str, Any]:
        """Calculate derived metrics from raw stats."""
        derived = {}

        try:
            # Overall cache efficiency
            overall_hit_rate = cache_stats.get("metrics", {}).get("hit_rate", 0)
            derived["cache_efficiency_score"] = overall_hit_rate

            # Memory cache efficiency
            memory_info = cache_stats.get("memory", {})
            ttl_size = memory_info.get("ttl_size", 0)
            lru_size = memory_info.get("lru_size", 0)
            derived["memory_cache_entries"] = ttl_size + lru_size

            # Cache operation totals
            metrics = cache_stats.get("metrics", {})
            derived["total_hits"] = metrics.get("hits", 0)
            derived["total_misses"] = metrics.get("misses", 0)
            derived["total_sets"] = metrics.get("sets", 0)

            return derived

            # Error rate (not tracked in new cache service)
            derived["error_rate"] = 0

            # Performance trend (compare with previous snapshot)
            if len(self.metrics_history) > 1:
                prev_snapshot = self.metrics_history[-2]
                prev_hit_rate = (
                    prev_snapshot.get("cache", {}).get("metrics", {}).get("hit_rate", 0)
                )
                current_hit_rate = overall_hit_rate

                if prev_hit_rate > 0:
                    derived["hit_rate_trend"] = (
                        current_hit_rate - prev_hit_rate
                    ) / prev_hit_rate
                else:
                    derived["hit_rate_trend"] = 0

        except Exception as e:
            logger.error(f"Error calculating derived metrics: {e}")

        return derived

    def _check_alerts(self):
        """Check for alert conditions."""
        if not self.metrics_history:
            return

        latest = self.metrics_history[-1]

        alerts_triggered = []

        # Check hit rate (only if we have significant operations)
        total_ops = (
            latest.get("redis", {})
            .get("overall_metrics", {})
            .get("total_operations", 0)
        )
        hit_rate = (
            latest.get("redis", {}).get("overall_metrics", {}).get("hit_rate", 1.0)
        )

        # Only alert on hit rate if we have at least 10 operations to establish a pattern
        if total_ops >= 10 and hit_rate < self.alert_thresholds["hit_rate_low"]:
            alerts_triggered.append(
                {
                    "type": "hit_rate_low",
                    "message": f"Cache hit rate dropped to {hit_rate:.2%} (after {total_ops} operations)",
                    "severity": "warning",
                    "value": hit_rate,
                    "threshold": self.alert_thresholds["hit_rate_low"],
                }
            )

        # Check error rate
        error_rate = latest.get("derived_metrics", {}).get("error_rate", 0)
        if error_rate > self.alert_thresholds["error_rate_high"]:
            alerts_triggered.append(
                {
                    "type": "error_rate_high",
                    "message": f"Cache error rate rose to {error_rate:.2%}",
                    "severity": "error",
                    "value": error_rate,
                    "threshold": self.alert_thresholds["error_rate_high"],
                }
            )

        # Check Redis memory usage
        redis_memory_str = (
            latest.get("redis", {})
            .get("redis_stats", {})
            .get("used_memory_human", "0B")
        )
        try:
            if "G" in redis_memory_str:
                memory_gb = float(redis_memory_str.replace("G", ""))
                memory_mb = memory_gb * 1024
            elif "M" in redis_memory_str:
                memory_mb = float(redis_memory_str.replace("M", ""))
            else:
                memory_mb = 0.1
        except:
            memory_mb = 0.1

        # Use a reasonable threshold for Redis memory (500MB)
        max_memory_mb = 500
        memory_percent = memory_mb / max_memory_mb

        if memory_percent > self.alert_thresholds["memory_usage_high"]:
            alerts_triggered.append(
                {
                    "type": "redis_memory_usage_high",
                    "message": f"Redis memory usage at {memory_percent:.1%} ({memory_mb:.1f}MB)",
                    "severity": "warning",
                    "value": memory_percent,
                    "threshold": self.alert_thresholds["memory_usage_high"],
                }
            )

        # Check response time
        avg_response_time = (
            latest.get("redis", {})
            .get("overall_metrics", {})
            .get("avg_response_time", 0)
        )
        if avg_response_time > self.alert_thresholds["response_time_high"]:
            alerts_triggered.append(
                {
                    "type": "response_time_high",
                    "message": f"Average cache response time is {avg_response_time * 1000:.1f}ms",
                    "severity": "warning",
                    "value": avg_response_time,
                    "threshold": self.alert_thresholds["response_time_high"],
                }
            )

        # Trigger alerts
        for alert in alerts_triggered:
            self._trigger_alert(alert)

    def _trigger_alert(self, alert: Dict[str, Any]):
        """Trigger an alert."""
        alert_with_timestamp = {**alert, "timestamp": time.time()}
        self.alerts.append(alert_with_timestamp)

        # Keep only recent alerts (last 100)
        if len(self.alerts) > 100:
            self.alerts.pop(0)

        # Log alert
        logger.warning(f"CACHE ALERT: {alert['message']}")

        # Call alert callbacks
        for callback in self.alert_callbacks:
            try:
                callback(alert_with_timestamp)
            except Exception as e:
                logger.error(f"Error in alert callback: {e}")

    def add_alert_callback(self, callback: Callable[[Dict[str, Any]], None]):
        """Add a callback for alerts."""
        self.alert_callbacks.append(callback)

    def _log_metrics_summary(self, metrics: Dict[str, Any]):
        """Log a summary of current metrics."""
        try:
            redis_stats = metrics.get("redis", {})
            overall = redis_stats.get("overall_metrics", {})

            summary = {
                "hit_rate": overall.get("hit_rate", 0),
                "total_ops": overall.get("total_operations", 0),
                "avg_response_time_ms": overall.get("avg_response_time", 0) * 1000,
                "redis_memory": redis_stats.get("redis_stats", {}).get(
                    "used_memory_human", "0B"
                ),
                "errors": overall.get("errors", 0),
            }

            logger.info(
                f"Cache metrics: hit_rate={summary['hit_rate']:.1%}, "
                f"ops={summary['total_ops']}, "
                f"avg_time={summary['avg_response_time_ms']:.1f}ms, "
                f"redis_memory={summary['redis_memory']}, "
                f"errors={summary['errors']}"
            )

        except Exception as e:
            logger.error(f"Error logging metrics summary: {e}")

    def get_metrics_history(self, hours: int = 1) -> List[Dict[str, Any]]:
        """Get metrics history for the specified time period."""
        cutoff_time = time.time() - (hours * 3600)
        return [m for m in self.metrics_history if m["timestamp"] > cutoff_time]

    def get_current_metrics(self) -> Dict[str, Any]:
        """Get the most recent metrics snapshot."""
        return self.metrics_history[-1] if self.metrics_history else {}

    def get_alerts(self, hours: int = 24) -> List[Dict[str, Any]]:
        """Get recent alerts."""
        cutoff_time = time.time() - (hours * 3600)
        return [a for a in self.alerts if a["timestamp"] > cutoff_time]

    def export_metrics(self, filepath: str):
        """Export metrics history to JSON file."""
        try:
            with open(filepath, "w") as f:
                json.dump(list(self.metrics_history), f, indent=2, default=str)
            logger.info(f"Metrics exported to {filepath}")
        except Exception as e:
            logger.error(f"Error exporting metrics: {e}")

    def get_performance_report(self) -> Dict[str, Any]:
        """Generate a comprehensive performance report."""
        if not self.metrics_history:
            return {"error": "No metrics available"}

        try:
            # Analyze recent metrics (last 10 snapshots)
            recent = list(self.metrics_history)[-10:]

            report = {
                "summary": {
                    "monitoring_duration_hours": (
                        recent[-1]["timestamp"] - recent[0]["timestamp"]
                    )
                    / 3600,
                    "total_snapshots": len(recent),
                    "avg_hit_rate": sum(
                        m.get("redis", {}).get("overall_metrics", {}).get("hit_rate", 0)
                        for m in recent
                    )
                    / len(recent),
                    "avg_response_time_ms": sum(
                        m.get("redis", {})
                        .get("overall_metrics", {})
                        .get("avg_response_time", 0)
                        * 1000
                        for m in recent
                    )
                    / len(recent),
                    "total_operations": sum(
                        m.get("redis", {})
                        .get("overall_metrics", {})
                        .get("total_operations", 0)
                        for m in recent
                    ),
                    "total_errors": sum(
                        m.get("redis", {}).get("overall_metrics", {}).get("errors", 0)
                        for m in recent
                    ),
                },
                "trends": self._analyze_trends(recent),
                "recommendations": self._generate_recommendations(recent),
                "alerts_summary": self._summarize_alerts(),
                "generated_at": time.time(),
            }

            return report

        except Exception as e:
            logger.error(f"Error generating performance report: {e}")
            return {"error": str(e)}

    def _analyze_trends(self, metrics: List[Dict]) -> Dict[str, Any]:
        """Analyze trends in metrics."""
        if len(metrics) < 2:
            return {"insufficient_data": True}

        trends = {}
        first = metrics[0]
        last = metrics[-1]

        # Hit rate trend
        first_hit_rate = (
            first.get("redis", {}).get("overall_metrics", {}).get("hit_rate", 0)
        )
        last_hit_rate = (
            last.get("redis", {}).get("overall_metrics", {}).get("hit_rate", 0)
        )
        if first_hit_rate > 0:
            trends["hit_rate_change"] = (
                last_hit_rate - first_hit_rate
            ) / first_hit_rate

        # Response time trend
        first_response_time = (
            first.get("redis", {})
            .get("overall_metrics", {})
            .get("avg_response_time", 0)
        )
        last_response_time = (
            last.get("redis", {}).get("overall_metrics", {}).get("avg_response_time", 0)
        )
        trends["response_time_change_ms"] = (
            last_response_time - first_response_time
        ) * 1000

        # Redis memory usage trend
        first_memory_str = (
            first.get("redis", {}).get("redis_stats", {}).get("used_memory_human", "0B")
        )
        last_memory_str = (
            last.get("redis", {}).get("redis_stats", {}).get("used_memory_human", "0B")
        )

        # Convert memory strings to MB
        def parse_memory(mem_str):
            try:
                if "G" in mem_str:
                    return float(mem_str.replace("G", "")) * 1024
                elif "M" in mem_str:
                    return float(mem_str.replace("M", ""))
                else:
                    return 0.1
            except:
                return 0.1

        first_memory = parse_memory(first_memory_str)
        last_memory = parse_memory(last_memory_str)
        trends["redis_memory_change_mb"] = last_memory - first_memory

        return trends

    def _generate_recommendations(self, metrics: List[Dict]) -> List[str]:
        """Generate recommendations based on metrics analysis."""
        recommendations = []

        avg_hit_rate = sum(
            m.get("redis", {}).get("overall_metrics", {}).get("hit_rate", 0)
            for m in metrics
        ) / len(metrics)
        if avg_hit_rate < 0.7:
            recommendations.append(
                "Consider increasing cache TTL values or implementing cache warming for hot data"
            )

        avg_response_time = sum(
            m.get("redis", {}).get("overall_metrics", {}).get("avg_response_time", 0)
            for m in metrics
        ) / len(metrics)
        if avg_response_time > 0.05:  # 50ms
            recommendations.append(
                "High cache response times detected. Consider optimizing Redis connection settings"
            )

        # Check Redis memory usage
        redis_memory_usage = []
        for m in metrics:
            mem_str = (
                m.get("redis", {}).get("redis_stats", {}).get("used_memory_human", "0B")
            )
            try:
                if "G" in mem_str:
                    mem_mb = float(mem_str.replace("G", "")) * 1024
                elif "M" in mem_str:
                    mem_mb = float(mem_str.replace("M", ""))
                else:
                    mem_mb = 0.1
                redis_memory_usage.append(mem_mb)
            except:
                redis_memory_usage.append(0.1)

        avg_redis_memory = (
            sum(redis_memory_usage) / len(redis_memory_usage)
            if redis_memory_usage
            else 0
        )
        if avg_redis_memory > 400:  # If Redis using more than 400MB on average
            recommendations.append(
                "Redis memory usage is high. Consider increasing Redis maxmemory or implementing better cache eviction policies"
            )

        return recommendations

    def _summarize_alerts(self) -> Dict[str, Any]:
        """Summarize recent alerts."""
        recent_alerts = self.get_alerts(hours=24)
        alert_counts = defaultdict(int)

        for alert in recent_alerts:
            alert_counts[alert["type"]] += 1

        return {
            "total_alerts": len(recent_alerts),
            "alerts_by_type": dict(alert_counts),
            "most_recent_alert": recent_alerts[-1] if recent_alerts else None,
        }


# Global cache monitor instance
cache_monitor = CacheMonitor()

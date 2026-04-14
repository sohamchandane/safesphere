-- Improve user map history queries and timeline filtering.
CREATE INDEX IF NOT EXISTS idx_monitoring_data_user_timestamp_coords
ON public.monitoring_data(user_id, timestamp DESC)
WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_monitoring_data_user_ground_truth_timestamp
ON public.monitoring_data(user_id, ground_truth, timestamp DESC);

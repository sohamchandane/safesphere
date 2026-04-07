-- Track whether a ground-truth reminder email has already been sent for a session.
ALTER TABLE public.monitoring_data
ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_monitoring_data_user_reminder
ON public.monitoring_data(user_id, reminder_sent_at);
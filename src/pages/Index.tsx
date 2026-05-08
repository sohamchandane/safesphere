import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Activity, ArrowRight, BellRing, HeartPulse, MapPin, ShieldCheck, Wind } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const Index = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <div className="landing-grid-bg min-h-screen overflow-hidden bg-gradient-subtle">
      <div className="hero-orb hero-orb-teal" aria-hidden="true" />
      <div className="hero-orb hero-orb-cyan" aria-hidden="true" />

      <div className="container relative mx-auto px-4 pb-16 pt-8 sm:pt-12 lg:pb-24">
        <header className="mb-10 flex items-center justify-between rounded-2xl border border-border/70 bg-card/80 px-4 py-3 shadow-soft backdrop-blur md:px-6">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-gradient-hero p-2.5 shadow-medium">
              <Activity className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-widest text-primary">SafeSphere</p>
              <p className="text-xs text-muted-foreground">{t('index.tagline')}</p>
            </div>
          </div>

          <Button variant="outline" className="rounded-xl" onClick={() => navigate('/auth')}>
            {t('index.signIn')}
          </Button>
        </header>

        <section className="grid items-center gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:gap-10">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium uppercase tracking-wide text-primary">
              <BellRing className="h-3.5 w-3.5" />
              {t('index.realTimeAlerts')}
            </div>

            <h1 className="text-balance text-4xl font-bold leading-tight text-foreground sm:text-5xl lg:text-6xl">
              {t('index.heroPrefix')}
              <span className="bg-gradient-hero bg-clip-text text-transparent"> {t('index.heroHighlight')}</span>
            </h1>

            <p className="max-w-xl text-base text-muted-foreground sm:text-lg">
              {t('index.heroDescription')}
            </p>

            <div className="flex flex-col gap-3 pt-2 sm:flex-row">
              <Button
                size="lg"
                className="group h-12 rounded-xl bg-gradient-hero px-7 text-base font-semibold hover:opacity-95"
                onClick={() => navigate('/register')}
              >
                {t('index.startMonitoring')}
                <ArrowRight className="ml-2 h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="h-12 rounded-xl px-7 text-base"
                onClick={() => navigate('/auth')}
              >
                {t('index.alreadyHaveAccount')}
              </Button>
            </div>

            <div className="grid max-w-xl grid-cols-3 gap-3 pt-1 text-center sm:gap-4">
              <div className="rounded-xl border border-border/70 bg-card/80 p-3 shadow-soft">
                <p className="text-xl font-bold text-foreground">24x7</p>
                <p className="text-xs text-muted-foreground">{t('index.monitoring')}</p>
              </div>
              <div className="rounded-xl border border-border/70 bg-card/80 p-3 shadow-soft">
                <p className="text-xl font-bold text-foreground">Live</p>
                <p className="text-xs text-muted-foreground">{t('index.airPollen')}</p>
              </div>
              <div className="rounded-xl border border-border/70 bg-card/80 p-3 shadow-soft">
                <p className="text-xl font-bold text-foreground">Private</p>
                <p className="text-xs text-muted-foreground">{t('index.privateData')}</p>
              </div>
            </div>
          </div>

          <div className="fade-up-delayed rounded-3xl border border-border/70 bg-card/85 p-4 shadow-elevation backdrop-blur sm:p-5">
            <div className="rounded-2xl border border-border/70 bg-background/90 p-4 sm:p-5">
              <div className="mb-4 flex items-center justify-between">
                <p className="text-sm font-semibold text-foreground">{t('index.todayAtGlance')}</p>
                <span className="rounded-full bg-success/15 px-2.5 py-1 text-xs font-medium text-success">{t('index.protected')}</span>
              </div>

              <div className="space-y-3">
                <div className="rounded-xl bg-muted/60 p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">{t('index.currentZone')}</p>
                  <p className="mt-1 flex items-center gap-2 text-sm font-medium text-foreground">
                    <MapPin className="h-4 w-4 text-accent" />
                    Mumbai West, INR
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-border/70 p-3">
                    <p className="mb-1 text-xs text-muted-foreground">{t('index.heartRate')}</p>
                    <p className="flex items-center gap-1.5 text-base font-semibold text-foreground">
                      <HeartPulse className="h-4 w-4 text-destructive" />
                      84 bpm
                    </p>
                  </div>
                  <div className="rounded-xl border border-border/70 p-3">
                    <p className="mb-1 text-xs text-muted-foreground">{t('index.airQuality')}</p>
                    <p className="flex items-center gap-1.5 text-base font-semibold text-foreground">
                      <Wind className="h-4 w-4 text-primary" />
                      {t('index.moderate')}
                    </p>
                  </div>
                </div>

                <div className="rounded-xl border border-warning/40 bg-warning/10 p-3">
                  <p className="mb-1 text-xs uppercase tracking-wide text-warning">{t('index.riskForecast')}</p>
                  <p className="text-sm font-semibold text-foreground">{t('index.riskForecastText')}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{t('index.riskForecastRecommendation')}</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-14 grid gap-4 md:grid-cols-3 md:gap-5">
          <div className="fade-up rounded-2xl border border-border/70 bg-card/85 p-5 shadow-soft backdrop-blur">
            <div className="mb-3 inline-flex rounded-lg bg-primary/15 p-2">
              <HeartPulse className="h-5 w-5 text-primary" />
            </div>
            <h3 className="mb-2 text-lg font-semibold">{t('index.vitalsEnvTitle')}</h3>
            <p className="text-sm text-muted-foreground">{t('index.vitalsEnvDesc')}</p>
          </div>

          <div className="fade-up rounded-2xl border border-border/70 bg-card/85 p-5 shadow-soft backdrop-blur" style={{ animationDelay: '90ms' }}>
            <div className="mb-3 inline-flex rounded-lg bg-accent/15 p-2">
              <BellRing className="h-5 w-5 text-accent" />
            </div>
            <h3 className="mb-2 text-lg font-semibold">{t('index.earlyWarningsTitle')}</h3>
            <p className="text-sm text-muted-foreground">{t('index.earlyWarningsDesc')}</p>
          </div>

          <div className="fade-up rounded-2xl border border-border/70 bg-card/85 p-5 shadow-soft backdrop-blur" style={{ animationDelay: '180ms' }}>
            <div className="mb-3 inline-flex rounded-lg bg-success/15 p-2">
              <ShieldCheck className="h-5 w-5 text-success" />
            </div>
            <h3 className="mb-2 text-lg font-semibold">{t('index.privacyFirstTitle')}</h3>
            <p className="text-sm text-muted-foreground">{t('index.privacyFirstDesc')}</p>
          </div>
        </section>

        <section className="mt-12 rounded-3xl border border-border/70 bg-card/85 p-6 text-center shadow-medium backdrop-blur sm:p-8">
          <h2 className="text-2xl font-bold text-foreground sm:text-3xl">{t('index.ctaTitle')}</h2>
          <p className="mx-auto mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">
            {t('index.ctaDesc')}
          </p>
          <Button size="lg" className="mt-5 h-12 rounded-xl bg-gradient-hero px-8 text-base font-semibold" onClick={() => navigate('/register')}>
            {t('index.createFreeAccount')}
          </Button>
        </section>
      </div>
    </div>
  );
};

export default Index;

import { posthog } from './posthog';

const KPI_EVENTS = {
    SIGNUP: 'kpi_signup',
    PURCHASE: 'kpi_purchase',
    SESSION_START: 'kpi_session_start',
    GENERATION: 'kpi_generation', // Добавим метрику генераций для StyleMirror
};

export function trackKPI(eventName: string, properties = {}) {
    posthog.capture(eventName, {
        ...properties,
        timestamp: new Date().toISOString(),
    });
}

export function trackSignup(userId: string) {
    trackKPI(KPI_EVENTS.SIGNUP, { user_id: userId });
}

export function trackPurchase(userId: string, amount: string | number) {
    trackKPI(KPI_EVENTS.PURCHASE, { user_id: userId, amount });
}

export function trackGeneration(userId: string, plan: string) {
    trackKPI(KPI_EVENTS.GENERATION, { user_id: userId, user_plan: plan });
}

export { KPI_EVENTS };
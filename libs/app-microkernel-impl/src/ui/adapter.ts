import type { ProvidedServices } from '@amk/app-microkernel-api';
export const UI = { registerView(ctx: ProvidedServices, slot: string, viewFactory: any){ ctx.views.register(slot, viewFactory); }, getViews(ctx: ProvidedServices, slot: string){ return ctx.views.list(slot); } };

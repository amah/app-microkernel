import type { ActivateContext, Provider, Token } from '@amk/app-microkernel-api';
export type InitializationContext = {
  provide<T>(prov: Provider<T>): void;
  resolve<T>(token: Token<T>): T;
  commands: { register: (id: string, handler: (...a: any[]) => any) => void };
  views: { register: (slot: string, viewFactory: any) => void };
  hooks: { on: (ev: string, fn: (...a: any[]) => void) => void; emit: (ev: string, ...a: any[]) => void };
  env?: Record<string, any>;
};
export type PluginModule = {
  initialize(ctx: InitializationContext): void | Promise<void>;
  activate(ctx: ActivateContext): void | Promise<void>;
  deactivate?: () => void | Promise<void>;
};

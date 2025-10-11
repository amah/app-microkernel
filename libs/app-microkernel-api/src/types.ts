export type Token<T = any> = string | symbol | { new (...args: any[]): T };
export type CommandRegistry = { register(id: string, handler: (...a: any[]) => any): void; run(id: string, ...a: any[]): any; has(id: string): boolean; };
export type ViewRegistry = { register(slot: string, viewFactory: any): void; list(slot: string): any[]; };
export type Hooks = { on(event: string, fn: (...a: any[]) => void): void; off(event: string, fn: (...a: any[]) => void): void; emit(event: string, ...a: any[]): void; };
export type PluginManifest = { name: string; version: string; entry: string; baseUrl?: string; dependsOn?: string[]; contributes?: { commands?: Array<{ id: string; title?: string }>; views?: Array<{ slot: string; id: string; title?: string }>; }; };
export type ClassProvider<T = any> = { provide: Token<T>; useClass: { new (...args: any[]): T } };
export type ValueProvider<T = any> = { provide: Token<T>; useValue: T };
export type FactoryProvider<T = any> = { provide: Token<T>; useFactory: (...deps: any[]) => T; deps?: Token[] };
export type Provider<T = any> = ClassProvider<T> | ValueProvider<T> | FactoryProvider<T>;
export type ProvidedServices = { resolve<T>(token: Token<T>): T; commands: CommandRegistry; views: ViewRegistry; hooks: Hooks; env?: Record<string, any>; };
export type ActivateContext = ProvidedServices;
export interface IHost { loadPlugins(manifests: Array<string | PluginManifest>): Promise<void>; bootstrapAllAtRoot(): Promise<void>; createChildHost(overrides?: Provider[], env?: Record<string, any>): IChildHost; }
export interface IChildHost { bootstrap(pluginNames?: string[] | 'all'): Promise<void>; }

import type { ActivateContext, IChildHost, IHost, PluginManifest, Provider } from '@app-microkernel/api';
import { Container } from './di';
import { createCommandRegistry, createHooks, createViewRegistry } from './registries';
import { PluginRegistry } from './loader';
import type { InitializationContext } from '@app-microkernel/spi';

function createInitContext(container: Container, env?: Record<string, any>): InitializationContext {
  const commands = createCommandRegistry();
  const views = createViewRegistry();
  const hooks = createHooks();
  return {
    provide: (prov) => container.provide(prov),
    resolve: (t) => container.resolve(t),
    commands: { register: (id, h) => commands.register(id, h) },
    views: { register: (slot, vf) => views.register(slot, vf) },
    hooks: { on: (ev, fn) => hooks.on(ev, fn), emit: (ev, ...a) => hooks.emit(ev, ...a) },
    env,
  };
}

function createActivateContext(container: Container, env?: Record<string, any>): ActivateContext {
  return {
    resolve: (t) => container.resolve(t),
    commands: createCommandRegistry(),
    views: createViewRegistry(),
    hooks: createHooks(),
    env,
  };
}

export class Host implements IHost {
  readonly root: Container; readonly registry: PluginRegistry; private env?: Record<string, any>;
  constructor(initialProviders: Provider[] = [], env?: Record<string, any>){ this.root = new Container(); initialProviders.forEach(p=>this.root.provide(p)); this.registry = new PluginRegistry(); this.env = env; }
  async loadPlugins(manifests: Array<string|PluginManifest>): Promise<void>{ await this.registry.loadAllAtRoot(manifests); }
  async bootstrapAllAtRoot(): Promise<void>{
    const initCtx = createInitContext(this.root, this.env);
    const mods = this.registry.getModulesInOrder('all');
    for(const m of mods) await m.initialize?.(initCtx);
    const actCtx = createActivateContext(this.root, this.env);
    (actCtx as any).commands = (initCtx as any).commands;
    (actCtx as any).views = (initCtx as any).views;
    (actCtx as any).hooks = (initCtx as any).hooks;
    for(const m of mods) await m.activate?.(actCtx);
    actCtx.hooks.emit('host:activated');
  }
  createChildHost(overrides: Provider[] = [], env?: Record<string, any>): IChildHost { const child = this.root.createChild(); overrides.forEach(p=>child.provide(p)); const childEnv = { ...(this.env||{}), ...(env||{}) }; return new ChildHost(child, this.registry, childEnv); }
}

class ChildHost implements IChildHost {
  constructor(private readonly container: Container, private readonly registry: PluginRegistry, private readonly env?: Record<string, any>) {}
  async bootstrap(pluginNames: string[]|'all'='all'): Promise<void>{
    const initCtx = createInitContext(this.container, this.env);
    const mods = this.registry.getModulesInOrder(pluginNames);
    for(const m of mods) await m.initialize?.(initCtx);
    const actCtx = createActivateContext(this.container, this.env);
    (actCtx as any).commands = (initCtx as any).commands;
    (actCtx as any).views = (initCtx as any).views;
    (actCtx as any).hooks = (initCtx as any).hooks;
    for(const m of mods) await m.activate?.(actCtx);
    actCtx.hooks.emit('child:activated');
  }
}

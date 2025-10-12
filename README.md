# app-microkernel — Microkernel Plugin Framework (API / SPI / Impl)

A lightweight, VSCode-style **plugin microkernel** with a clear split between:

- **API** — what host apps and consumers depend on
- **SPI** — what plugin authors implement
- **Impl** — the runtime (DI container, registries, loader, host/child lifecycle)

It also includes a tiny demo app (Vite + React) to show the basics.

---

## Monorepo layout

```
apps/
  demo/                         # Small Vite + React demo app

libs/
  app-microkernel-api/          # Public API (types & contracts)
  app-microkernel-spi/          # Service Provider Interface (plugin contracts)
  app-microkernel-impl/         # Runtime implementation (DI, loader, host/child, registries)
```

### Packages at a glance

- **@amk/app-microkernel-api**  
  Public contracts for tokens, providers, registries, manifests, host interfaces.

- **@amk/app-microkernel-spi**
  Plugin authoring API: `PluginModule` with lifecycle (`initialize`, `activate`, `deactivate`) and `InitializationContext`.

- **@amk/app-microkernel-impl**
  Implementation details: hierarchical DI container, command/view/hook registries, root-only plugin loader, and host/child orchestration.

---

## Design goals

- **Two-phase plugin lifecycle**  
  `initialize()` for **registrations** (services, views, commands), then `activate()` for **startup** (timers, sockets, long-running tasks).

- **Strict API/SPI separation**  
Consumers and hosts rely on `@amk/app-microkernel-api`; plugin authors rely on `@amk/app-microkernel-spi`. Only the runtime uses `@amk/app-microkernel-impl`.

- **Hierarchical containers**  
  Only the **root container** can **load modules** (dynamic import). **Child containers** can only **bootstrap** already-loaded plugins into their own scope (tenant/workspace context).

- **Lightweight DI**  
  Tiny DI with programmatic providers and optional `@Injectable` annotation.

- **UI extension points**  
  A simple `views` registry; pair this with your framework (React, Vue, Svelte) to render views from plugins.

---

## Core concepts

### Manifests

```ts
export type PluginManifest = {
  name: string;
  version: string;
  entry: string;       // ESM entry URL (root loads this)
  baseUrl?: string;
  dependsOn?: string[]; // plugin names this depends on
  contributes?: {
    commands?: Array<{ id: string; title?: string }>;
    views?: Array<{ slot: string; id: string; title?: string }>;
  };
};
```

> The loader topologically sorts `dependsOn` before initialize/activate.

### Lifecycle

- **`initialize(ctx: InitializationContext)`**  
  Register providers (`ctx.provide`), wire factories (`ctx.resolve`), register UI views & commands. No long-running side-effects.

- **`activate(ctx: ActivateContext)`**  
  All services are resolved and stable. Start anything that needs to run (timers, sockets, events). You can run commands here.

- **`deactivate()`** *(optional)*  
  Stop timers, clean up external resources.

### Contexts

- **InitializationContext (SPI)**
    - `provide<T>(Provider<T>)` — declare services for the scope
    - `resolve<T>(Token<T>)` — resolve dependencies during wiring
    - `commands.register(id, handler)` — contribute command handlers
    - `views.register(slot, viewFactory)` — contribute UI pieces
    - `hooks.on/emit` — event bus
    - `env` — optional environment bag

- **ActivateContext (API)** *(aka ProvidedServices)*
    - `resolve<T>(Token<T>)` — resolve services
    - `commands/run/has` — command registry
    - `views.list/…` — view registry
    - `hooks.on/off/emit` — event bus
    - `env` — environment bag

> The **registries and hooks** you interact with in `activate` are the same instances seeded in `initialize`, so your contributions carry over.

---

## Dependency Injection

**Providers** (public API):

```ts
export type Provider<T> =
  | { provide: Token<T>; useValue: T }
  | { provide: Token<T>; useClass: new (...args:any[]) => T }
  | { provide: Token<T>; useFactory: (...deps:any[]) => T; deps?: Token[] };
```

**Optional annotation** (impl):

```ts
@Injectable([TOKENS.ApiBaseUrl, Logger])
class ApiClient {
  constructor(private baseUrl: string, private log: Logger) {}
}
```

Register in `initialize()`:

```ts
ctx.provide({ provide: Logger, useClass: Logger });
ctx.provide({ provide: TOKENS.ApiBaseUrl, useValue: 'https://api.example.com' });
ctx.provide({ provide: ApiClient, useClass: ApiClient });
```

---

## Commands, Views & Hooks

- **Commands**: `commands.register('ext.open', handler)` and `commands.run('ext.open', ...)`
- **Views**: `views.register('Toolbar.Right', () => ReactComponentOrFactory)`
- **Hooks**: `hooks.on('some:event', cb)` and `hooks.emit('some:event', payload)`

**Example**:

```ts
ctx.commands.register('demo.sayHello', (name = 'world') => `Hello, ${name}!`);
ctx.views.register('Toolbar.Right', () => ({ type: 'button', label: '👋', onClick: () => ctx.hooks.emit('greet') }));
ctx.hooks.on('host:activated', () => ctx.commands.run('demo.sayHello', 'from hooks'));
```

---

## Host & Child hosts

- **Root Host**:
    - Loads plugin modules from `entry` URLs (dynamic import)
    - Performs **initialize → activate** for all plugins in dependency order
- **Child Host**:
    - **Cannot load** modules
    - Can **bootstrap** (initialize → activate) already loaded plugins into a **child container** with its own provider overrides (think tenant/workspace)

**Root**:

```ts
import { Host } from '@amk/app-microkernel-impl';

const host = new Host([
  { provide: Logger, useClass: Logger },
  { provide: TOKENS.ApiBaseUrl, useValue: 'https://root.api/' },
]);

await host.loadPlugins([
  { name: 'demo', version: '1.0.0', entry: '/plugins/demo/index.js' }
]);
await host.bootstrapAllAtRoot();
```

**Child**:

```ts
const child = host.createChildHost([
  { provide: TOKENS.ApiBaseUrl, useValue: 'https://tenant-a.api/' }, // override
]);

await child.bootstrap('all'); // or ['demo']
```

---

## Writing a plugin (SPI)

```ts
// my-plugin/index.ts
import type { PluginModule } from '@amk/app-microkernel-spi';
import type { Provider } from '@amk/app-microkernel-api';

class Logger { info(...a:any[]){ console.log('[info]', ...a); } }

export const MyPlugin: PluginModule = {
  async initialize(ctx) {
    const providers: Provider[] = [
      { provide: Logger, useClass: Logger },
      // other services...
    ];
    providers.forEach(p => ctx.provide(p));

    ctx.commands.register('my.hello', (who='world') => {
      ctx.resolve(Logger).info(`Hello, ${who}!`);
    });

    ctx.views.register('Toolbar.Right', () => ({
      type: 'button',
      label: 'Hello',
      onClick: () => ctx.commands.run('my.hello', 'from view'),
    }));
  },

  async activate(ctx) {
    ctx.hooks.on('greet', () => ctx.commands.run('my.hello', 'from hooks'));
  },

  deactivate() { /* cleanup */ },
};
```

**Manifest example** (served by your CMS/CDN):

```json
{
  "name": "my-plugin",
  "version": "1.0.0",
  "entry": "https://cdn.example.com/my-plugin/index.js",
  "dependsOn": ["some-shared-plugin"]
}
```

---

## Demo app (Vite + React)

The demo shows:
- A host that manually registers a plugin (no network)
- A contributed toolbar button firing a command

**Run it:**

```bash
bun install
bun run demo:dev
```

The demo uses `vite.resolve.alias` to point `@amk/app-microkernel-api`, `@amk/app-microkernel-spi`, and `@amk/app-microkernel-impl` to the local libs' `src/index.ts` so you can iterate without building/publishing.

---

## Build & publish (Bun)

This project uses **Bun** as the package manager and build tool.

**Install dependencies:**

```bash
bun install
```

**Build all libs:**

```bash
bun run build
```

This builds the libraries in dependency order:
1. `@amk/app-microkernel-api` (no dependencies)
2. `@amk/app-microkernel-spi` (depends on api)
3. `@amk/app-microkernel-impl` (depends on api and spi)

**Build individual libraries:**

```bash
bun run build:api
bun run build:spi
bun run build:impl
```

**Clean build artifacts:**

```bash
bun run clean
```

**Publish (example):**

```bash
# Publish to npm registry
cd libs/app-microkernel-api && npm publish
cd ../app-microkernel-spi && npm publish
cd ../app-microkernel-impl && npm publish
```

---

## Extending the framework

- **View rendering**: add a `<PlugPoint name="..."/>` React component that reads `views.list(name)` from the activation context and renders actual React components.
- **Sandboxing**: if you need stronger isolation, load plugins in iframes or Web Workers and proxy the SPI calls.
- **Versioning**: enforce semver compatibility and block activation if required versions aren’t met.
- **Diagnostics**: add hook tracing and command invocations logging for observability.
- **Security**: validate manifests/URLs and constrain dynamic imports to trusted origins.

---

## FAQ

**Why two phases?**  
To separate **declarative contributions** (safe to run in any order) from **runtime startup** (which may assume all services are ready).

**Why root-only loading?**  
It prevents untrusted code from being arbitrarily loaded in child scopes and makes plugin provenance/auditing simpler.

**How do I read contributed views in a real app?**  
Expose a read API (e.g., `views.list(slot)`) from your host’s activation context (or via a UI adapter) and bind it to framework components (e.g., React `<PlugPoint name="Toolbar.Right" />`).

---

## Minimal host + plugin TL;DR

```ts
// host
const host = new Host([{ provide: Logger, useClass: Logger }]);
await host.loadPlugins(['/manifests/my-plugin.json']);
await host.bootstrapAllAtRoot();

// plugin
export const MyPlugin: PluginModule = {
  initialize(ctx) {
    ctx.commands.register('x.hello', () => 'Hello!');
    ctx.views.register('Toolbar.Right', () => () => <button onClick={() => ctx.commands.run('x.hello')}>👋</button>);
  },
  activate(ctx) { /* start stuff */ },
};
```

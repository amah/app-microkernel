import type { Provider, Token } from '@app-microkernel/api';
const INJECT_KEY = Symbol('di:inject');
export function Injectable(deps: Token[] = []): ClassDecorator { return (t: any) => { (t as any)[INJECT_KEY] = deps; }; }
export class Container {
  private parent?: Container; private providers = new Map<Token, Provider>(); private instances = new Map<Token, any>();
  constructor(parent?: Container) { this.parent = parent; }
  createChild(): Container { return new Container(this); }
  provide<T>(prov: Provider<T>): this { this.providers.set(prov.provide, prov); return this; }
  resolve<T>(token: Token<T>): T {
    if (this.instances.has(token)) return this.instances.get(token);
    if (this.providers.has(token)) {
      const prov: any = this.providers.get(token)!; let value: any;
      if ('useValue' in prov) value = prov.useValue;
      else if ('useClass' in prov) { const C = prov.useClass; const deps: Token[] = (C as any)[INJECT_KEY] || []; const args = deps.map((d)=>this.resolve(d)); value = new C(...args); }
      else { const deps: Token[] = prov.deps || []; const args = deps.map((d)=>this.resolve(d)); value = prov.useFactory(...args); }
      this.instances.set(token, value); return value;
    }
    if (this.parent) return this.parent.resolve(token);
    throw new Error(`No provider for token: ${token.toString?.() ?? String(token)}`);
  }
}

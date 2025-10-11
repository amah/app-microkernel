import React, { useMemo, useEffect, useState } from 'react';
import { Host } from '@app-microkernel/impl';
import type { Provider } from '@app-microkernel/api';
import type { PluginModule } from '@app-microkernel/spi';

// Example tokens/services for the demo
const TOKENS = { Logger: Symbol('Logger'), ApiBaseUrl: Symbol('ApiBaseUrl') } as const;

class Logger { info(...a:any[]){ console.log('[info]', ...a);} }
class ApiClient { constructor(private base:string, private log:Logger){} async get(p:string){ this.log.info('GET', p); return {}; } }

const DemoPlugin: PluginModule = {
  async initialize(ctx){
    const providers: Provider[] = [
      { provide: Logger, useClass: Logger },
      { provide: TOKENS.ApiBaseUrl, useValue: 'https://api.example.com/' },
      { provide: ApiClient, useClass: ApiClient },
    ];
    providers.forEach(p=>ctx.provide(p));
    ctx.commands.register('demo.sayHello', (name='world') => { ctx.resolve(Logger).info(`Hello, ${name}!`); return `Hello, ${name}!`; });
    ctx.views.register('Toolbar.Right', () => ({ type: 'button', label: '👋', onClick: () => ctx.hooks.emit('demo:greet', 'plugin user') }));
  },
  async activate(ctx){
    const api = ctx.resolve(ApiClient);
    ctx.hooks.on('demo:greet', async (name:string)=>{ ctx.resolve(Logger).info('Greet for', name); await api.get('/status'); ctx.commands.run('demo.sayHello', name); });
  },
};

function Toolbar({ views }: { views: any[] }){
  return <div style={{display:'flex', gap:8}}>
    <div style={{flex:1}} />
    {views.map((vf, i) => {
      const v = vf();
      if (v?.type === 'button') {
        return <button key={i} onClick={v.onClick}>{v.label ?? 'Button'}</button>;
      }
      return <span key={i}>[Unknown view]</span>;
    })}
  </div>;
}

export default function App(){
  const [views, setViews] = useState<any[]>([]);

  const host = useMemo(()=>{
    const h = new Host();
    // manually register demo plugin in registry for local run
    const reg: any = (h as any).registry; reg.byName ??= new Map();
    reg.byName.set('demo', { manifest: { name:'demo', version:'1.0.0', entry:'' }, module: DemoPlugin });
    return h;
  }, []);

  useEffect(()=>{
    (async () => {
      await host.bootstrapAllAtRoot();
      // Pull views contributed to 'Toolbar.Right' from the activation context.
      // For simplicity, we re-instantiate the same view factory that DemoPlugin registers.
      // In a fuller demo, you'd expose a read API for the registry.
      const vf = () => ({ type:'button', label:'👋', onClick: ()=> host && alert('Hello from plugin!') });
      setViews([vf]);
    })();
  }, [host]);

  return <div style={{padding:16, fontFamily:'sans-serif'}}>
    <h1>App Microkernel Demo</h1>
    <p>Click the toolbar button contributed by the plugin:</p>
    <Toolbar views={views} />
  </div>;
}

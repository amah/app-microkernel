import type { PluginManifest } from '@app-microkernel/api';
import type { PluginModule } from '@app-microkernel/spi';
class PluginRecord { constructor(public manifest: PluginManifest, public module?: PluginModule) {} }
export class PluginRegistry {
  private byName = new Map<string, PluginRecord>();
  get(name:string){ return this.byName.get(name); }
  list(){ return [...this.byName.values()].map(r=>r.manifest); }
  async loadAllAtRoot(manifestInputs: Array<string|PluginManifest>){
    const mfs: PluginManifest[] = [];
    for(const m of manifestInputs){ if(typeof m==='string') mfs.push(await fetch(m).then(r=>r.json())); else mfs.push(m); }
    const sorted = topoSortByDeps(mfs);
    for(const m of sorted){ const url = new URL(m.entry,(m.baseUrl??location.origin)+'/').toString(); const mod: PluginModule = await import(/* @vite-ignore */ url); this.byName.set(m.name,new PluginRecord(m,mod)); }
  }
  getModulesInOrder(names: string[]|'all'='all'){ const t = names==='all' ? [...this.byName.keys()] : names; const order = topoSortByDeps(t.map(n=>this.byName.get(n)!.manifest)); return order.map(m=>this.byName.get(m.name)!.module!).filter(Boolean); }
}
function topoSortByDeps(items: PluginManifest[]): PluginManifest[]{ const idx=new Map(items.map(i=>[i.name,i] as const)); const seen=new Set<string>(); const out: PluginManifest[]=[]; const visit=(m:PluginManifest)=>{ if(seen.has(m.name)) return; (m.dependsOn??[]).forEach(n=>{ const d=idx.get(n); if(d) visit(d); }); seen.add(m.name); out.push(m); }; items.forEach(visit); return out; }

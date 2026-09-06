import React, { useState } from 'react';
import { Home, Receipt, PackagePlus, Wrench, MoreHorizontal, X, Store, Printer, Smartphone, Volume2, VolumeX, RotateCcw, FileClock, UserRound, QrCode } from 'lucide-react';
import { BusinessProfile, AppTheme } from '../types';

interface Props {
  activeTab: 'dashboard'|'bill'|'history'|'products'|'repairs'|'profile'|'printer';
  mobileViewMode:'editor'|'preview'; setMobileViewMode:(m:'editor'|'preview')=>void;
  onTabChange:(t:'dashboard'|'bill'|'history'|'products'|'repairs'|'profile'|'printer')=>void;
  itemsCount:number; grandTotal:number; currencySymbol:string; onOpenResetModal:()=>void; onOpenInstallPrompt:()=>void; onOpenCustomerHistory:()=>void; onExportBackup:()=>void; onImportBackup:(file:File)=>void;
  onOpenCodeGenerator:()=>void;
  lang:'si'|'en'; setLang:(l:'si'|'en')=>void; soundEnabled:boolean; setSoundEnabled:(v:boolean)=>void;
  business?:BusinessProfile; onUpdateBusiness?:(b:BusinessProfile)=>void;
}

export const MobileBottomNav:React.FC<Props>=({activeTab,onTabChange,onOpenResetModal,onOpenInstallPrompt,onOpenCustomerHistory,onOpenCodeGenerator,onExportBackup,onImportBackup,lang,setLang,soundEnabled,setSoundEnabled,business,onUpdateBusiness})=>{
 const [more,setMore]=useState(false); const si=false;
 const go=(tab:Props['activeTab'])=>{setMore(false);onTabChange(tab)};
 const theme=(id:AppTheme)=>onUpdateBusiness?.({...business!,appTheme:id});
 return <>
  <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-950/96 backdrop-blur-xl border-t border-slate-800 px-2 pt-1.5 pb-[max(.35rem,env(safe-area-inset-bottom))] shadow-2xl">
   <div className="max-w-lg mx-auto grid grid-cols-5 gap-1">
    <button onClick={()=>go('dashboard')} className={`navbtn ${activeTab==='dashboard'?'navactive':''}`}><Home/><span>Home</span></button>
    <button onClick={()=>go('bill')} className={`navbtn ${activeTab==='bill'?'navactive':''}`}><Receipt/><span>New Bill</span></button>
    <button onClick={()=>go('products')} className={`navbtn ${activeTab==='products'?'navactive':''}`}><PackagePlus/><span>Items</span></button>
    <button onClick={()=>go('repairs')} className={`navbtn ${activeTab==='repairs'?'navactive':''}`}><Wrench/><span>Repairs</span></button>
    <button onClick={()=>setMore(true)} className={`navbtn ${more?'navactive':''}`}><MoreHorizontal/><span>More</span></button>
   </div>
  </nav>
  {more&&<div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={()=>setMore(false)}>
   <div className="absolute bottom-0 left-0 right-0 rounded-t-[2rem] bg-slate-900 border-t border-slate-700 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl" onClick={e=>e.stopPropagation()}>
    <div className="max-w-lg mx-auto">
      <div className="flex items-center justify-between mb-4"><div><h3 className="font-black text-lg">More</h3><p className="text-[11px] text-slate-500">Bills and app tools</p></div><button onClick={()=>setMore(false)} className="p-2 rounded-xl bg-slate-800"><X className="w-5 h-5"/></button></div>
      <div className="grid grid-cols-2 gap-2">
       <button onClick={()=>go('history')} className="morebtn"><FileClock/><span>Bill History</span></button>
       <button onClick={()=>{setMore(false);onOpenCustomerHistory()}} className="morebtn"><UserRound/><span>Customer History</span></button>
       <button onClick={()=>go('printer')} className="morebtn"><Printer/><span>Printer</span></button>
       <button onClick={()=>{setMore(false);onOpenCodeGenerator()}} className="morebtn"><QrCode/><span>QR / Barcode</span></button>
       <button onClick={()=>go('profile')} className="morebtn"><Store/><span>Shop Profile</span></button>
       <button onClick={onOpenInstallPrompt} className="morebtn"><Smartphone/><span>Install App</span></button>
       <button onClick={onExportBackup} className="morebtn"><FileClock/><span>Export Backup</span></button>
       <label className="morebtn cursor-pointer"><RotateCcw/><span>Import Backup</span><input type="file" accept="application/json,.json" className="hidden" onChange={e=>{const f=e.target.files?.[0]; if(f) onImportBackup(f); e.currentTarget.value = '';}} /></label>
      </div>
      {business&&<div className="mt-3 rounded-2xl bg-slate-950 border border-slate-800 p-3"><p className="text-xs font-bold mb-2">Theme</p><div className="grid grid-cols-4 gap-1">{(['dark_modern','midnight_blue','amoled_black','clean_light'] as AppTheme[]).map(id=><button key={id} onClick={()=>theme(id)} className={`rounded-lg py-2 text-[10px] ${business.appTheme===id?'bg-cyan-500 text-slate-950 font-bold':'bg-slate-900 text-slate-400'}`}>{id==='dark_modern'?'Dark':id==='midnight_blue'?'Navy':id==='amoled_black'?'OLED':'Light'}</button>)}</div></div>}
      <div className="grid grid-cols-2 gap-2 mt-3"><button onClick={()=>setSoundEnabled(!soundEnabled)} className="morebtn">{soundEnabled?<Volume2/>:<VolumeX/>}<span>{soundEnabled?(si?'Sound On':'Sound On'):(si?'Sound Off':'Sound Off')}</span></button></div>
      <button onClick={()=>{setMore(false);onOpenResetModal()}} className="mt-2 w-full p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 flex items-center justify-center gap-2 text-xs font-bold"><RotateCcw className="w-4 h-4"/>Data Reset</button>
    </div>
   </div>
  </div>}
  <style>{`.navbtn{min-height:3.35rem;border-radius:1rem;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:.2rem;color:#94a3b8;font-size:10px;font-weight:700;position:relative}.navbtn svg{width:20px;height:20px}.navactive{color:#22d3ee;background:rgba(6,182,212,.10)}.morebtn{min-height:3.4rem;border-radius:1rem;background:#0f172a;border:1px solid #1e293b;color:#cbd5e1;display:flex;align-items:center;justify-content:center;gap:.55rem;font-size:12px;font-weight:700}.morebtn svg{width:18px;height:18px;color:#22d3ee}`}</style>
 </>
}

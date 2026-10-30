/* Keep the main UI responsive while validating large tables. */
importScripts('core.js');
self.onmessage=({data})=>{try{self.postMessage({result:KosisCore.convert(data.ref,data.analysis,data.settings)});}catch(e){self.postMessage({error:e.message});}};

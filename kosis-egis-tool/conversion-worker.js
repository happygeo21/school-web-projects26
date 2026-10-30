/* Keep the main UI responsive while validating large tables. */
importScripts('core.js','spatial.js');
self.onmessage=({data})=>{try{self.postMessage({result:data.spatial?KosisSpatial.convert(data.refs,data.analysis,data.settings):KosisCore.convert(data.ref,data.analysis,data.settings)});}catch(e){self.postMessage({error:e.message});}};

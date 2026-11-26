/* Keep parsing/validation off the UI thread. Uploaded files always use the strict gate. */
importScripts('core.js','region-crosswalk.js','kosis-workbook.js','spatial.js');
self.onmessage=({data})=>{try{
 const result=data.strict?KosisWorkbook.convert(data.input,data.registry,data.refs,data.settings,data.boundaryHash):data.spatial?KosisSpatial.convert(data.refs,data.analysis,data.settings):KosisCore.convert(data.ref,data.analysis,data.settings);
 if(data.strict&&!data.input)result.summary.input=data.analysis.src.slice(data.analysis.dataStart).filter(r=>r.some(v=>KosisCore.clean(v))).length;
 self.postMessage({result});
}catch(e){self.postMessage({error:e.message});}};

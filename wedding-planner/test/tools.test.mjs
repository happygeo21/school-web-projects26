import {test} from 'node:test';
import assert from 'node:assert/strict';
import {calculate,readBackup} from '../tool-model.mjs';
test('sale liabilities deducted once; temporary costs kept separate',()=>{
 const c=calculate({sale:7,deposit:3,debt:1,selfcash:2,partnercash:1,target:8,acquisition:.2,broker:.1,saletax:.3,extra:.4,rent9:50,month9:12,annual:3});
 assert.equal(c.net,3);assert.equal(c.funds,6);assert.equal(c.required,9);assert.equal(c.gap,3);assert.equal(c.rent,600);assert.equal(c.opportunity,600);
});
test('negative sale equity is preserved, never clamped to hide shortage',()=>{assert.equal(calculate({sale:1,deposit:2,debt:1}).gap,2);});
test('legacy backup preserves choices notes and task index without interpreting tax law',()=>{
 const b=readBackup({format:'homeplan-v1',values:{sale:'7',acquired:'unknown',goalyear:'2028'},done:[true,false,true],notes:[{text:'<script>test</script>',type:'상담',date:'2026-10-22'}]});
 assert.equal(b.values.acquired,'unknown');assert.equal(b.values.goalyear,'2028');assert.equal(b.notes[0].text,'<script>test</script>');assert.deepEqual(b.done.slice(0,3),[true,false,true]);assert.equal(b.done.length,10);
 assert.throws(()=>readBackup({format:'other',values:{},notes:[]}));
});

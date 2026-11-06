import test from 'node:test';
import assert from 'node:assert/strict';
import { createImageViewer } from '../assets/image-viewer.js';

const artwork = name => ({src:`https://example.com/${name}.png`, thumbnail:`/thumb/${name}.webp`, display:`/view/${name}.webp`, alt:name});
function setup(t, next = artwork('next'), connection) {
  const requests=[];
  class FakeImage {
    constructor() { requests.push(this); this.decode=()=>Promise.resolve(); }
    getAttribute(name) { return name === 'src' ? this.src : null; }
    removeAttribute(name) { if(name === 'src') this.src=''; }
  }
  const previous=globalThis.Image;
  globalThis.Image=FakeImage;
  t.after(()=>{globalThis.Image=previous;});
  let timer;
  t.mock.method(globalThis,'setTimeout',callback=>{timer=callback;return 1;});
  t.mock.method(globalThis,'clearTimeout',()=>{timer=null;});
  const oldConnection=Object.getOwnPropertyDescriptor(globalThis.navigator,'connection');
  Object.defineProperty(globalThis.navigator,'connection',{value:connection,configurable:true});
  t.after(()=>{if(oldConnection)Object.defineProperty(globalThis.navigator,'connection',oldConnection);else delete globalThis.navigator.connection;});
  const image={complete:true,naturalWidth:800};
  const loading={},error={},originalLink={};
  let open=true;
  const viewer=createImageViewer({image,loading,error,originalLink,getNextArtwork:()=>next,isOpen:()=>open});
  return {viewer,image,loading,error,originalLink,requests,runTimer:()=>timer?.(),hasTimer:()=>!!timer,close:()=>{open=false;viewer.close();}};
}

test('shows the thumbnail immediately, then the decoded viewing WebP, with an original link',async t=>{
  const h=setup(t);const art=artwork('first');h.viewer.load(art);
  assert.equal(h.image.src,art.thumbnail);assert.equal(h.image.hidden,false);
  assert.equal(h.loading.hidden,false);assert.equal(h.originalLink.href,art.src);
  await h.requests[0].onload();
  assert.equal(h.image.src,art.display);assert.equal(h.loading.hidden,true);
});

test('a slow earlier decode cannot overwrite the newly selected artwork',async t=>{
  const h=setup(t);h.viewer.load(artwork('first'));
  let resolveDecode;h.requests[0].decode=()=>new Promise(resolve=>{resolveDecode=resolve;});
  const firstFinish=h.requests[0].onload();
  h.viewer.load(artwork('second'));await h.requests[1].onload();
  resolveDecode();await firstFinish;
  assert.equal(h.image.src,artwork('second').display);
});

test('closing cancels pending work and prevents late updates or prefetch',async t=>{
  const h=setup(t);h.viewer.load(artwork('first'));
  let resolveDecode;h.requests[0].decode=()=>new Promise(resolve=>{resolveDecode=resolve;});
  const finish=h.requests[0].onload();h.close();resolveDecode();await finish;
  assert.equal(h.image.src,artwork('first').thumbnail);assert.equal(h.hasTimer(),false);
});

test('a viewing-image failure keeps the thumbnail and original link usable',t=>{
  const h=setup(t);const art=artwork('first');h.viewer.load(art);h.requests[0].onerror();
  assert.equal(h.image.src,art.thumbnail);assert.equal(h.image.hidden,false);
  assert.equal(h.error.hidden,false);assert.equal(h.loading.hidden,true);
  assert.equal(h.originalLink.href,art.src);
});

test('prefetches only the next optimized view at low priority after current image loads',async t=>{
  const next=artwork('next');const h=setup(t,next);h.viewer.load(artwork('first'));
  assert.equal(h.requests.length,1);await h.requests[0].onload();h.runTimer();
  assert.equal(h.requests.length,2);assert.equal(h.requests[1].src,next.display);
  assert.equal(h.requests[1].fetchPriority,'low');
});

test('does not prefetch a large original when the next artwork has no optimized view',async t=>{
  const h=setup(t,{src:'https://example.com/large.png'});h.viewer.load(artwork('first'));
  await h.requests[0].onload();h.runTimer();assert.equal(h.requests.length,1);
});

test('does not prefetch on data saver or slow mobile connections',async t=>{
  const h=setup(t,artwork('next'),{saveData:true,effectiveType:'4g'});h.viewer.load(artwork('first'));
  await h.requests[0].onload();assert.equal(h.hasTimer(),false);assert.equal(h.requests.length,1);
});

test('does not prefetch on a slow 2G connection',async t=>{
  const h=setup(t,artwork('next'),{saveData:false,effectiveType:'2g'});h.viewer.load(artwork('first'));
  await h.requests[0].onload();assert.equal(h.hasTimer(),false);assert.equal(h.requests.length,1);
});

const fs=require("fs");const src=fs.readFileSync("src/ohr_engine.js","utf8");
const a=src.indexOf("function ohrResampler(fs){"),b=src.indexOf("// --- pitch of the voice");eval(src.slice(a,b)+";globalThis.ohrResampler=ohrResampler");
function run(f,alpha,fsIn=48000,sec=1){const rs=ohrResampler(fsIn);rs.setAlpha(alpha);const out=[];const n=fsIn*sec;const x=new Float32Array(n);for(let i=0;i<n;i++)x[i]=Math.sin(2*Math.PI*f*i/fsIn);
 for(let i=0;i<n;i+=2048){const y=rs.push(x.subarray(i,Math.min(n,i+2048)));for(const v of y)out.push(v)}
 // measure: rms and dominant frequency by zero crossings
 const y=out.slice(2000,out.length-2000);let e=0,zc=0;for(let i=1;i<y.length;i++){e+=y[i]*y[i];if(y[i-1]<0&&y[i]>=0)zc++}
 return{n:out.length,rms:Math.sqrt(e/y.length).toFixed(4),freq:Math.round(zc/(y.length/16000))}}
console.log("1 kHz, α=1    :",JSON.stringify(run(1000,1)),"(expect rms 0.707, 1000 Hz, 16000 samples)");
console.log("1 kHz, α=1.1  :",JSON.stringify(run(1000,1.1)),"(expect 909 Hz, 17600 samples)");
console.log("3 kHz, α=1    :",JSON.stringify(run(3000,1)));
console.log("7 kHz, α=1    :",JSON.stringify(run(7000,1)),"(pass band edge)");
console.log("10 kHz, α=1   :",JSON.stringify(run(10000,1)),"(must be removed: would alias to 6 kHz)");
console.log("12 kHz, α=1   :",JSON.stringify(run(12000,1)),"(must be removed)");
console.log("1 kHz 44.1k   :",JSON.stringify(run(1000,1,44100)));
console.log("1 kHz 16k in  :",JSON.stringify(run(1000,1,16000)));

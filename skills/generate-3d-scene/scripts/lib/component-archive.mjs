import {gunzipSync} from 'node:zlib';

export function componentArchiveEntries(bytes) {
 const tar=gunzipSync(bytes),entries=new Map();
 for(let at=0;at+512<=tar.length;){const header=tar.subarray(at,at+512);if(header.every(x=>x===0))break;const name=header.subarray(0,100).toString().split('\0')[0],prefix=header.subarray(345,500).toString().split('\0')[0];const length=parseInt(header.subarray(124,136).toString().replace(/\0/g,'').trim(),8);if(!Number.isSafeInteger(length)||length<0||at+512+length>tar.length)throw Error('无效tgz条目');const key=prefix?prefix+'/'+name:name;if(['0','\0'].includes(String.fromCharCode(header[156])))entries.set(key,tar.subarray(at+512,at+512+length));at+=512+Math.ceil(length/512)*512;}
 return entries;
}

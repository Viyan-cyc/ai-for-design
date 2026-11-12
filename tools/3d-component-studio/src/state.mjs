import {validatePreset} from './contract.mjs';
// Validate and prepare a detached preview first. Only the latest request may commit.
export class StudioState {
 constructor(initial,prepare){this.value=validatePreset(initial);this.prepare=prepare;this.ticket=0;this.preview=null;}
 snapshot(){return structuredClone(this.value);}
 async replace(load){const ticket=++this.ticket;let value;try{value=validatePreset(await load());}catch(error){if(ticket!==this.ticket)return false;throw error;}if(ticket!==this.ticket)return false;const candidate=await this.prepare(value);if(ticket!==this.ticket){candidate.dispose();return false;}const previous=this.preview;try{candidate.mount();}catch(e){candidate.dispose();throw e;}this.preview=candidate;this.value=value;previous?.dispose();return true;}
 dispose(){this.ticket++;this.preview?.dispose();this.preview=null;}
}

export class Sound {
  constructor(){this.muted=false;this.ctx=null;}
  unlock(){if(this.muted)return;try{this.ctx??=new(window.AudioContext||window.webkitAudioContext)();this.ctx.resume();}catch{}}
  play(kind){if(this.muted||!this.ctx||this.ctx.state!=='running')return;const c=this.ctx,now=c.currentTime;
    const notes=kind==='win'?[392,494,587,784]:kind==='hit'?[130,90]:kind==='throw'?[340,180]:kind==='pickup'?[587,784]:kind==='roll'?[170,110]:[520];
    notes.forEach((hz,i)=>{const o=c.createOscillator(),g=c.createGain();o.type=kind==='hit'?'triangle':'sine';o.frequency.setValueAtTime(hz,now+i*.075);o.frequency.exponentialRampToValueAtTime(hz*.7,now+i*.075+.14);g.gain.setValueAtTime(.0001,now+i*.075);g.gain.exponentialRampToValueAtTime(.07,now+i*.075+.01);g.gain.exponentialRampToValueAtTime(.0001,now+i*.075+.18);o.connect(g);g.connect(c.destination);o.start(now+i*.075);o.stop(now+i*.075+.2);});
  }
}

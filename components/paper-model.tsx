'use client';

import { useState } from 'react';

export default function PaperModel() {
  const [raised, setRaised] = useState(true);
  return <div className={`city-model ${raised ? 'is-raised' : 'is-flat'}`}>
    <span className="model-edition">FIG. 01 / A CITY IN THE MAKING</span>
    <div className="model-stage" aria-hidden="true" onPointerMove={event => {
      if (event.pointerType !== 'mouse' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      const rect = event.currentTarget.getBoundingClientRect();
      event.currentTarget.style.setProperty('--lean', `${((event.clientX - rect.left) / rect.width - .5) * 10}deg`);
    }} onPointerLeave={event => event.currentTarget.style.setProperty('--lean', '0deg')}>
      <svg className="model-contours" viewBox="0 0 420 250" fill="none">
        {[0,1,2,3,4,5,6].map(index => <path key={index} d={`M ${-80+index*13} ${165+index*12} C ${35+index*12} ${60+index*3}, ${125+index*15} ${265-index*7}, ${250+index*16} ${102+index*9} S 450 ${60+index*9}, 490 ${110+index*13}`} />)}
        <path className="model-route" d="M80 185 Q115 210 180 170 T315 144"/>
        <circle cx="80" cy="185" r="4"/><circle cx="315" cy="144" r="4"/>
      </svg>
      <div className="paper-sculpture"><div className="paper-building building-one"><i/><b/><span/></div><div className="paper-building building-two"><i/><b/><span/></div><div className="paper-building building-three"><i/><b/><span/></div><div className="sculpture-ground"/></div>
      <span className="model-axis">N <span>↑</span></span>
      <span className="model-caption">{raised ? 'A possibility takes shape.' : 'Every place begins with a plan.'}</span>
    </div>
    <div className="model-switch" role="group" aria-label="Illustrative city model">
      <button aria-pressed={!raised} onClick={() => setRaised(false)}><span>01</span> On paper</button>
      <button aria-pressed={raised} onClick={() => setRaised(true)}><span>02</span> In place</button>
    </div>
    <span className="model-disclaimer">An illustration. Explore real projects below.</span>
  </div>;
}

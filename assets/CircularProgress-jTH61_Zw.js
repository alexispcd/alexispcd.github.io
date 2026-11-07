import{$n as e,Bn as t,Kn as n,Rn as r,Vn as i,ar as a,br as o,cn as s,cr as c,er as l,lr as u,qn as d,tr as f,wr as p,zn as m}from"./index-Q08Tfc3f.js";var h=d,g=p(o(),1);function _(e){return l(`MuiCircularProgress`,e)}e(`MuiCircularProgress`,[`root`,`determinate`,`indeterminate`,`colorPrimary`,`colorSecondary`,`svg`,`track`,`circle`,`circleDisableShrink`]);var v=a(),y=44,b=u`
  0% {
    transform: rotate(0deg);
  }

  100% {
    transform: rotate(360deg);
  }
`,x=u`
  0% {
    stroke-dasharray: 1px, 200px;
    stroke-dashoffset: 0;
  }

  50% {
    stroke-dasharray: 100px, 200px;
    stroke-dashoffset: -15px;
  }

  100% {
    stroke-dasharray: 1px, 200px;
    stroke-dashoffset: -126px;
  }
`,S=typeof b==`string`?null:c`
        animation: ${b} 1.4s linear infinite;
      `,C=typeof x==`string`?null:c`
        animation: ${x} 1.4s ease-in-out infinite;
      `,w=e=>{let{classes:r,variant:i,color:a,disableShrink:o}=e;return n({root:[`root`,i,`color${t(a)}`],svg:[`svg`],track:[`track`],circle:[`circle`,o&&`circleDisableShrink`]},_,r)},T=i(`span`,{name:`MuiCircularProgress`,slot:`Root`,overridesResolver:(e,n)=>{let{ownerState:r}=e;return[n.root,n[r.variant],n[`color${t(r.color)}`]]}})(m(({theme:e})=>({display:`inline-block`,variants:[{props:{variant:`determinate`},style:{transition:e.transitions.create(`transform`)}},{props:{variant:`indeterminate`},style:S||{animation:`${b} 1.4s linear infinite`}},...Object.entries(e.palette).filter(s()).map(([t])=>({props:{color:t},style:{color:(e.vars||e).palette[t].main}}))]}))),E=i(`svg`,{name:`MuiCircularProgress`,slot:`Svg`})({display:`block`}),D=i(`circle`,{name:`MuiCircularProgress`,slot:`Circle`,overridesResolver:(e,t)=>{let{ownerState:n}=e;return[t.circle,n.disableShrink&&t.circleDisableShrink]}})(m(({theme:e})=>({stroke:`currentColor`,variants:[{props:{variant:`determinate`},style:{transition:e.transitions.create(`stroke-dashoffset`)}},{props:{variant:`indeterminate`},style:{strokeDasharray:`80px, 200px`,strokeDashoffset:0}},{props:({ownerState:e})=>e.variant===`indeterminate`&&!e.disableShrink,style:C||{animation:`${x} 1.4s ease-in-out infinite`}}]}))),O=i(`circle`,{name:`MuiCircularProgress`,slot:`Track`})(m(({theme:e})=>({stroke:`currentColor`,opacity:(e.vars||e).palette.action.activatedOpacity}))),k=g.forwardRef(function(e,t){let n=r({props:e,name:`MuiCircularProgress`}),{className:i,color:a=`primary`,disableShrink:o=!1,enableTrackSlot:s=!1,min:c,max:l,size:u=40,style:d,thickness:p=3.6,value:m=n.min??0,variant:h=`indeterminate`,...g}=n,_=c??0,b=l??100,x={...n,color:a,disableShrink:o,size:u,thickness:p,value:m,variant:h,enableTrackSlot:s},S=w(x),C={},k={},A={};if(h===`determinate`){let e=2*Math.PI*((y-p)/2),t=b-_;C.strokeDasharray=e.toFixed(3),C.strokeDashoffset=t>0?`${((b-m)/t*e).toFixed(3)}px`:`${e.toFixed(3)}px`,k.transform=`rotate(-90deg)`,A[`aria-valuenow`]=m,A[`aria-valuemin`]=_,A[`aria-valuemax`]=b}return(0,v.jsx)(T,{className:f(S.root,i),style:{width:u,height:u,...k,...d},ownerState:x,ref:t,role:`progressbar`,...A,...g,children:(0,v.jsxs)(E,{className:S.svg,ownerState:x,viewBox:`${y/2} ${y/2} ${y} ${y}`,children:[s?(0,v.jsx)(O,{className:S.track,ownerState:x,cx:y,cy:y,r:(y-p)/2,fill:`none`,strokeWidth:p,"aria-hidden":`true`}):null,(0,v.jsx)(D,{className:S.circle,style:C,ownerState:x,cx:y,cy:y,r:(y-p)/2,fill:`none`,strokeWidth:p})]})})});export{h as n,k as t};
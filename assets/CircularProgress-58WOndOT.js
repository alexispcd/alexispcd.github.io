import{$t as e,Cn as t,Pn as n,Qt as r,Rn as i,Sn as a,St as o,en as s,hn as c,mn as l,on as u,pn as d,sn as f,tn as p,yn as m}from"./index-Cj_PAS3k.js";var h=f,g=i(n(),1);function _(e){return l(`MuiCircularProgress`,e)}d(`MuiCircularProgress`,[`root`,`determinate`,`indeterminate`,`colorPrimary`,`colorSecondary`,`svg`,`track`,`circle`,`circleDisableShrink`]);var v=m(),y=44,b=t`
  0% {
    transform: rotate(0deg);
  }

  100% {
    transform: rotate(360deg);
  }
`,x=t`
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
`,S=typeof b==`string`?null:a`
        animation: ${b} 1.4s linear infinite;
      `,C=typeof x==`string`?null:a`
        animation: ${x} 1.4s ease-in-out infinite;
      `,w=e=>{let{classes:t,variant:n,color:r,disableShrink:i}=e;return u({root:[`root`,n,`color${s(r)}`],svg:[`svg`],track:[`track`],circle:[`circle`,i&&`circleDisableShrink`]},_,t)},T=p(`span`,{name:`MuiCircularProgress`,slot:`Root`,overridesResolver:(e,t)=>{let{ownerState:n}=e;return[t.root,t[n.variant],t[`color${s(n.color)}`]]}})(e(({theme:e})=>({display:`inline-block`,variants:[{props:{variant:`determinate`},style:{transition:e.transitions.create(`transform`)}},{props:{variant:`indeterminate`},style:S||{animation:`${b} 1.4s linear infinite`}},...Object.entries(e.palette).filter(o()).map(([t])=>({props:{color:t},style:{color:(e.vars||e).palette[t].main}}))]}))),E=p(`svg`,{name:`MuiCircularProgress`,slot:`Svg`})({display:`block`}),D=p(`circle`,{name:`MuiCircularProgress`,slot:`Circle`,overridesResolver:(e,t)=>{let{ownerState:n}=e;return[t.circle,n.disableShrink&&t.circleDisableShrink]}})(e(({theme:e})=>({stroke:`currentColor`,variants:[{props:{variant:`determinate`},style:{transition:e.transitions.create(`stroke-dashoffset`)}},{props:{variant:`indeterminate`},style:{strokeDasharray:`80px, 200px`,strokeDashoffset:0}},{props:({ownerState:e})=>e.variant===`indeterminate`&&!e.disableShrink,style:C||{animation:`${x} 1.4s ease-in-out infinite`}}]}))),O=p(`circle`,{name:`MuiCircularProgress`,slot:`Track`})(e(({theme:e})=>({stroke:`currentColor`,opacity:(e.vars||e).palette.action.activatedOpacity}))),k=g.forwardRef(function(e,t){let n=r({props:e,name:`MuiCircularProgress`}),{className:i,color:a=`primary`,disableShrink:o=!1,enableTrackSlot:s=!1,min:l,max:u,size:d=40,style:f,thickness:p=3.6,value:m=n.min??0,variant:h=`indeterminate`,...g}=n,_=l??0,b=u??100,x={...n,color:a,disableShrink:o,size:d,thickness:p,value:m,variant:h,enableTrackSlot:s},S=w(x),C={},k={},A={};if(h===`determinate`){let e=2*Math.PI*((y-p)/2),t=b-_;C.strokeDasharray=e.toFixed(3),C.strokeDashoffset=t>0?`${((b-m)/t*e).toFixed(3)}px`:`${e.toFixed(3)}px`,k.transform=`rotate(-90deg)`,A[`aria-valuenow`]=m,A[`aria-valuemin`]=_,A[`aria-valuemax`]=b}return(0,v.jsx)(T,{className:c(S.root,i),style:{width:d,height:d,...k,...f},ownerState:x,ref:t,role:`progressbar`,...A,...g,children:(0,v.jsxs)(E,{className:S.svg,ownerState:x,viewBox:`${y/2} ${y/2} ${y} ${y}`,children:[s?(0,v.jsx)(O,{className:S.track,ownerState:x,cx:y,cy:y,r:(y-p)/2,fill:`none`,strokeWidth:p,"aria-hidden":`true`}):null,(0,v.jsx)(D,{className:S.circle,style:C,ownerState:x,cx:y,cy:y,r:(y-p)/2,fill:`none`,strokeWidth:p})]})})});export{h as n,k as t};
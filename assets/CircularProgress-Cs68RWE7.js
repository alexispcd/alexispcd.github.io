import{$t as e,In as t,Mn as n,Qt as r,Sn as i,Zt as a,an as o,en as s,fn as c,mn as l,on as u,pn as d,vn as f,xn as p,xt as m}from"./index-BeN-VT6X.js";var h=u,g=t(n(),1);function _(e){return d(`MuiCircularProgress`,e)}c(`MuiCircularProgress`,[`root`,`determinate`,`indeterminate`,`colorPrimary`,`colorSecondary`,`svg`,`track`,`circle`,`circleDisableShrink`]);var v=f(),y=44,b=i`
  0% {
    transform: rotate(0deg);
  }

  100% {
    transform: rotate(360deg);
  }
`,x=i`
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
`,S=typeof b==`string`?null:p`
        animation: ${b} 1.4s linear infinite;
      `,C=typeof x==`string`?null:p`
        animation: ${x} 1.4s ease-in-out infinite;
      `,w=t=>{let{classes:n,variant:r,color:i,disableShrink:a}=t;return o({root:[`root`,r,`color${e(i)}`],svg:[`svg`],track:[`track`],circle:[`circle`,a&&`circleDisableShrink`]},_,n)},T=s(`span`,{name:`MuiCircularProgress`,slot:`Root`,overridesResolver:(t,n)=>{let{ownerState:r}=t;return[n.root,n[r.variant],n[`color${e(r.color)}`]]}})(r(({theme:e})=>({display:`inline-block`,variants:[{props:{variant:`determinate`},style:{transition:e.transitions.create(`transform`)}},{props:{variant:`indeterminate`},style:S||{animation:`${b} 1.4s linear infinite`}},...Object.entries(e.palette).filter(m()).map(([t])=>({props:{color:t},style:{color:(e.vars||e).palette[t].main}}))]}))),E=s(`svg`,{name:`MuiCircularProgress`,slot:`Svg`})({display:`block`}),D=s(`circle`,{name:`MuiCircularProgress`,slot:`Circle`,overridesResolver:(e,t)=>{let{ownerState:n}=e;return[t.circle,n.disableShrink&&t.circleDisableShrink]}})(r(({theme:e})=>({stroke:`currentColor`,variants:[{props:{variant:`determinate`},style:{transition:e.transitions.create(`stroke-dashoffset`)}},{props:{variant:`indeterminate`},style:{strokeDasharray:`80px, 200px`,strokeDashoffset:0}},{props:({ownerState:e})=>e.variant===`indeterminate`&&!e.disableShrink,style:C||{animation:`${x} 1.4s ease-in-out infinite`}}]}))),O=s(`circle`,{name:`MuiCircularProgress`,slot:`Track`})(r(({theme:e})=>({stroke:`currentColor`,opacity:(e.vars||e).palette.action.activatedOpacity}))),k=g.forwardRef(function(e,t){let n=a({props:e,name:`MuiCircularProgress`}),{className:r,color:i=`primary`,disableShrink:o=!1,enableTrackSlot:s=!1,min:c,max:u,size:d=40,style:f,thickness:p=3.6,value:m=n.min??0,variant:h=`indeterminate`,...g}=n,_=c??0,b=u??100,x={...n,color:i,disableShrink:o,size:d,thickness:p,value:m,variant:h,enableTrackSlot:s},S=w(x),C={},k={},A={};if(h===`determinate`){let e=2*Math.PI*((y-p)/2),t=b-_;C.strokeDasharray=e.toFixed(3),C.strokeDashoffset=t>0?`${((b-m)/t*e).toFixed(3)}px`:`${e.toFixed(3)}px`,k.transform=`rotate(-90deg)`,A[`aria-valuenow`]=m,A[`aria-valuemin`]=_,A[`aria-valuemax`]=b}return(0,v.jsx)(T,{className:l(S.root,r),style:{width:d,height:d,...k,...f},ownerState:x,ref:t,role:`progressbar`,...A,...g,children:(0,v.jsxs)(E,{className:S.svg,ownerState:x,viewBox:`${y/2} ${y/2} ${y} ${y}`,children:[s?(0,v.jsx)(O,{className:S.track,ownerState:x,cx:y,cy:y,r:(y-p)/2,fill:`none`,strokeWidth:p,"aria-hidden":`true`}):null,(0,v.jsx)(D,{className:S.circle,style:C,ownerState:x,cx:y,cy:y,r:(y-p)/2,fill:`none`,strokeWidth:p})]})})});export{h as n,k as t};
import{Et as e,Mt as t,Nt as n,Tt as r,Ut as i,V as a,_t as o,dt as s,ft as c,kt as l,pt as u,qt as d,ut as f,wt as p,yt as m}from"./index-BTLqvDPG.js";var h=d(i(),1);function g(e){return r(`MuiLinearProgress`,e)}p(`MuiLinearProgress`,[`root`,`colorPrimary`,`colorSecondary`,`determinate`,`indeterminate`,`buffer`,`query`,`dashed`,`bar`,`bar1`,`bar2`]);var _=l(),v=4,y=n`
  0% {
    left: -35%;
    right: 100%;
  }

  60% {
    left: 100%;
    right: -90%;
  }

  100% {
    left: 100%;
    right: -90%;
  }
`,b=typeof y==`string`?null:t`
        animation: ${y} 2.1s cubic-bezier(0.65, 0.815, 0.735, 0.395) infinite;
      `,x=n`
  0% {
    left: -200%;
    right: 100%;
  }

  60% {
    left: 107%;
    right: -8%;
  }

  100% {
    left: 107%;
    right: -8%;
  }
`,S=typeof x==`string`?null:t`
        animation: ${x} 2.1s cubic-bezier(0.165, 0.84, 0.44, 1) 1.15s infinite;
      `,C=n`
  0% {
    opacity: 1;
    background-position: 0 -23px;
  }

  60% {
    opacity: 0;
    background-position: 0 -23px;
  }

  100% {
    opacity: 1;
    background-position: -200px -23px;
  }
`,w=typeof C==`string`?null:t`
        animation: ${C} 3s infinite linear;
      `,T=e=>{let{classes:t,variant:n,color:r}=e;return o({root:[`root`,`color${c(r)}`,n],dashed:[`dashed`],bar1:[`bar`,`bar1`],bar2:[`bar`,`bar2`,n===`buffer`&&`color${c(r)}`]},g,t)},E=(e,t)=>e.vars?e.vars.palette.LinearProgress[`${t}Bg`]:e.palette.mode===`light`?e.lighten(e.palette[t].main,.62):e.darken(e.palette[t].main,.5),D=u(`span`,{name:`MuiLinearProgress`,slot:`Root`,overridesResolver:(e,t)=>{let{ownerState:n}=e;return[t.root,t[`color${c(n.color)}`],t[n.variant]]}})(s(({theme:e})=>({position:`relative`,overflow:`hidden`,display:`block`,height:4,zIndex:0,"@media print":{colorAdjust:`exact`},variants:[...Object.entries(e.palette).filter(a()).map(([t])=>({props:{color:t},style:{backgroundColor:E(e,t)}})),{props:({ownerState:e})=>e.color===`inherit`&&e.variant!==`buffer`,style:{"&::before":{content:`""`,position:`absolute`,left:0,top:0,right:0,bottom:0,backgroundColor:`currentColor`,opacity:.3}}},{props:{variant:`buffer`},style:{backgroundColor:`transparent`}},{props:{variant:`query`},style:{transform:`rotate(180deg)`}}]}))),O=u(`span`,{name:`MuiLinearProgress`,slot:`Dashed`})(s(({theme:e})=>({position:`absolute`,marginTop:0,height:`100%`,width:`100%`,backgroundSize:`10px 10px`,backgroundPosition:`0 -23px`,variants:[{props:{color:`inherit`},style:{opacity:.3,backgroundImage:`radial-gradient(currentColor 0%, currentColor 16%, transparent 42%)`}},...Object.entries(e.palette).filter(a()).map(([t])=>{let n=E(e,t);return{props:{color:t},style:{backgroundImage:`radial-gradient(${n} 0%, ${n} 16%, transparent 42%)`}}})]})),w||{animation:`${C} 3s infinite linear`}),k=u(`span`,{name:`MuiLinearProgress`,slot:`Bar1`,overridesResolver:(e,t)=>[t.bar,t.bar1]})(s(({theme:e})=>({width:`100%`,position:`absolute`,left:0,bottom:0,top:0,transition:`transform 0.2s linear`,transformOrigin:`left`,variants:[{props:{color:`inherit`},style:{backgroundColor:`currentColor`}},...Object.entries(e.palette).filter(a()).map(([t])=>({props:{color:t},style:{backgroundColor:(e.vars||e).palette[t].main}})),{props:{variant:`determinate`},style:{transition:`transform .${v}s linear`}},{props:{variant:`buffer`},style:{zIndex:1,transition:`transform .${v}s linear`}},{props:({ownerState:e})=>e.variant===`indeterminate`||e.variant===`query`,style:{width:`auto`}},{props:({ownerState:e})=>e.variant===`indeterminate`||e.variant===`query`,style:b||{animation:`${y} 2.1s cubic-bezier(0.65, 0.815, 0.735, 0.395) infinite`}}]}))),A=u(`span`,{name:`MuiLinearProgress`,slot:`Bar2`,overridesResolver:(e,t)=>[t.bar,t.bar2]})(s(({theme:e})=>({width:`100%`,position:`absolute`,left:0,bottom:0,top:0,transition:`transform 0.2s linear`,transformOrigin:`left`,variants:[...Object.entries(e.palette).filter(a()).map(([t])=>({props:{color:t},style:{"--LinearProgressBar2-barColor":(e.vars||e).palette[t].main}})),{props:({ownerState:e})=>e.variant!==`buffer`&&e.color!==`inherit`,style:{backgroundColor:`var(--LinearProgressBar2-barColor, currentColor)`}},{props:({ownerState:e})=>e.variant!==`buffer`&&e.color===`inherit`,style:{backgroundColor:`currentColor`}},{props:{color:`inherit`},style:{opacity:.3}},...Object.entries(e.palette).filter(a()).map(([t])=>({props:{color:t,variant:`buffer`},style:{backgroundColor:E(e,t),transition:`transform .${v}s linear`}})),{props:({ownerState:e})=>e.variant===`indeterminate`||e.variant===`query`,style:{width:`auto`}},{props:({ownerState:e})=>e.variant===`indeterminate`||e.variant===`query`,style:S||{animation:`${x} 2.1s cubic-bezier(0.165, 0.84, 0.44, 1) 1.15s infinite`}}]}))),j=h.forwardRef(function(t,n){let r=f({props:t,name:`MuiLinearProgress`}),{className:i,color:a=`primary`,max:o,min:s,value:c,valueBuffer:l,variant:u=`indeterminate`,...d}=r,p={...r,color:a,variant:u},h=s??0,g=o??100,v=T(p),y=m(),b={},x={bar1:{},bar2:{}};if((u===`determinate`||u===`buffer`)&&c!==void 0){let e=g-h,t=(c-h)/e*100-100;y&&(t=-t),x.bar1.transform=e>0?`translateX(${t}%)`:`translateX(-100%)`,b[`aria-valuenow`]=c,b[`aria-valuemin`]=h,b[`aria-valuemax`]=g}if(u===`buffer`&&l!==void 0){let e=g-h,t=(l-h)/e*100-100;y&&(t=-t),x.bar2.transform=e>0?`translateX(${t}%)`:`translateX(-100%)`}return(0,_.jsxs)(D,{className:e(v.root,i),ownerState:p,role:`progressbar`,...b,ref:n,...d,children:[u===`buffer`?(0,_.jsx)(O,{className:v.dashed,ownerState:p}):null,(0,_.jsx)(k,{className:v.bar1,ownerState:p,style:x.bar1}),u===`determinate`?null:(0,_.jsx)(A,{className:v.bar2,ownerState:p,style:x.bar2})]})});export{j as t};
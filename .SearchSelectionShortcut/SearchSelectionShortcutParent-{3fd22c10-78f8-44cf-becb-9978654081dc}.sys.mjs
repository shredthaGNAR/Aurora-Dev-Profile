"use strict";import{XPCOMUtils}from"resource://gre/modules/XPCOMUtils.sys.mjs";const lazy={};XPCOMUtils.defineLazyModuleGetters(lazy,{BrowserWindowTracker:"resource:///modules/BrowserWindowTracker.jsm",PrivateBrowsingUtils:"resource://gre/modules/PrivateBrowsingUtils.jsm",E10SUtils:"resource://gre/modules/E10SUtils.jsm"});XPCOMUtils.defineLazyPreferenceGetter(lazy,"CUSTOM_MATCHES","userChrome.searchSelectionShortcut.custom-matches","{}",null,(val=>JSON.parse(val)));const{WebExtensionPolicy}=Cu.getGlobalForObject(Services);const schemes=/^http|https|ftp$/;const base=host=>{let domain;try{domain=Services.eTLD.getBaseDomainFromHost(host)}catch(e){}return domain};export class SearchSelectionShortcutParent extends JSWindowActorParent{get browser(){return this.browsingContext.top.embedderElement}getEngineTemplate(e){const engineURL=e._getURLOfType("text/html");return engineURL.params.length>0?e._searchForm:engineURL.template}async getMatchingEngine(match,url,host,check=true){if(!match)return null;let preferred;let uri=Services.io.newURI(url);if(check){if(url in lazy.CUSTOM_MATCHES)preferred=lazy.CUSTOM_MATCHES[url];if(!preferred&&host in lazy.CUSTOM_MATCHES)preferred=lazy.CUSTOM_MATCHES[host];if(!preferred&&!host){try{preferred=lazy.CUSTOM_MATCHES[uri.prePath+uri.filePath]}catch(e){}}if(preferred){const engine=Services.search.getEngineByName(preferred);if(engine&&!engine.hidden)return engine}}const visibleEngines=await Services.search.getVisibleEngines();let originalHost;if(preferred&&/.+\..+/.test(preferred)){originalHost=host;host=preferred}let engines=visibleEngines.filter((engine=>engine.getResultDomain()==host));if(!engines.length){const baseHost=base(host);if(baseHost||!preferred)engines=visibleEngines.filter((engine=>base(engine.getResultDomain())==baseHost))}if(originalHost&&!engines.length){try{const fixup=Services.uriFixup.getFixupURIInfo(preferred,Ci.nsIURIFixup.FIXUP_FLAG_FIX_SCHEME_TYPOS);uri=fixup.fixedURI;engines=visibleEngines.filter((engine=>engine.getResultDomain()==uri.host))}catch(e){}if(!engines.length)return this.getMatchingEngine(match,url,originalHost,false)}if(engines.length>1){engines.sort(((a,b)=>{const uriA=Services.io.newURI(this.getEngineTemplate(a)),uriB=Services.io.newURI(this.getEngineTemplate(b)),cmnA=this.commonLength(uri,uriA),cmnB=this.commonLength(uri,uriB);return cmnB.host-cmnA.host||cmnB.path-cmnA.path||cmnB.query-cmnA.query}))}return engines[0]}commonLength(x,y){if(!(x?.spec&&y?.spec))return 0;let xh="",yh="";try{xh=x.host}catch(e){}try{yh=y.host}catch(e){}let xf=x.filePath,yf=y.filePath,xs=x.scheme,ys=y.scheme||"https",xq=x.query,yq=y.query,i=0,k=0,len=xh.length,sq="";if(xs!=ys&&!(schemes.test(xs)&&schemes.test(ys)))return 0;while(k<len&&xh.charAt(len-k)===yh.charAt(yh.length-k))k++;while(i<xf.length&&xf.charAt(i)===yf.charAt(i))i++;if(xq&&yq){let xa=xq.split("&"),ya=yq.split("&"),qp;ya=ya.filter((p=>{if(p.endsWith("{searchTerms}")){qp=p.replace(/{searchTerms}/,"");return}return true}));xa=xa.filter((p=>!(qp&&p.startsWith(qp))));sq=xa.filter((p=>ya.includes(p)))}return{host:xh.substring(len-k,len).length,path:xf.substring(0,i).length,query:sq.length}}stripURLPrefix(str){const match=/^[a-z]+:(?:\/){0,2}/i.exec(str);if(!match)return["",str];let prefix=match[0];if(prefix.length<str.length&&str[prefix.length]==" ")return["",str];return[prefix,str.substr(prefix.length)]}getFixupInfo(text){let fixupInfo,fixupError;try{let flags=Ci.nsIURIFixup.FIXUP_FLAG_FIX_SCHEME_TYPOS|Ci.nsIURIFixup.FIXUP_FLAG_ALLOW_KEYWORD_LOOKUP;const info=Services.uriFixup.getFixupURIInfo(text,flags);if(lazy.PrivateBrowsingUtils.isWindowPrivate(this.browser.ownerGlobal))flags|=Ci.nsIURIFixup.FIXUP_FLAG_PRIVATE_CONTEXT;fixupInfo={uri:info.fixedURI,href:info.fixedURI.spec,isSearch:!!info.keywordAsSent}}catch(e){fixupError=e.result}return{info:fixupInfo,error:fixupError}}parseURL(text){try{const str=Services.textToSubURI.unEscapeURIForUI(text);const[prefix,suffix]=this.stripURLPrefix(str);if(!suffix&&prefix)return null;const fixup=this.getFixupInfo(text);if(fixup.error)return null;if(!fixup.info?.href||fixup.info?.isSearch)return null;const{uri}=fixup.info;const url=new URL(fixup.info.href);const hostExpected=["http:","https:","ftp:","chrome:"].includes(url.protocol);if(hostExpected&&!url.host)return null;return{uri,url,href:url.toString()}}catch(e){return null}}async receiveMessage(msg){const browser=this.manager.rootFrameLoader.ownerElement,win=browser.ownerGlobal,{data,target}=msg,{windowContext,browsingContext}=target;if(browsingContext.topChromeWindow!==lazy.BrowserWindowTracker.getTopWindow())return;const{text,locationURL,locationHost,match,frameID}=data;const csp=lazy.E10SUtils.deserializeCSP(data.csp),principal=windowContext.documentPrincipal||Services.scriptSecurityManager.createNullPrincipal({userContextId:win.gBrowser.selectedBrowser.getAttribute("userContextId")});let options={inBackground:Services.prefs.getBoolPref("browser.search.context.loadInBackground",true),triggeringPrincipal:principal,relatedToCurrent:true,allowThirdPartyFixup:true,frameID};const where=locationURL.startsWith(win.BROWSER_NEW_TAB_URL)?"current":"tab";if(!match){const parsed=this.parseURL(text);if(parsed){const{uri}=parsed;let canon=true;let host="";try{host=uri.host}catch(e){}switch(uri.scheme){case"moz-extension":const policy=WebExtensionPolicy.getByHostname(host);if(policy){const extPrincipal=policy&&policy.extension.principal;if(extPrincipal)options.triggeringPrincipal=extPrincipal}else canon=false;break;case"about":canon=lazy.E10SUtils.getAboutModule(uri);options.triggeringPrincipal=Services.scriptSecurityManager.getSystemPrincipal();break;case"chrome":case"resource":if(!host){canon=false;break}case"file":options.triggeringPrincipal=Services.scriptSecurityManager.getSystemPrincipal();break;case"data":if(!uri.filePath.includes(",")){canon=false;break}options.forceAllowDataURI=true;options.triggeringPrincipal=Services.scriptSecurityManager.createNullPrincipal({userContextId:win.gBrowser.selectedBrowser.getAttribute("userContextId")});break;case"javascript":canon=false;break;default:options.referrerInfo=lazy.E10SUtils.deserializeReferrerInfo(data.referrerInfo);break}if(!!canon)return win.openLinkIn(parsed.href,where,options)}}const engine=await this.getMatchingEngine(match,locationURL,locationHost);win.BrowserSearch._loadSearch(text,where,false,null,principal,csp,options.inBackground,engine)}}
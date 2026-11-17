import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import QRCode from 'qrcode';
const suffix=randomUUID(),network=`typelune-pg-ci-${suffix}`,database=`typelune-db-${suffix}`,app=`typelune-app-${suffix}`,volume=`typelune-pg-${suffix}`;
const image=process.env.DAZI_TEST_IMAGE||'dazi-ci:local';
const containers=new Set();let hasNetwork=false,hasVolume=false;
const docker=(...args)=>execFileSync('docker',args,{encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim();
const url='postgresql://typelune:ci-only-disposable-password@postgres:5432/typelune';
const env=['-e',`DATABASE_URL=${url}`,'-e','CODE_SECRET=ci-only-not-a-production-secret-123456','-e','DAZI_DATABASE_SCHEMA=public','-e','DAZI_DATABASE_HOST=postgres','-e','DAZI_DATABASE_NAME=typelune','-e','DAZI_CONFIRM_TARGET=postgres/typelune/public'];
async function wait(action){for(let i=0;i<90;i++){try{if(await action())return;}catch{}await delay(500);}throw new Error('Disposable service did not become ready');}
async function post(base,path,body,cookie=''){return fetch(base+path,{method:'POST',headers:{'content-type':'application/json',origin:base,...(cookie?{cookie}:{})},body:JSON.stringify(body)});}
try{
 docker('info');docker('network','create',network);hasNetwork=true;docker('volume','create',volume);hasVolume=true;
 docker('run','-d','--name',database,'--network',network,'--network-alias','postgres','-v',`${volume}:/var/lib/postgresql`,'-e','POSTGRES_USER=typelune','-e','POSTGRES_PASSWORD=ci-only-disposable-password','-e','POSTGRES_DB=typelune','postgres:18.7');containers.add(database);
 await wait(()=>{docker('exec',database,'pg_isready','-U','typelune','-d','typelune');return true;});
 const version=docker('exec',database,'postgres','--version');assert.match(version,/18\./);
 for(const action of ['migrate','support','seo','seed'])docker('run','--rm','--network',network,...env,image,'node','scripts/postgres-database.mjs',action);
 execFileSync('docker',['run','--rm','-i','--network',network,...env,'-e','ADMIN_USERNAME=SupportAdmin','-e','ADMIN_EMAIL=support@example.test',image,'node','scripts/postgres-database.mjs','bootstrap'],{input:'disposable-password-123\n',stdio:['pipe','pipe','pipe']});
 docker('run','-d','--name',app,'--network',network,'-p','127.0.0.1::3001',...env,image);containers.add(app);
 const base=`http://${docker('port',app,'3001/tcp').split('\n')[0]}`;
 await wait(async()=> (await fetch(base+'/api/health')).ok);
 const login=await post(base,'/api/auth/login',{identifier:'SupportAdmin',password:'disposable-password-123'});assert.equal(login.status,200);const cookie=login.headers.get('set-cookie').split(';')[0];
 const png=await QRCode.toDataURL('TypeLune Docker PG18 fixture NOT PAYMENT',{width:256,margin:4});
 assert.equal((await post(base,'/api/admin/support',{revision:0,settings:{enabled:true,alipay:{dataUrl:png},wechat:null}},cookie)).status,200);
 const expected=await(await fetch(base+'/api/site/support')).json();assert.equal(expected.enabled,true);
 assert.equal((await post(base,'/api/admin/support',{revision:1,settings:{enabled:false,alipay:null,wechat:null}})).status,403);
 docker('restart',database);await wait(()=>{docker('exec',database,'pg_isready','-U','typelune','-d','typelune');return true;});docker('restart',app);await wait(async()=> (await fetch(base+'/api/health')).ok);
 assert.deepEqual(await(await fetch(base+'/api/site/support')).json(),expected);
 console.log(`Docker + ${version}: migration, explicit support install, bootstrap, login, QR upload, public read, auth denial and database/app restart persistence passed.`);
}finally{
 for(const name of [...containers].reverse()){try{docker('rm','-f',name);}catch{}}
 if(hasVolume)try{docker('volume','rm',volume);}catch{}
 if(hasNetwork)try{docker('network','rm',network);}catch{}
}

const fs=require('fs');
const env=fs.readFileSync(require('path').join(__dirname,'..','.env'),'utf8');
const tok=env.match(/SUPABASE_MGMT_TOKEN\s*=\s*(.+)/)[1].trim();
const q=process.argv[2];
fetch('https://api.supabase.com/v1/projects/akyzzdwbzgsnhdircuce/database/query',{
  method:'POST',
  headers:{'Authorization':'Bearer '+tok,'Content-Type':'application/json'},
  body:JSON.stringify({query:q})
}).then(r=>r.json()).then(j=>console.log(JSON.stringify(j,null,1))).catch(e=>console.error('ERR',e));

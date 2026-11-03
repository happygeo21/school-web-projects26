// Server-only dual-project verification. Real teachers never become anonymous test students.
export function teacherBridge({verifyToken,testProject,legacyProject,teachers,schools}) {
 const deny=()=>{throw {code:'auth/invalid-token'}};
 if(testProject===legacyProject||teachers.length!==7||new Set(teachers).size!==7)throw Error('Invalid teacher bridge');
 for(const u of teachers)if(!Array.isArray(schools[u])||schools[u].length!==1||!/^S[1-7]$/.test(schools[u][0]))throw Error('Missing school');
 return async token=>{
  let claims;
  try {claims=await verifyToken(token,{projectId:testProject});} catch {
   try {claims=await verifyToken(token,{projectId:legacyProject});}catch{return deny()}
   if(!teachers.includes(claims.sub)||!['password','google.com'].includes(claims.firebase?.sign_in_provider))return deny();
  }
  return claims;
 };
}

window.ENERGY_FIREBASE_CONFIG = {
  apiKey: "AIzaSyBq4SwGFR0mgHiEuluOnEdy9a0oS5o50ow",
  authDomain: "school-project-26-1edf4.firebaseapp.com",
  databaseURL: "https://school-project-26-1edf4-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "school-project-26-1edf4",
  storageBucket: "school-project-26-1edf4.firebasestorage.app",
  messagingSenderId: "1059484913673",
  appId: "1:1059484913673:web:f733d8efeea6a3029328d8",
  measurementId: "G-MNY6QXL8P6"
};
window.ENERGY_APP_SETTINGS = { databaseRoot: "energyMatchV10_3" };

(function(){
  try{
    var p=(location.pathname||'').toLowerCase();
    if(p.endsWith('/student.html') || p.endsWith('student.html')){
      var sc=document.createElement('script');
      sc.src='student-enhancements.js?v=20261007b';
      sc.async=false;
      document.head.appendChild(sc);
    }
  }catch(e){console.warn('student enhancement loader',e);}
})();

// Only served by the localhost mock server, never by the public build.
const role = location.pathname.endsWith("teacher.html")
  ? "mock-teacher"
  : "mock-student";
const user = {
  uid: role,
  isAnonymous: role !== "mock-teacher",
  getIdToken: async () => role,
  getIdTokenResult: async () => ({
    claims: { teacher: role === "mock-teacher" },
  }),
};
let current = user,
  listeners = [];
export const initializeApp = (options) => ({ options });
export const getAuth = () => ({
  get currentUser() {
    return current;
  },
  authStateReady: async () => {},
});
export const getDatabase = () => ({});
export const ref = (db, path = "") => ({ path });
export const push = (r) => {
  const key = "mock-" + crypto.randomUUID();
  return { key, path: r.path + "/" + key };
};
async function request(path, method, data) {
  const r = await fetch(
    "/__mock/db" + (method ? "" : "?path=" + encodeURIComponent(path)),
    {
      method: method ? "POST" : "GET",
      headers: {
        Authorization: "Bearer " + current?.uid,
        "Content-Type": "application/json",
      },
      ...(method ? { body: JSON.stringify({ path, method, data }) } : {}),
    },
  );
  if (!r.ok) throw { code: "PERMISSION_DENIED" };
  return r.json();
}
export const get = async (r) => {
  const value = await request(r.path);
  return { exists: () => value !== null, val: () => value };
};
export const set = (r, data) => request(r.path, "set", data);
export const update = (r, data) => request(r.path, "update", data);
export const remove = (r) => set(r, null);
export const onValue = (r, fn, fail) => {
  let live = true,
    previous;
  const poll = async () => {
    try {
      const value = await request(r.path),
        encoded = JSON.stringify(value);
      if (live && encoded !== previous) {
        previous = encoded;
        fn({ val: () => value });
      }
    } catch (e) {
      if (live) fail?.(e);
    }
  };
  poll();
  const timer = setInterval(poll, 200);
  return () => {
    live = false;
    clearInterval(timer);
  };
};
export const signInAnonymously = async () => ({ user });
export class GoogleAuthProvider {
  setCustomParameters() {}
}
export const signInWithPopup = async () => ({ user });
export const signInWithEmailAndPassword = signInWithPopup;
export const signOut = async () => {
  current = null;
  listeners.forEach((fn) => fn(null));
};
export const onAuthStateChanged = (auth, fn) => {
  listeners.push(fn);
  queueMicrotask(() => fn(current));
  return () => (listeners = listeners.filter((x) => x !== fn));
};

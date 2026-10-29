import { createGateway } from "../../../server/gateway.mjs";
import { verifyFirebaseToken } from "../../../server/firebase-token.mjs";
import { createAdapters } from "../../../server/supabase-adapter.mjs";
const required = (key: string) => {
  const v = Deno.env.get(key);
  if (!v) throw Error("Missing server configuration: " + key);
  return v;
};
const projectId = required("FIREBASE_PROJECT_ID"),
  databaseURL = required("FIREBASE_DATABASE_URL");
// This implementation is for a separate rehearsal project. Production needs a new reviewed change.
if (
  projectId === "school-project-26-1edf4" ||
  databaseURL.includes("school-project-26-1edf4")
)
  throw Error("Production Firebase is forbidden in rehearsal");
const teachers = JSON.parse(required("APPROVED_TEACHER_UIDS")),
  schoolActivityHashes = JSON.parse(required("SCHOOL_ACTIVITY_HASHES")),
  origins = JSON.parse(required("ALLOWED_ORIGINS"));
if (
  !Array.isArray(teachers) ||
  !teachers.length ||
  !Array.isArray(origins) ||
  !origins.length ||
  !origins.every(
    (s: string) =>
      /^https:\/\//.test(s) ||
      /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(s),
  )
)
  throw Error("Invalid allowlists");
const adapters = createAdapters({
  supabaseURL: required("SUPABASE_URL"),
  serviceKey: required("SUPABASE_SERVICE_ROLE_KEY"),
  bucket: "veterans-private",
  databaseURL,
});
Deno.serve(
  createGateway({
    ...adapters,
    teachers,
    schoolActivityHashes,
    origins,
    verify: (token: string) => verifyFirebaseToken(token, { projectId }),
  }),
);

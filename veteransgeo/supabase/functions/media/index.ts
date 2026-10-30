import { createGateway } from "../../../server/gateway.mjs";
import { verifyFirebaseToken } from "../../../server/firebase-token.mjs";
import { createAdapters } from "../../../server/supabase-adapter.mjs";
import { rehearsalTargets } from "../../../server/rehearsal-target.mjs";
import { serverKeyFromEnvironment } from "../../../server/supabase-key.mjs";
const required = (key: string) => {
  const v = Deno.env.get(key);
  if (!v) throw Error("Missing server configuration: " + key);
  return v;
};
const privateJSON = (key: string, fallback?: string) => {
  try { return JSON.parse(fallback === undefined ? required(key) : (Deno.env.get(key) || fallback)); }
  catch { throw Error("Invalid private server configuration"); }
};
const projectId = required("FIREBASE_PROJECT_ID"),
  databaseURL = required("FIREBASE_DATABASE_URL");
const deployment = rehearsalTargets({
  projectId,
  databaseURL,
  supabaseURL: required("SUPABASE_URL"),
});
if (projectId !== "veteransgeo-test-2026" || deployment.supabaseHost !== "jfkjuhxkcctfmwojhpci.supabase.co")
  throw Error("Exact existing rehearsal projects required");
// This implementation is for a separate rehearsal project. Production needs a new reviewed change.
if (
  projectId === "school-project-26-1edf4" ||
  databaseURL.toLowerCase().includes("school-project-26-1edf4")
)
  throw Error("Production Firebase is forbidden in rehearsal");
const teachers = privateJSON("APPROVED_TEACHER_UIDS"),
  schoolActivityHashes = privateJSON("SCHOOL_ACTIVITY_HASHES"),
  origins = privateJSON("ALLOWED_ORIGINS");
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
  serviceKey: serverKeyFromEnvironment((key: string) => Deno.env.get(key)),
  bucket: "veterans-private",
  databaseURL,
});
const inviteMode = Deno.env.get("UPLOAD_AUTH_MODE") === "teacher-invite-link";
Deno.serve(
  createGateway({
    ...adapters,
    uploadInvites: inviteMode ? adapters.inviteStore : null,
    inviteTeacherSchools: inviteMode ? privateJSON("INVITE_TEACHER_SCHOOLS") : {},
    inviteAdminUids: inviteMode ? privateJSON("INVITE_ADMIN_UIDS", "[]") : [],
    teachers,
    schoolActivityHashes,
    schoolUploadHashes: schoolActivityHashes,
    allowLegacyActivityCodeUpload: true, // Rehearsal compatibility only; production never enables this.
    origins,
    deployment,
    verify: (token: string) => verifyFirebaseToken(token, { projectId }),
  }),
);

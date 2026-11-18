// DiveDebrief on Railway (project "outstanding-empathy").
//
// Preview with `railway config plan`, apply with `railway config apply`
// (SDK: `npm install` in this folder). Variables and the public
// *.up.railway.app domains are left unmanaged: they live on Railway
// (`railway variables`, `railway domain`), so SECRET_KEY never enters git.
import { defineRailway, github, postgres, project, service, volume } from "railway/iac";

const REPO = "matthallagan-eng/divedebrief";

export default defineRailway(() => {
  const Postgres = postgres("Postgres", { region: "iad" });
  Postgres.deploy = { multiRegionConfig: { iad: { numReplicas: 1 } } };
  Postgres.networking = { privateNetworkEndpoint: "postgres" };
  const postgresVolume = volume("postgres-volume", { alerts: { usage: { "100": {}, "80": {}, "95": {} } }, allowOnlineResize: true, region: "iad", sizeMB: 5000 });

  // Card and dive photos (settings.upload_dir)
  const uploads = volume("uploads", { region: "iad", sizeMB: 5000, allowOnlineResize: true });

  const api = service("api", {
    source: github(REPO, { branch: "main", checkSuites: false }),
    rootDirectory: "/backend",
    build: { builder: "DOCKERFILE", dockerfilePath: "Dockerfile", watchPatterns: ["/backend/**"] },
    preDeployCommand: ["alembic upgrade head"],
    healthcheckPath: "/health",
    healthcheckTimeout: 120,
    deploy: { restartPolicyType: "ON_FAILURE", restartPolicyMaxRetries: 5 },
    replicas: { "iad": 1 },
    networking: { privateNetworkEndpoint: "divedebrief" },
    volumeMounts: { "/app/data/uploads": uploads },
  });

  const web = service("web", {
    source: github(REPO, { branch: "main", checkSuites: false }),
    rootDirectory: "/frontend",
    build: { builder: "DOCKERFILE", dockerfilePath: "Dockerfile", watchPatterns: ["/frontend/**"] },
    healthcheckPath: "/",
    healthcheckTimeout: 60,
    deploy: { restartPolicyType: "ON_FAILURE", restartPolicyMaxRetries: 5 },
    replicas: { "iad": 1 },
  });

  return project("outstanding-empathy", {
    variables: { managed: false },
    resources: [api, web, Postgres, postgresVolume, uploads],
  });
});

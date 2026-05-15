import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const packagesDirectory = "packages";

const runtimeDependencyFields = ["dependencies", "peerDependencies", "optionalDependencies"];

const forbiddenProtocols = ["catalog:", "workspace:"];
const errors = [];

const getPublishablePackages = async () => {
  const packageDirectories = await readdir(packagesDirectory, {
    withFileTypes: true,
  });
  const packagePaths = [];

  for (const directory of packageDirectories) {
    if (!directory.isDirectory()) {
      continue;
    }

    const packagePath = path.join(packagesDirectory, directory.name, "package.json");
    const packageJson = JSON.parse(await readFile(packagePath, "utf8"));

    if (packageJson.private === true || packageJson.publishConfig === undefined) {
      continue;
    }

    packagePaths.push(packagePath);
  }

  return packagePaths.sort();
};

const publishablePackages = await getPublishablePackages();

for (const packagePath of publishablePackages) {
  const packageJson = JSON.parse(await readFile(packagePath, "utf8"));

  for (const field of runtimeDependencyFields) {
    const dependencies = packageJson[field] ?? {};

    for (const [name, specifier] of Object.entries(dependencies)) {
      if (
        typeof specifier === "string" &&
        forbiddenProtocols.some((protocol) => specifier.startsWith(protocol))
      ) {
        errors.push(`${packagePath}: ${field}.${name} uses ${specifier}`);
      }
    }
  }
}

if (errors.length > 0) {
  console.error(
    [
      "Publishable package manifests must not use workspace-only protocols in runtime dependency fields.",
      ...errors.map((error) => `- ${error}`),
    ].join("\n"),
  );
  process.exitCode = 1;
}

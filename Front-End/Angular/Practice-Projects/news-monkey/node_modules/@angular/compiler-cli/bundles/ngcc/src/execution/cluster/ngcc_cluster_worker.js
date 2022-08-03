
      import {createRequire as __cjsCompatRequire} from 'module';
      const require = __cjsCompatRequire(import.meta.url);
      const __ESM_IMPORT_META_URL__ = import.meta.url;
    
import {
  parseCommandLineOptions
} from "../../../../chunk-FM6NPN5V.js";
import {
  PackageJsonUpdate,
  applyChange,
  getCreateCompileFn,
  getSharedSetup,
  sendMessageToMaster,
  stringifyTask
} from "../../../../chunk-S2H6ZNBD.js";
import "../../../../chunk-BCXYCOVM.js";
import "../../../../chunk-KPEPSPYQ.js";
import "../../../../chunk-NFCN3OZI.js";
import "../../../../chunk-E7NQQTT7.js";
import "../../../../chunk-CYVTLM4Z.js";
import "../../../../chunk-24DFPZCS.js";
import "../../../../chunk-TOKOIIBI.js";
import "../../../../chunk-ACXPVP2W.js";
import "../../../../chunk-XYNRD7NE.js";

// bazel-out/k8-fastbuild/bin/packages/compiler-cli/ngcc/src/execution/cluster/package_json_updater.mjs
import cluster from "cluster";
var ClusterWorkerPackageJsonUpdater = class {
  constructor() {
    if (cluster.isMaster) {
      throw new Error("Tried to create cluster worker PackageJsonUpdater on the master process.");
    }
  }
  createUpdate() {
    return new PackageJsonUpdate((...args) => this.writeChanges(...args));
  }
  writeChanges(changes, packageJsonPath, preExistingParsedJson) {
    if (preExistingParsedJson) {
      for (const [propPath, value] of changes) {
        if (propPath.length === 0) {
          throw new Error(`Missing property path for writing value to '${packageJsonPath}'.`);
        }
        applyChange(preExistingParsedJson, propPath, value, "unimportant");
      }
    }
    sendMessageToMaster({
      type: "update-package-json",
      packageJsonPath,
      changes
    });
  }
};

// bazel-out/k8-fastbuild/bin/packages/compiler-cli/ngcc/src/execution/cluster/worker.mjs
import cluster2 from "cluster";
async function startWorker(logger, createCompileFn) {
  if (cluster2.isMaster) {
    throw new Error("Tried to run cluster worker on the master process.");
  }
  const compile = createCompileFn((transformedFiles) => sendMessageToMaster({
    type: "transformed-files",
    files: transformedFiles.map((f) => f.path)
  }), (_task, outcome, message) => sendMessageToMaster({ type: "task-completed", outcome, message }));
  cluster2.worker.on("message", async (msg) => {
    try {
      switch (msg.type) {
        case "process-task":
          logger.debug(`[Worker #${cluster2.worker.id}] Processing task: ${stringifyTask(msg.task)}`);
          return await compile(msg.task);
        default:
          throw new Error(`[Worker #${cluster2.worker.id}] Invalid message received: ${JSON.stringify(msg)}`);
      }
    } catch (err) {
      switch (err && err.code) {
        case "ENOMEM":
          logger.warn(`[Worker #${cluster2.worker.id}] ${err.stack || err.message}`);
          return process.exit(1);
        default:
          await sendMessageToMaster({
            type: "error",
            error: err instanceof Error ? err.stack || err.message : err
          });
      }
    }
  });
  await sendMessageToMaster({ type: "ready" });
  return new Promise(() => void 0);
}

// bazel-out/k8-fastbuild/bin/packages/compiler-cli/ngcc/src/execution/cluster/ngcc_cluster_worker.mjs
(async () => {
  process.title = "ngcc (worker)";
  try {
    const { logger, pathMappings, enableI18nLegacyMessageIdFormat, fileSystem, tsConfig, getFileWriter } = getSharedSetup(parseCommandLineOptions(process.argv.slice(2)));
    const pkgJsonUpdater = new ClusterWorkerPackageJsonUpdater();
    const fileWriter = getFileWriter(pkgJsonUpdater);
    const createCompileFn = getCreateCompileFn(fileSystem, logger, fileWriter, enableI18nLegacyMessageIdFormat, tsConfig, pathMappings);
    await startWorker(logger, createCompileFn);
    process.exitCode = 0;
  } catch (e) {
    console.error(e.stack || e.message);
    process.exit(1);
  }
})();
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
//# sourceMappingURL=ngcc_cluster_worker.js.map

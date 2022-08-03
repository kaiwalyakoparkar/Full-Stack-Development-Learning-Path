
      import {createRequire as __cjsCompatRequire} from 'module';
      const require = __cjsCompatRequire(import.meta.url);
      const __ESM_IMPORT_META_URL__ = import.meta.url;
    
import {
  mainNgcc
} from "../chunk-MN3YDSGE.js";
import "../chunk-R3C7RFJ4.js";
import {
  clearTsConfigCache
} from "../chunk-S2H6ZNBD.js";
import "../chunk-BCXYCOVM.js";
import "../chunk-KPEPSPYQ.js";
import "../chunk-NFCN3OZI.js";
import {
  ConsoleLogger,
  LogLevel
} from "../chunk-E7NQQTT7.js";
import "../chunk-CYVTLM4Z.js";
import "../chunk-24DFPZCS.js";
import {
  NodeJSFileSystem,
  setFileSystem
} from "../chunk-TOKOIIBI.js";
import "../chunk-ACXPVP2W.js";
import "../chunk-XYNRD7NE.js";

// bazel-out/k8-fastbuild/bin/packages/compiler-cli/ngcc/index.mjs
import { dirname, join } from "path";
import { fileURLToPath } from "url";
function process(options) {
  setFileSystem(new NodeJSFileSystem());
  return mainNgcc(options);
}
var containingDirPath = typeof __dirname !== "undefined" ? __dirname : dirname(fileURLToPath(__ESM_IMPORT_META_URL__));
var ngccMainFilePath = join(containingDirPath, "./main-ngcc.js");
export {
  ConsoleLogger,
  LogLevel,
  clearTsConfigCache,
  containingDirPath,
  ngccMainFilePath,
  process
};
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
//# sourceMappingURL=index.js.map

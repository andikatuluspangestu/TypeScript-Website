define(["require", "exports"], function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.createVirtualLanguageServiceHost = exports.createVirtualCompilerHost = exports.createFSBackedSystem = exports.createSystem = exports.createDefaultMapFromCDN = exports.addFilesForTypesIntoFolder = exports.addAllFilesFromFolder = exports.createDefaultMapFromNodeModules = exports.knownLibFilesForCompilerOptions = exports.createVirtualTypeScriptEnvironment = void 0;
    let hasLocalStorage = false;
    try {
        hasLocalStorage = typeof localStorage !== `undefined`;
    }
    catch (error) { }
    const hasProcess = typeof process !== `undefined`;
    const shouldDebug = (hasLocalStorage && localStorage.getItem("DEBUG")) || (hasProcess && process.env.DEBUG);
    const debugLog = shouldDebug ? console.log : (_message, ..._optionalParams) => "";
    /**
     * Makes a virtual copy of the TypeScript environment. This is the main API you want to be using with
     * @typescript/vfs. A lot of the other exposed functions are used by this function to get set up.
     *
     * @param sys an object which conforms to the TS Sys (a shim over read/write access to the fs)
     * @param rootFiles a list of files which are considered inside the project
     * @param ts a copy pf the TypeScript module
     * @param compilerOptions the options for this compiler run
     * @param customTransformers custom transformers for this compiler run
     */
    function createVirtualTypeScriptEnvironment(sys, rootFiles, ts, compilerOptions = {}, customTransformers) {
        const mergedCompilerOpts = Object.assign(Object.assign({}, defaultCompilerOptions(ts)), compilerOptions);
        const { languageServiceHost, updateFile } = createVirtualLanguageServiceHost(sys, rootFiles, mergedCompilerOpts, ts, customTransformers);
        const languageService = ts.createLanguageService(languageServiceHost);
        const diagnostics = languageService.getCompilerOptionsDiagnostics();
        if (diagnostics.length) {
            const compilerHost = createVirtualCompilerHost(sys, compilerOptions, ts);
            throw new Error(ts.formatDiagnostics(diagnostics, compilerHost.compilerHost));
        }
        return {
            sys,
            languageService,
            getSourceFile: fileName => { var _a; return (_a = languageService.getProgram()) === null || _a === void 0 ? void 0 : _a.getSourceFile(fileName); },
            createFile: (fileName, content) => {
                updateFile(ts.createSourceFile(fileName, content, mergedCompilerOpts.target, false));
            },
            updateFile: (fileName, content, optPrevTextSpan) => {
                const prevSourceFile = languageService.getProgram().getSourceFile(fileName);
                if (!prevSourceFile) {
                    throw new Error("Did not find a source file for " + fileName);
                }
                const prevFullContents = prevSourceFile.text;
                // TODO: Validate if the default text span has a fencepost error?
                const prevTextSpan = optPrevTextSpan !== null && optPrevTextSpan !== void 0 ? optPrevTextSpan : ts.createTextSpan(0, prevFullContents.length);
                const newText = prevFullContents.slice(0, prevTextSpan.start) +
                    content +
                    prevFullContents.slice(prevTextSpan.start + prevTextSpan.length);
                const newSourceFile = ts.updateSourceFile(prevSourceFile, newText, {
                    span: prevTextSpan,
                    newLength: content.length,
                });
                updateFile(newSourceFile);
            },
        };
    }
    exports.createVirtualTypeScriptEnvironment = createVirtualTypeScriptEnvironment;
    /**
     * Grab the list of lib files for a particular target, will return a bit more than necessary (by including
     * the dom) but that's OK
     *
     * @param target The compiler settings target baseline
     * @param ts A copy of the TypeScript module
     */
    exports.knownLibFilesForCompilerOptions = (compilerOptions, ts) => {
        const target = compilerOptions.target || ts.ScriptTarget.ES5;
        const lib = compilerOptions.lib || [];
        const files = [
            "lib.d.ts",
            "lib.dom.d.ts",
            "lib.dom.iterable.d.ts",
            "lib.webworker.d.ts",
            "lib.webworker.importscripts.d.ts",
            "lib.scripthost.d.ts",
            "lib.es5.d.ts",
            "lib.es6.d.ts",
            "lib.es2015.collection.d.ts",
            "lib.es2015.core.d.ts",
            "lib.es2015.d.ts",
            "lib.es2015.generator.d.ts",
            "lib.es2015.iterable.d.ts",
            "lib.es2015.promise.d.ts",
            "lib.es2015.proxy.d.ts",
            "lib.es2015.reflect.d.ts",
            "lib.es2015.symbol.d.ts",
            "lib.es2015.symbol.wellknown.d.ts",
            "lib.es2016.array.include.d.ts",
            "lib.es2016.d.ts",
            "lib.es2016.full.d.ts",
            "lib.es2017.d.ts",
            "lib.es2017.full.d.ts",
            "lib.es2017.intl.d.ts",
            "lib.es2017.object.d.ts",
            "lib.es2017.sharedmemory.d.ts",
            "lib.es2017.string.d.ts",
            "lib.es2017.typedarrays.d.ts",
            "lib.es2018.asyncgenerator.d.ts",
            "lib.es2018.asynciterable.d.ts",
            "lib.es2018.d.ts",
            "lib.es2018.full.d.ts",
            "lib.es2018.intl.d.ts",
            "lib.es2018.promise.d.ts",
            "lib.es2018.regexp.d.ts",
            "lib.es2019.array.d.ts",
            "lib.es2019.d.ts",
            "lib.es2019.full.d.ts",
            "lib.es2019.object.d.ts",
            "lib.es2019.string.d.ts",
            "lib.es2019.symbol.d.ts",
            "lib.es2020.d.ts",
            "lib.es2020.full.d.ts",
            "lib.es2020.string.d.ts",
            "lib.es2020.symbol.wellknown.d.ts",
            "lib.es2020.bigint.d.ts",
            "lib.es2020.promise.d.ts",
            "lib.es2020.intl.d.ts",
            "lib.esnext.array.d.ts",
            "lib.esnext.asynciterable.d.ts",
            "lib.esnext.bigint.d.ts",
            "lib.esnext.d.ts",
            "lib.esnext.full.d.ts",
            "lib.esnext.intl.d.ts",
            "lib.esnext.symbol.d.ts",
        ];
        const targetToCut = ts.ScriptTarget[target];
        const matches = files.filter(f => f.startsWith(`lib.${targetToCut.toLowerCase()}`));
        const targetCutIndex = files.indexOf(matches.pop());
        const getMax = (array) => array && array.length ? array.reduce((max, current) => (current > max ? current : max)) : undefined;
        // Find the index for everything in
        const indexesForCutting = lib.map(lib => {
            const matches = files.filter(f => f.startsWith(`lib.${lib.toLowerCase()}`));
            if (matches.length === 0)
                return 0;
            const cutIndex = files.indexOf(matches.pop());
            return cutIndex;
        });
        const libCutIndex = getMax(indexesForCutting) || 0;
        const finalCutIndex = Math.max(targetCutIndex, libCutIndex);
        return files.slice(0, finalCutIndex + 1);
    };
    /**
     * Sets up a Map with lib contents by grabbing the necessary files from
     * the local copy of typescript via the file system.
     */
    exports.createDefaultMapFromNodeModules = (compilerOptions, ts) => {
        const tsModule = ts || require("typescript");
        const path = require("path");
        const fs = require("fs");
        const getLib = (name) => {
            const lib = path.dirname(require.resolve("typescript"));
            return fs.readFileSync(path.join(lib, name), "utf8");
        };
        const libs = exports.knownLibFilesForCompilerOptions(compilerOptions, tsModule);
        const fsMap = new Map();
        libs.forEach(lib => {
            fsMap.set("/" + lib, getLib(lib));
        });
        return fsMap;
    };
    /**
     * Adds recursively files from the FS into the map based on the folder
     */
    exports.addAllFilesFromFolder = (map, workingDir) => {
        const path = require("path");
        const fs = require("fs");
        const walk = function (dir) {
            let results = [];
            const list = fs.readdirSync(dir);
            list.forEach(function (file) {
                file = path.join(dir, file);
                const stat = fs.statSync(file);
                if (stat && stat.isDirectory()) {
                    /* Recurse into a subdirectory */
                    results = results.concat(walk(file));
                }
                else {
                    /* Is a file */
                    results.push(file);
                }
            });
            return results;
        };
        const allFiles = walk(workingDir);
        allFiles.forEach(lib => {
            const fsPath = "/node_modules/@types" + lib.replace(workingDir, "");
            const content = fs.readFileSync(lib, "utf8");
            const validExtensions = [".ts", ".tsx"];
            if (validExtensions.includes(path.extname(fsPath))) {
                map.set(fsPath, content);
            }
        });
    };
    /** Adds all files from node_modules/@types into the FS Map */
    exports.addFilesForTypesIntoFolder = (map) => exports.addAllFilesFromFolder(map, "node_modules/@types");
    /**
     * Create a virtual FS Map with the lib files from a particular TypeScript
     * version based on the target, Always includes dom ATM.
     *
     * @param options The compiler target, which dictates the libs to set up
     * @param version the versions of TypeScript which are supported
     * @param cache should the values be stored in local storage
     * @param ts a copy of the typescript import
     * @param lzstring an optional copy of the lz-string import
     * @param fetcher an optional replacement for the global fetch function (tests mainly)
     * @param storer an optional replacement for the localStorage global (tests mainly)
     */
    exports.createDefaultMapFromCDN = (options, version, cache, ts, lzstring, fetcher, storer) => {
        const fetchlike = fetcher || fetch;
        const storelike = storer || localStorage;
        const fsMap = new Map();
        const files = exports.knownLibFilesForCompilerOptions(options, ts);
        const prefix = `https://typescript.azureedge.net/cdn/${version}/typescript/lib/`;
        function zip(str) {
            return lzstring ? lzstring.compressToUTF16(str) : str;
        }
        function unzip(str) {
            return lzstring ? lzstring.decompressFromUTF16(str) : str;
        }
        // Map the known libs to a node fetch promise, then return the contents
        function uncached() {
            return Promise.all(files.map(lib => fetchlike(prefix + lib).then(resp => resp.text()))).then(contents => {
                contents.forEach((text, index) => fsMap.set("/" + files[index], text));
            });
        }
        // A localstorage and lzzip aware version of the lib files
        function cached() {
            const keys = Object.keys(localStorage);
            keys.forEach(key => {
                // Remove anything which isn't from this version
                if (key.startsWith("ts-lib-") && !key.startsWith("ts-lib-" + version)) {
                    storelike.removeItem(key);
                }
            });
            return Promise.all(files.map(lib => {
                const cacheKey = `ts-lib-${version}-${lib}`;
                const content = storelike.getItem(cacheKey);
                if (!content) {
                    // Make the API call and store the text concent in the cache
                    return fetchlike(prefix + lib)
                        .then(resp => resp.text())
                        .then(t => {
                        storelike.setItem(cacheKey, zip(t));
                        return t;
                    });
                }
                else {
                    return Promise.resolve(unzip(content));
                }
            })).then(contents => {
                contents.forEach((text, index) => {
                    const name = "/" + files[index];
                    fsMap.set(name, text);
                });
            });
        }
        const func = cache ? cached : uncached;
        return func().then(() => fsMap);
    };
    function notImplemented(methodName) {
        throw new Error(`Method '${methodName}' is not implemented.`);
    }
    function audit(name, fn) {
        return (...args) => {
            const res = fn(...args);
            const smallres = typeof res === "string" ? res.slice(0, 80) + "..." : res;
            debugLog("> " + name, ...args);
            debugLog("< " + smallres);
            return res;
        };
    }
    /** The default compiler options if TypeScript could ever change the compiler options */
    const defaultCompilerOptions = (ts) => {
        return Object.assign(Object.assign({}, ts.getDefaultCompilerOptions()), { jsx: ts.JsxEmit.React, strict: true, esModuleInterop: true, module: ts.ModuleKind.ESNext, suppressOutputPathCheck: true, skipLibCheck: true, skipDefaultLibCheck: true, moduleResolution: ts.ModuleResolutionKind.NodeJs });
    };
    // "/DOM.d.ts" => "/lib.dom.d.ts"
    const libize = (path) => path.replace("/", "/lib.").toLowerCase();
    /**
     * Creates an in-memory System object which can be used in a TypeScript program, this
     * is what provides read/write aspects of the virtual fs
     */
    function createSystem(files) {
        return {
            args: [],
            createDirectory: () => notImplemented("createDirectory"),
            // TODO: could make a real file tree
            directoryExists: audit("directoryExists", directory => {
                return Array.from(files.keys()).some(path => path.startsWith(directory));
            }),
            exit: () => notImplemented("exit"),
            fileExists: audit("fileExists", fileName => files.has(fileName) || files.has(libize(fileName))),
            getCurrentDirectory: () => "/",
            getDirectories: () => [],
            getExecutingFilePath: () => notImplemented("getExecutingFilePath"),
            readDirectory: audit("readDirectory", directory => (directory === "/" ? Array.from(files.keys()) : [])),
            readFile: audit("readFile", fileName => files.get(fileName) || files.get(libize(fileName))),
            resolvePath: path => path,
            newLine: "\n",
            useCaseSensitiveFileNames: true,
            write: () => notImplemented("write"),
            writeFile: (fileName, contents) => {
                files.set(fileName, contents);
            },
        };
    }
    exports.createSystem = createSystem;
    /**
     * Creates a file-system backed System object which can be used in a TypeScript program, you provide
     * a set of virtual files which are prioritised over the FS versions, then a path to the root of your
     * project (basically the folder your node_modules lives)
     */
    function createFSBackedSystem(files, _projectRoot, ts) {
        // We need to make an isolated folder for the tsconfig, but also need to be able to resolve the
        // existing node_modules structures going back through the history
        const root = _projectRoot + "/vfs";
        const path = require("path");
        // The default System in TypeScript
        const nodeSys = ts.sys;
        const tsLib = path.dirname(require.resolve("typescript"));
        return {
            args: [],
            createDirectory: () => notImplemented("createDirectory"),
            // TODO: could make a real file tree
            directoryExists: audit("directoryExists", directory => {
                return Array.from(files.keys()).some(path => path.startsWith(directory)) || nodeSys.directoryExists(directory);
            }),
            exit: nodeSys.exit,
            fileExists: audit("fileExists", fileName => {
                if (files.has(fileName))
                    return true;
                // Don't let other tsconfigs end up touching the vfs
                if (fileName.includes("tsconfig.json") || fileName.includes("tsconfig.json"))
                    return false;
                if (fileName.startsWith("/lib")) {
                    const tsLibName = `${tsLib}/${fileName.replace("/", "")}`;
                    return nodeSys.fileExists(tsLibName);
                }
                return nodeSys.fileExists(fileName);
            }),
            getCurrentDirectory: () => root,
            getDirectories: nodeSys.getDirectories,
            getExecutingFilePath: () => notImplemented("getExecutingFilePath"),
            readDirectory: audit("readDirectory", (...args) => {
                if (args[0] === "/") {
                    return Array.from(files.keys());
                }
                else {
                    return nodeSys.readDirectory(...args);
                }
            }),
            readFile: audit("readFile", fileName => {
                if (files.has(fileName))
                    return files.get(fileName);
                if (fileName.startsWith("/lib")) {
                    const tsLibName = `${tsLib}/${fileName.replace("/", "")}`;
                    return nodeSys.readFile(tsLibName);
                }
                return nodeSys.readFile(fileName);
            }),
            resolvePath: path => {
                if (files.has(path))
                    return path;
                return nodeSys.resolvePath(path);
            },
            newLine: "\n",
            useCaseSensitiveFileNames: true,
            write: () => notImplemented("write"),
            writeFile: (fileName, contents) => {
                files.set(fileName, contents);
            },
        };
    }
    exports.createFSBackedSystem = createFSBackedSystem;
    /**
     * Creates an in-memory CompilerHost -which is essentially an extra wrapper to System
     * which works with TypeScript objects - returns both a compiler host, and a way to add new SourceFile
     * instances to the in-memory file system.
     */
    function createVirtualCompilerHost(sys, compilerOptions, ts) {
        const sourceFiles = new Map();
        const save = (sourceFile) => {
            sourceFiles.set(sourceFile.fileName, sourceFile);
            return sourceFile;
        };
        const vHost = {
            compilerHost: Object.assign(Object.assign({}, sys), { getCanonicalFileName: fileName => fileName, getDefaultLibFileName: () => "/" + ts.getDefaultLibFileName(compilerOptions), 
                // getDefaultLibLocation: () => '/',
                getDirectories: () => [], getNewLine: () => sys.newLine, getSourceFile: fileName => {
                    return (sourceFiles.get(fileName) ||
                        save(ts.createSourceFile(fileName, sys.readFile(fileName), compilerOptions.target || defaultCompilerOptions(ts).target, false)));
                }, useCaseSensitiveFileNames: () => sys.useCaseSensitiveFileNames }),
            updateFile: sourceFile => {
                const alreadyExists = sourceFiles.has(sourceFile.fileName);
                sys.writeFile(sourceFile.fileName, sourceFile.text);
                sourceFiles.set(sourceFile.fileName, sourceFile);
                return alreadyExists;
            },
        };
        return vHost;
    }
    exports.createVirtualCompilerHost = createVirtualCompilerHost;
    /**
     * Creates an object which can host a language service against the virtual file-system
     */
    function createVirtualLanguageServiceHost(sys, rootFiles, compilerOptions, ts, customTransformers) {
        const fileNames = [...rootFiles];
        const { compilerHost, updateFile } = createVirtualCompilerHost(sys, compilerOptions, ts);
        const fileVersions = new Map();
        let projectVersion = 0;
        const languageServiceHost = Object.assign(Object.assign({}, compilerHost), { getProjectVersion: () => projectVersion.toString(), getCompilationSettings: () => compilerOptions, getCustomTransformers: () => customTransformers, getScriptFileNames: () => fileNames, getScriptSnapshot: fileName => {
                const contents = sys.readFile(fileName);
                if (contents) {
                    return ts.ScriptSnapshot.fromString(contents);
                }
                return;
            }, getScriptVersion: fileName => {
                return fileVersions.get(fileName) || "0";
            }, writeFile: sys.writeFile });
        const lsHost = {
            languageServiceHost,
            updateFile: sourceFile => {
                projectVersion++;
                fileVersions.set(sourceFile.fileName, projectVersion.toString());
                if (!fileNames.includes(sourceFile.fileName)) {
                    fileNames.push(sourceFile.fileName);
                }
                updateFile(sourceFile);
            },
        };
        return lsHost;
    }
    exports.createVirtualLanguageServiceHost = createVirtualLanguageServiceHost;
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidHlwZXNjcmlwdC12ZnMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zYW5kYm94L3NyYy92ZW5kb3IvdHlwZXNjcmlwdC12ZnMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7OztJQVFBLElBQUksZUFBZSxHQUFHLEtBQUssQ0FBQTtJQUMzQixJQUFJO1FBQ0YsZUFBZSxHQUFHLE9BQU8sWUFBWSxLQUFLLFdBQVcsQ0FBQTtLQUN0RDtJQUFDLE9BQU8sS0FBSyxFQUFFLEdBQUU7SUFFbEIsTUFBTSxVQUFVLEdBQUcsT0FBTyxPQUFPLEtBQUssV0FBVyxDQUFBO0lBQ2pELE1BQU0sV0FBVyxHQUFHLENBQUMsZUFBZSxJQUFJLFlBQVksQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLENBQUMsSUFBSSxDQUFDLFVBQVUsSUFBSSxPQUFPLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxDQUFBO0lBQzNHLE1BQU0sUUFBUSxHQUFHLFdBQVcsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxRQUFjLEVBQUUsR0FBRyxlQUFzQixFQUFFLEVBQUUsQ0FBQyxFQUFFLENBQUE7SUFVOUY7Ozs7Ozs7OztPQVNHO0lBRUgsU0FBZ0Isa0NBQWtDLENBQ2hELEdBQVcsRUFDWCxTQUFtQixFQUNuQixFQUFNLEVBQ04sa0JBQW1DLEVBQUUsRUFDckMsa0JBQXVDO1FBRXZDLE1BQU0sa0JBQWtCLG1DQUFRLHNCQUFzQixDQUFDLEVBQUUsQ0FBQyxHQUFLLGVBQWUsQ0FBRSxDQUFBO1FBRWhGLE1BQU0sRUFBRSxtQkFBbUIsRUFBRSxVQUFVLEVBQUUsR0FBRyxnQ0FBZ0MsQ0FDMUUsR0FBRyxFQUNILFNBQVMsRUFDVCxrQkFBa0IsRUFDbEIsRUFBRSxFQUNGLGtCQUFrQixDQUNuQixDQUFBO1FBQ0QsTUFBTSxlQUFlLEdBQUcsRUFBRSxDQUFDLHFCQUFxQixDQUFDLG1CQUFtQixDQUFDLENBQUE7UUFD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QUFxQixFQUFFLEdBQUcsRUFBRSxDQUFDLGtCQUFrQixFQUMvQyxrQkFBa0IsRUFBRSxHQUFHLEVBQUUsQ0FBQyxTQUFTLEVBQ25DLGlCQUFpQixFQUFFLFFBQVEsQ0FBQyxFQUFFO2dCQUM1QixNQUFNLFFBQVEsR0FBRyxHQUFHLENBQUMsUUFBUSxDQUFDLFFBQVEsQ0FBQyxDQUFBO2dCQUN2QyxJQUFJLFFBQVEsRUFBRTtvQkFDWixPQUFPLEVBQUUsQ0FBQyxjQUFjLENBQUMsVUFBVSxDQUFDLFFBQVEsQ0FBQyxDQUFBO2lCQUM5QztnQkFDRCxPQUFNO1lBQ1IsQ0FBQyxFQUNELGdCQUFnQixFQUFFLFFBQVEsQ0FBQyxFQUFFO2dCQUMzQixPQUFPLFlBQVksQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLElBQUksR0FBRyxDQUFBO1lBQzFDLENBQUMsRUFDRCxTQUFTLEVBQUUsR0FBRyxDQUFDLFNBQVMsR0FDekIsQ0FBQTtRQU9ELE1BQU0sTUFBTSxHQUFXO1lBQ3JCLG1CQUFtQjtZQUNuQixVQUFVLEVBQUUsVUFBVSxDQUFDLEVBQUU7Z0JBQ3ZCLGNBQWMsRUFBRSxDQUFBO2dCQUNoQixZQUFZLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQyxRQUFRLEVBQUUsY0FBYyxDQUFDLFFBQVEsRUFBRSxDQUFDLENBQUE7Z0JBQ2hFLElBQUksQ0FBQyxTQUFTLENBQUMsUUFBUSxDQUFDLFVBQVUsQ0FBQyxRQUFRLENBQUMsRUFBRTtvQkFDNUMsU0FBUyxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsUUFBUSxDQUFDLENBQUE7aUJBQ3BDO2dCQUNELFVBQVUsQ0FBQyxVQUFVLENBQUMsQ0FBQTtZQUN4QixDQUFDO1NBQ0YsQ0FBQTtRQUNELE9BQU8sTUFBTSxDQUFBO0lBQ2YsQ0FBQztJQS9DRCw0RUErQ0MiLCJzb3VyY2VzQ29udGVudCI6WyJ0eXBlIFN5c3RlbSA9IGltcG9ydChcInR5cGVzY3JpcHRcIikuU3lzdGVtXG50eXBlIENvbXBpbGVyT3B0aW9ucyA9IGltcG9ydChcInR5cGVzY3JpcHRcIikuQ29tcGlsZXJPcHRpb25zXG50eXBlIEN1c3RvbVRyYW5zZm9ybWVycyA9IGltcG9ydChcInR5cGVzY3JpcHRcIikuQ3VzdG9tVHJhbnNmb3JtZXJzXG50eXBlIExhbmd1YWdlU2VydmljZUhvc3QgPSBpbXBvcnQoXCJ0eXBlc2NyaXB0XCIpLkxhbmd1YWdlU2VydmljZUhvc3RcbnR5cGUgQ29tcGlsZXJIb3N0ID0gaW1wb3J0KFwidHlwZXNjcmlwdFwiKS5Db21waWxlckhvc3RcbnR5cGUgU291cmNlRmlsZSA9IGltcG9ydChcInR5cGVzY3JpcHRcIikuU291cmNlRmlsZVxudHlwZSBUUyA9IHR5cGVvZiBpbXBvcnQoXCJ0eXBlc2NyaXB0XCIpXG5cbmxldCBoYXNMb2NhbFN0b3JhZ2UgPSBmYWxzZVxudHJ5IHtcbiAgaGFzTG9jYWxTdG9yYWdlID0gdHlwZW9mIGxvY2FsU3RvcmFnZSAhPT0gYHVuZGVmaW5lZGBcbn0gY2F0Y2ggKGVycm9yKSB7fVxuXG5jb25zdCBoYXNQcm9jZXNzID0gdHlwZW9mIHByb2Nlc3MgIT09IGB1bmRlZmluZWRgXG5jb25zdCBzaG91bGREZWJ1ZyA9IChoYXNMb2NhbFN0b3JhZ2UgJiYgbG9jYWxTdG9yYWdlLmdldEl0ZW0oXCJERUJVR1wiKSkgfHwgKGhhc1Byb2Nlc3MgJiYgcHJvY2Vzcy5lbnYuREVCVUcpXG5jb25zdCBkZWJ1Z0xvZyA9IHNob3VsZERlYnVnID8gY29uc29sZS5sb2cgOiAoX21lc3NhZ2U/OiBhbnksIC4uLl9vcHRpb25hbFBhcmFtczogYW55W10pID0+IFwiXCJcblxuZXhwb3J0IGludGVyZmFjZSBWaXJ0dWFsVHlwZVNjcmlwdEVudmlyb25tZW50IHtcbiAgc3lzOiBTeXN0ZW1cbiAgbGFuZ3VhZ2VTZXJ2aWNlOiBpbXBvcnQoXCJ0eXBlc2NyaXB0XCIpLkxhbmd1YWdlU2VydmljZVxuICBnZXRTb3VyY2VGaWxlOiAoZmlsZU5hbWU6IHN0cmluZykgPT4gaW1wb3J0KFwidHlwZXNjcmlwdFwiKS5Tb3VyY2VGaWxlIHwgdW5kZWZpbmVkXG4gIGNyZWF0ZUZpbGU6IChmaWxlTmFtZTogc3RyaW5nLCBjb250ZW50OiBzdHJpbmcpID0+IHZvaWRcbiAgdXBkYXRlRmlsZTogKGZpbGVOYW1lOiBzdHJpbmcsIGNvbnRlbnQ6IHN0cmluZywgcmVwbGFjZVRleHRTcGFuPzogaW1wb3J0KFwidHlwZXNjcmlwdFwiKS5UZXh0U3BhbikgPT4gdm9pZFxufVxuXG4vKipcbiAqIE1ha2VzIGEgdmlydHVhbCBjb3B5IG9mIHRoZSBUeXBlU2NyaXB0IGVudmlyb25tZW50LiBUaGlzIGlzIHRoZSBtYWluIEFQSSB5b3Ugd2FudCB0byBiZSB1c2luZyB3aXRoXG4gKiBAdHlwZXNjcmlwdC92ZnMuIEEgbG90IG9mIHRoZSBvdGhlciBleHBvc2VkIGZ1bmN0aW9ucyBhcmUgdXNlZCBieSB0aGlzIGZ1bmN0aW9uIHRvIGdldCBzZXQgdXAuXG4gKlxuICogQHBhcmFtIHN5cyBhbiBvYmplY3Qgd2hpY2ggY29uZm9ybXMgdG8gdGhlIFRTIFN5cyAoYSBzaGltIG92ZXIgcmVhZC93cml0ZSBhY2Nlc3MgdG8gdGhlIGZzKVxuICogQHBhcmFtIHJvb3RGaWxlcyBhIGxpc3Qgb2YgZmlsZXMgd2hpY2ggYXJlIGNvbnNpZGVyZWQgaW5zaWRlIHRoZSBwcm9qZWN0XG4gKiBAcGFyYW0gdHMgYSBjb3B5IHBmIHRoZSBUeXBlU2NyaXB0IG1vZHVsZVxuICogQHBhcmFtIGNvbXBpbGVyT3B0aW9ucyB0aGUgb3B0aW9ucyBmb3IgdGhpcyBjb21waWxlciBydW5cbiAqIEBwYXJhbSBjdXN0b21UcmFuc2Zvcm1lcnMgY3VzdG9tIHRyYW5zZm9ybWVycyBmb3IgdGhpcyBjb21waWxlciBydW5cbiAqL1xuXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlVmlydHVhbFR5cGVTY3JpcHRFbnZpcm9ubWVudChcbiAgc3lzOiBTeXN0ZW0sXG4gIHJvb3RGaWxlczogc3RyaW5nW10sXG4gIHRzOiBUUyxcbiAgY29tcGlsZXJPcHRpb25zOiBDb21waWxlck9wdGlvbnMgPSB7fSxcbiAgY3VzdG9tVHJhbnNmb3JtZXJzPzogQ3VzdG9tVHJhbnNmb3JtZXJzXG4pOiBWaXJ0dWFsVHlwZVNjcmlwdEVudmlyb25tZW50IHtcbiAgY29uc3QgbWVyZ2VkQ29tcGlsZXJPcHRzID0geyAuLi5kZWZhdWx0Q29tcGlsZXJPcHRpb25zKHRzKSwgLi4uY29tcGlsZXJPcHRpb25zIH1cblxuICBjb25zdCB7IGxhbmd1YWdlU2VydmljZUhvc3QsIHVwZGF0ZUZpbGUgfSA9IGNyZWF0ZVZpcnR1YWxMYW5ndWFnZVNlcnZpY2VIb3N0KFxuICAgIHN5cyxcbiAgICByb290RmlsZXMsXG4gICAgbWVyZ2VkQ29tcGlsZXJPcHRzLFxuICAgIHRzLFxuICAgIGN1c3RvbVRyYW5zZm9ybWVyc1xuICApXG4gIGNvbnN0IGxhbmd1YWdlU2VydmljZSA9IHRzLmNyZWF0ZUxhbmd1YWdlU2VydmljZShsYW5ndWFnZVNlcnZpY2VIb3N0KVxuICBjb25zdCBkaWFnbm9zdGljcyA9IGxhbmd1YWdlU2VydmljZS5nZXRDb21waWxlck9wdGlvbnNEaWFnbm9zdGljcygpXG5cbiAgaWYgKGRpYWdub3N0aWNzLmxlbmd0aCkge1xuICAgIGNvbnN0IGNvbXBpbGVySG9zdCA9IGNyZWF0ZVZpcnR1YWxDb21waWxlckhvc3Qoc3lzLCBjb21waWxlck9wdGlvbnMsIHRzKVxuICAgIHRocm93IG5ldyBFcnJvcih0cy5mb3JtYXREaWFnbm9zdGljcyhkaWFnbm9zdGljcywgY29tcGlsZXJIb3N0LmNvbXBpbGVySG9zdCkpXG4gIH1cblxuICByZXR1cm4ge1xuICAgIHN5cyxcbiAgICBsYW5ndWFnZVNlcnZpY2UsXG4gICAgZ2V0U291cmNlRmlsZTogZmlsZU5hbWUgPT4gbGFuZ3VhZ2VTZXJ2aWNlLmdldFByb2dyYW0oKT8uZ2V0U291cmNlRmlsZShmaWxlTmFtZSksXG5cbiAgICBjcmVhdGVGaWxlOiAoZmlsZU5hbWUsIGNvbnRlbnQpID0+IHtcbiAgICAgIHVwZGF0ZUZpbGUodHMuY3JlYXRlU291cmNlRmlsZShmaWxlTmFtZSwgY29udGVudCwgbWVyZ2VkQ29tcGlsZXJPcHRzLnRhcmdldCEsIGZhbHNlKSlcbiAgICB9LFxuICAgIHVwZGF0ZUZpbGU6IChmaWxlTmFtZSwgY29udGVudCwgb3B0UHJldlRleHRTcGFuKSA9PiB7XG4gICAgICBjb25zdCBwcmV2U291cmNlRmlsZSA9IGxhbmd1YWdlU2VydmljZS5nZXRQcm9ncmFtKCkhLmdldFNvdXJjZUZpbGUoZmlsZU5hbWUpXG4gICAgICBpZiAoIXByZXZTb3VyY2VGaWxlKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcIkRpZCBub3QgZmluZCBhIHNvdXJjZSBmaWxlIGZvciBcIiArIGZpbGVOYW1lKVxuICAgICAgfVxuICAgICAgY29uc3QgcHJldkZ1bGxDb250ZW50cyA9IHByZXZTb3VyY2VGaWxlLnRleHRcblxuICAgICAgLy8gVE9ETzogVmFsaWRhdGUgaWYgdGhlIGRlZmF1bHQgdGV4dCBzcGFuIGhhcyBhIGZlbmNlcG9zdCBlcnJvcj9cbiAgICAgIGNvbnN0IHByZXZUZXh0U3BhbiA9IG9wdFByZXZUZXh0U3BhbiA/PyB0cy5jcmVhdGVUZXh0U3BhbigwLCBwcmV2RnVsbENvbnRlbnRzLmxlbmd0aClcbiAgICAgIGNvbnN0IG5ld1RleHQgPVxuICAgICAgICBwcmV2RnVsbENvbnRlbnRzLnNsaWNlKDAsIHByZXZUZXh0U3Bhbi5zdGFydCkgK1xuICAgICAgICBjb250ZW50ICtcbiAgICAgICAgcHJldkZ1bGxDb250ZW50cy5zbGljZShwcmV2VGV4dFNwYW4uc3RhcnQgKyBwcmV2VGV4dFNwYW4ubGVuZ3RoKVxuICAgICAgY29uc3QgbmV3U291cmNlRmlsZSA9IHRzLnVwZGF0ZVNvdXJjZUZpbGUocHJldlNvdXJjZUZpbGUsIG5ld1RleHQsIHtcbiAgICAgICAgc3BhbjogcHJldlRleHRTcGFuLFxuICAgICAgICBuZXdMZW5ndGg6IGNvbnRlbnQubGVuZ3RoLFxuICAgICAgfSlcblxuICAgICAgdXBkYXRlRmlsZShuZXdTb3VyY2VGaWxlKVxuICAgIH0sXG4gIH1cbn1cblxuLyoqXG4gKiBHcmFiIHRoZSBsaXN0IG9mIGxpYiBmaWxlcyBmb3IgYSBwYXJ0aWN1bGFyIHRhcmdldCwgd2lsbCByZXR1cm4gYSBiaXQgbW9yZSB0aGFuIG5lY2Vzc2FyeSAoYnkgaW5jbHVkaW5nXG4gKiB0aGUgZG9tKSBidXQgdGhhdCdzIE9LXG4gKlxuICogQHBhcmFtIHRhcmdldCBUaGUgY29tcGlsZXIgc2V0dGluZ3MgdGFyZ2V0IGJhc2VsaW5lXG4gKiBAcGFyYW0gdHMgQSBjb3B5IG9mIHRoZSBUeXBlU2NyaXB0IG1vZHVsZVxuICovXG5leHBvcnQgY29uc3Qga25vd25MaWJGaWxlc0ZvckNvbXBpbGVyT3B0aW9ucyA9IChjb21waWxlck9wdGlvbnM6IENvbXBpbGVyT3B0aW9ucywgdHM6IFRTKSA9PiB7XG4gIGNvbnN0IHRhcmdldCA9IGNvbXBpbGVyT3B0aW9ucy50YXJnZXQgfHwgdHMuU2NyaXB0VGFyZ2V0LkVTNVxuICBjb25zdCBsaWIgPSBjb21waWxlck9wdGlvbnMubGliIHx8IFtdXG5cbiAgY29uc3QgZmlsZXMgPSBbXG4gICAgXCJsaWIuZC50c1wiLFxuICAgIFwibGliLmRvbS5kLnRzXCIsXG4gICAgXCJsaWIuZG9tLml0ZXJhYmxlLmQudHNcIixcbiAgICBcImxpYi53ZWJ3b3JrZXIuZC50c1wiLFxuICAgIFwibGliLndlYndvcmtlci5pbXBvcnRzY3JpcHRzLmQudHNcIixcbiAgICBcImxpYi5zY3JpcHRob3N0LmQudHNcIixcbiAgICBcImxpYi5lczUuZC50c1wiLFxuICAgIFwibGliLmVzNi5kLnRzXCIsXG4gICAgXCJsaWIuZXMyMDE1LmNvbGxlY3Rpb24uZC50c1wiLFxuICAgIFwibGliLmVzMjAxNS5jb3JlLmQudHNcIixcbiAgICBcImxpYi5lczIwMTUuZC50c1wiLFxuICAgIFwibGliLmVzMjAxNS5nZW5lcmF0b3IuZC50c1wiLFxuICAgIFwibGliLmVzMjAxNS5pdGVyYWJsZS5kLnRzXCIsXG4gICAgXCJsaWIuZXMyMDE1LnByb21pc2UuZC50c1wiLFxuICAgIFwibGliLmVzMjAxNS5wcm94eS5kLnRzXCIsXG4gICAgXCJsaWIuZXMyMDE1LnJlZmxlY3QuZC50c1wiLFxuICAgIFwibGliLmVzMjAxNS5zeW1ib2wuZC50c1wiLFxuICAgIFwibGliLmVzMjAxNS5zeW1ib2wud2VsbGtub3duLmQudHNcIixcbiAgICBcImxpYi5lczIwMTYuYXJyYXkuaW5jbHVkZS5kLnRzXCIsXG4gICAgXCJsaWIuZXMyMDE2LmQudHNcIixcbiAgICBcImxpYi5lczIwMTYuZnVsbC5kLnRzXCIsXG4gICAgXCJsaWIuZXMyMDE3LmQudHNcIixcbiAgICBcImxpYi5lczIwMTcuZnVsbC5kLnRzXCIsXG4gICAgXCJsaWIuZXMyMDE3LmludGwuZC50c1wiLFxuICAgIFwibGliLmVzMjAxNy5vYmplY3QuZC50c1wiLFxuICAgIFwibGliLmVzMjAxNy5zaGFyZWRtZW1vcnkuZC50c1wiLFxuICAgIFwibGliLmVzMjAxNy5zdHJpbmcuZC50c1wiLFxuICAgIFwibGliLmVzMjAxNy50eXBlZGFycmF5cy5kLnRzXCIsXG4gICAgXCJsaWIuZXMyMDE4LmFzeW5jZ2VuZXJhdG9yLmQudHNcIixcbiAgICBcImxpYi5lczIwMTguYXN5bmNpdGVyYWJsZS5kLnRzXCIsXG4gICAgXCJsaWIuZXMyMDE4LmQudHNcIixcbiAgICBcImxpYi5lczIwMTguZnVsbC5kLnRzXCIsXG4gICAgXCJsaWIuZXMyMDE4LmludGwuZC50c1wiLFxuICAgIFwibGliLmVzMjAxOC5wcm9taXNlLmQudHNcIixcbiAgICBcImxpYi5lczIwMTgucmVnZXhwLmQudHNcIixcbiAgICBcImxpYi5lczIwMTkuYXJyYXkuZC50c1wiLFxuICAgIFwibGliLmVzMjAxOS5kLnRzXCIsXG4gICAgXCJsaWIuZXMyMDE5LmZ1bGwuZC50c1wiLFxuICAgIFwibGliLmVzMjAxOS5vYmplY3QuZC50c1wiLFxuICAgIFwibGliLmVzMjAxOS5zdHJpbmcuZC50c1wiLFxuICAgIFwibGliLmVzMjAxOS5zeW1ib2wuZC50c1wiLFxuICAgIFwibGliLmVzMjAyMC5kLnRzXCIsXG4gICAgXCJsaWIuZXMyMDIwLmZ1bGwuZC50c1wiLFxuICAgIFwibGliLmVzMjAyMC5zdHJpbmcuZC50c1wiLFxuICAgIFwibGliLmVzMjAyMC5zeW1ib2wud2VsbGtub3duLmQudHNcIixcbiAgICBcImxpYi5lczIwMjAuYmlnaW50LmQudHNcIixcbiAgICBcImxpYi5lczIwMjAucHJvbWlzZS5kLnRzXCIsXG4gICAgXCJsaWIuZXMyMDIwLmludGwuZC50c1wiLFxuICAgIFwibGliLmVzbmV4dC5hcnJheS5kLnRzXCIsXG4gICAgXCJsaWIuZXNuZXh0LmFzeW5jaXRlcmFibGUuZC50c1wiLFxuICAgIFwibGliLmVzbmV4dC5iaWdpbnQuZC50c1wiLFxuICAgIFwibGliLmVzbmV4dC5kLnRzXCIsXG4gICAgXCJsaWIuZXNuZXh0LmZ1bGwuZC50c1wiLFxuICAgIFwibGliLmVzbmV4dC5pbnRsLmQudHNcIixcbiAgICBcImxpYi5lc25leHQuc3ltYm9sLmQudHNcIixcbiAgXVxuXG4gIGNvbnN0IHRhcmdldFRvQ3V0ID0gdHMuU2NyaXB0VGFyZ2V0W3RhcmdldF1cbiAgY29uc3QgbWF0Y2hlcyA9IGZpbGVzLmZpbHRlcihmID0+IGYuc3RhcnRzV2l0aChgbGliLiR7dGFyZ2V0VG9DdXQudG9Mb3dlckNhc2UoKX1gKSlcbiAgY29uc3QgdGFyZ2V0Q3V0SW5kZXggPSBmaWxlcy5pbmRleE9mKG1hdGNoZXMucG9wKCkhKVxuXG4gIGNvbnN0IGdldE1heCA9IChhcnJheTogbnVtYmVyW10pID0+XG4gICAgYXJyYXkgJiYgYXJyYXkubGVuZ3RoID8gYXJyYXkucmVkdWNlKChtYXgsIGN1cnJlbnQpID0+IChjdXJyZW50ID4gbWF4ID8gY3VycmVudCA6IG1heCkpIDogdW5kZWZpbmVkXG5cbiAgLy8gRmluZCB0aGUgaW5kZXggZm9yIGV2ZXJ5dGhpbmcgaW5cbiAgY29uc3QgaW5kZXhlc0ZvckN1dHRpbmcgPSBsaWIubWFwKGxpYiA9PiB7XG4gICAgY29uc3QgbWF0Y2hlcyA9IGZpbGVzLmZpbHRlcihmID0+IGYuc3RhcnRzV2l0aChgbGliLiR7bGliLnRvTG93ZXJDYXNlKCl9YCkpXG4gICAgaWYgKG1hdGNoZXMubGVuZ3RoID09PSAwKSByZXR1cm4gMFxuXG4gICAgY29uc3QgY3V0SW5kZXggPSBmaWxlcy5pbmRleE9mKG1hdGNoZXMucG9wKCkhKVxuICAgIHJldHVybiBjdXRJbmRleFxuICB9KVxuXG4gIGNvbnN0IGxpYkN1dEluZGV4ID0gZ2V0TWF4KGluZGV4ZXNGb3JDdXR0aW5nKSB8fCAwXG5cbiAgY29uc3QgZmluYWxDdXRJbmRleCA9IE1hdGgubWF4KHRhcmdldEN1dEluZGV4LCBsaWJDdXRJbmRleClcbiAgcmV0dXJuIGZpbGVzLnNsaWNlKDAsIGZpbmFsQ3V0SW5kZXggKyAxKVxufVxuXG4vKipcbiAqIFNldHMgdXAgYSBNYXAgd2l0aCBsaWIgY29udGVudHMgYnkgZ3JhYmJpbmcgdGhlIG5lY2Vzc2FyeSBmaWxlcyBmcm9tXG4gKiB0aGUgbG9jYWwgY29weSBvZiB0eXBlc2NyaXB0IHZpYSB0aGUgZmlsZSBzeXN0ZW0uXG4gKi9cbmV4cG9ydCBjb25zdCBjcmVhdGVEZWZhdWx0TWFwRnJvbU5vZGVNb2R1bGVzID0gKGNvbXBpbGVyT3B0aW9uczogQ29tcGlsZXJPcHRpb25zLCB0cz86IHR5cGVvZiBpbXBvcnQoXCJ0eXBlc2NyaXB0XCIpKSA9PiB7XG4gIGNvbnN0IHRzTW9kdWxlID0gdHMgfHwgcmVxdWlyZShcInR5cGVzY3JpcHRcIilcbiAgY29uc3QgcGF0aCA9IHJlcXVpcmUoXCJwYXRoXCIpXG4gIGNvbnN0IGZzID0gcmVxdWlyZShcImZzXCIpXG5cbiAgY29uc3QgZ2V0TGliID0gKG5hbWU6IHN0cmluZykgPT4ge1xuICAgIGNvbnN0IGxpYiA9IHBhdGguZGlybmFtZShyZXF1aXJlLnJlc29sdmUoXCJ0eXBlc2NyaXB0XCIpKVxuICAgIHJldHVybiBmcy5yZWFkRmlsZVN5bmMocGF0aC5qb2luKGxpYiwgbmFtZSksIFwidXRmOFwiKVxuICB9XG5cbiAgY29uc3QgbGlicyA9IGtub3duTGliRmlsZXNGb3JDb21waWxlck9wdGlvbnMoY29tcGlsZXJPcHRpb25zLCB0c01vZHVsZSlcbiAgY29uc3QgZnNNYXAgPSBuZXcgTWFwPHN0cmluZywgc3RyaW5nPigpXG4gIGxpYnMuZm9yRWFjaChsaWIgPT4ge1xuICAgIGZzTWFwLnNldChcIi9cIiArIGxpYiwgZ2V0TGliKGxpYikpXG4gIH0pXG4gIHJldHVybiBmc01hcFxufVxuXG4vKipcbiAqIEFkZHMgcmVjdXJzaXZlbHkgZmlsZXMgZnJvbSB0aGUgRlMgaW50byB0aGUgbWFwIGJhc2VkIG9uIHRoZSBmb2xkZXJcbiAqL1xuZXhwb3J0IGNvbnN0IGFkZEFsbEZpbGVzRnJvbUZvbGRlciA9IChtYXA6IE1hcDxzdHJpbmcsIHN0cmluZz4sIHdvcmtpbmdEaXI6IHN0cmluZyk6IHZvaWQgPT4ge1xuICBjb25zdCBwYXRoID0gcmVxdWlyZShcInBhdGhcIilcbiAgY29uc3QgZnMgPSByZXF1aXJlKFwiZnNcIilcblxuICBjb25zdCB3YWxrID0gZnVuY3Rpb24gKGRpcjogc3RyaW5nKSB7XG4gICAgbGV0IHJlc3VsdHM6IHN0cmluZ1tdID0gW11cbiAgICBjb25zdCBsaXN0ID0gZnMucmVhZGRpclN5bmMoZGlyKVxuICAgIGxpc3QuZm9yRWFjaChmdW5jdGlvbiAoZmlsZTogc3RyaW5nKSB7XG4gICAgICBmaWxlID0gcGF0aC5qb2luKGRpciwgZmlsZSlcbiAgICAgIGNvbnN0IHN0YXQgPSBmcy5zdGF0U3luYyhmaWxlKVxuICAgICAgaWYgKHN0YXQgJiYgc3RhdC5pc0RpcmVjdG9yeSgpKSB7XG4gICAgICAgIC8qIFJlY3Vyc2UgaW50byBhIHN1YmRpcmVjdG9yeSAqL1xuICAgICAgICByZXN1bHRzID0gcmVzdWx0cy5jb25jYXQod2FsayhmaWxlKSlcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8qIElzIGEgZmlsZSAqL1xuICAgICAgICByZXN1bHRzLnB1c2goZmlsZSlcbiAgICAgIH1cbiAgICB9KVxuICAgIHJldHVybiByZXN1bHRzXG4gIH1cblxuICBjb25zdCBhbGxGaWxlcyA9IHdhbGsod29ya2luZ0RpcilcblxuICBhbGxGaWxlcy5mb3JFYWNoKGxpYiA9PiB7XG4gICAgY29uc3QgZnNQYXRoID0gXCIvbm9kZV9tb2R1bGVzL0B0eXBlc1wiICsgbGliLnJlcGxhY2Uod29ya2luZ0RpciwgXCJcIilcbiAgICBjb25zdCBjb250ZW50ID0gZnMucmVhZEZpbGVTeW5jKGxpYiwgXCJ1dGY4XCIpXG4gICAgY29uc3QgdmFsaWRFeHRlbnNpb25zID0gW1wiLnRzXCIsIFwiLnRzeFwiXVxuXG4gICAgaWYgKHZhbGlkRXh0ZW5zaW9ucy5pbmNsdWRlcyhwYXRoLmV4dG5hbWUoZnNQYXRoKSkpIHtcbiAgICAgIG1hcC5zZXQoZnNQYXRoLCBjb250ZW50KVxuICAgIH1cbiAgfSlcbn1cblxuLyoqIEFkZHMgYWxsIGZpbGVzIGZyb20gbm9kZV9tb2R1bGVzL0B0eXBlcyBpbnRvIHRoZSBGUyBNYXAgKi9cbmV4cG9ydCBjb25zdCBhZGRGaWxlc0ZvclR5cGVzSW50b0ZvbGRlciA9IChtYXA6IE1hcDxzdHJpbmcsIHN0cmluZz4pID0+XG4gIGFkZEFsbEZpbGVzRnJvbUZvbGRlcihtYXAsIFwibm9kZV9tb2R1bGVzL0B0eXBlc1wiKVxuXG4vKipcbiAqIENyZWF0ZSBhIHZpcnR1YWwgRlMgTWFwIHdpdGggdGhlIGxpYiBmaWxlcyBmcm9tIGEgcGFydGljdWxhciBUeXBlU2NyaXB0XG4gKiB2ZXJzaW9uIGJhc2VkIG9uIHRoZSB0YXJnZXQsIEFsd2F5cyBpbmNsdWRlcyBkb20gQVRNLlxuICpcbiAqIEBwYXJhbSBvcHRpb25zIFRoZSBjb21waWxlciB0YXJnZXQsIHdoaWNoIGRpY3RhdGVzIHRoZSBsaWJzIHRvIHNldCB1cFxuICogQHBhcmFtIHZlcnNpb24gdGhlIHZlcnNpb25zIG9mIFR5cGVTY3JpcHQgd2hpY2ggYXJlIHN1cHBvcnRlZFxuICogQHBhcmFtIGNhY2hlIHNob3VsZCB0aGUgdmFsdWVzIGJlIHN0b3JlZCBpbiBsb2NhbCBzdG9yYWdlXG4gKiBAcGFyYW0gdHMgYSBjb3B5IG9mIHRoZSB0eXBlc2NyaXB0IGltcG9ydFxuICogQHBhcmFtIGx6c3RyaW5nIGFuIG9wdGlvbmFsIGNvcHkgb2YgdGhlIGx6LXN0cmluZyBpbXBvcnRcbiAqIEBwYXJhbSBmZXRjaGVyIGFuIG9wdGlvbmFsIHJlcGxhY2VtZW50IGZvciB0aGUgZ2xvYmFsIGZldGNoIGZ1bmN0aW9uICh0ZXN0cyBtYWlubHkpXG4gKiBAcGFyYW0gc3RvcmVyIGFuIG9wdGlvbmFsIHJlcGxhY2VtZW50IGZvciB0aGUgbG9jYWxTdG9yYWdlIGdsb2JhbCAodGVzdHMgbWFpbmx5KVxuICovXG5leHBvcnQgY29uc3QgY3JlYXRlRGVmYXVsdE1hcEZyb21DRE4gPSAoXG4gIG9wdGlvbnM6IENvbXBpbGVyT3B0aW9ucyxcbiAgdmVyc2lvbjogc3RyaW5nLFxuICBjYWNoZTogYm9vbGVhbixcbiAgdHM6IFRTLFxuICBsenN0cmluZz86IHR5cGVvZiBpbXBvcnQoXCJsei1zdHJpbmdcIiksXG4gIGZldGNoZXI/OiB0eXBlb2YgZmV0Y2gsXG4gIHN0b3Jlcj86IHR5cGVvZiBsb2NhbFN0b3JhZ2VcbikgPT4ge1xuICBjb25zdCBmZXRjaGxpa2UgPSBmZXRjaGVyIHx8IGZldGNoXG4gIGNvbnN0IHN0b3JlbGlrZSA9IHN0b3JlciB8fCBsb2NhbFN0b3JhZ2VcbiAgY29uc3QgZnNNYXAgPSBuZXcgTWFwPHN0cmluZywgc3RyaW5nPigpXG4gIGNvbnN0IGZpbGVzID0ga25vd25MaWJGaWxlc0ZvckNvbXBpbGVyT3B0aW9ucyhvcHRpb25zLCB0cylcbiAgY29uc3QgcHJlZml4ID0gYGh0dHBzOi8vdHlwZXNjcmlwdC5henVyZWVkZ2UubmV0L2Nkbi8ke3ZlcnNpb259L3R5cGVzY3JpcHQvbGliL2BcblxuICBmdW5jdGlvbiB6aXAoc3RyOiBzdHJpbmcpIHtcbiAgICByZXR1cm4gbHpzdHJpbmcgPyBsenN0cmluZy5jb21wcmVzc1RvVVRGMTYoc3RyKSA6IHN0clxuICB9XG5cbiAgZnVuY3Rpb24gdW56aXAoc3RyOiBzdHJpbmcpIHtcbiAgICByZXR1cm4gbHpzdHJpbmcgPyBsenN0cmluZy5kZWNvbXByZXNzRnJvbVVURjE2KHN0cikgOiBzdHJcbiAgfVxuXG4gIC8vIE1hcCB0aGUga25vd24gbGlicyB0byBhIG5vZGUgZmV0Y2ggcHJvbWlzZSwgdGhlbiByZXR1cm4gdGhlIGNvbnRlbnRzXG4gIGZ1bmN0aW9uIHVuY2FjaGVkKCkge1xuICAgIHJldHVybiBQcm9taXNlLmFsbChmaWxlcy5tYXAobGliID0+IGZldGNobGlrZShwcmVmaXggKyBsaWIpLnRoZW4ocmVzcCA9PiByZXNwLnRleHQoKSkpKS50aGVuKGNvbnRlbnRzID0+IHtcbiAgICAgIGNvbnRlbnRzLmZvckVhY2goKHRleHQsIGluZGV4KSA9PiBmc01hcC5zZXQoXCIvXCIgKyBmaWxlc1tpbmRleF0sIHRleHQpKVxuICAgIH0pXG4gIH1cblxuICAvLyBBIGxvY2Fsc3RvcmFnZSBhbmQgbHp6aXAgYXdhcmUgdmVyc2lvbiBvZiB0aGUgbGliIGZpbGVzXG4gIGZ1bmN0aW9uIGNhY2hlZCgpIHtcbiAgICBjb25zdCBrZXlzID0gT2JqZWN0LmtleXMobG9jYWxTdG9yYWdlKVxuICAgIGtleXMuZm9yRWFjaChrZXkgPT4ge1xuICAgICAgLy8gUmVtb3ZlIGFueXRoaW5nIHdoaWNoIGlzbid0IGZyb20gdGhpcyB2ZXJzaW9uXG4gICAgICBpZiAoa2V5LnN0YXJ0c1dpdGgoXCJ0cy1saWItXCIpICYmICFrZXkuc3RhcnRzV2l0aChcInRzLWxpYi1cIiArIHZlcnNpb24pKSB7XG4gICAgICAgIHN0b3JlbGlrZS5yZW1vdmVJdGVtKGtleSlcbiAgICAgIH1cbiAgICB9KVxuXG4gICAgcmV0dXJuIFByb21pc2UuYWxsKFxuICAgICAgZmlsZXMubWFwKGxpYiA9PiB7XG4gICAgICAgIGNvbnN0IGNhY2hlS2V5ID0gYHRzLWxpYi0ke3ZlcnNpb259LSR7bGlifWBcbiAgICAgICAgY29uc3QgY29udGVudCA9IHN0b3JlbGlrZS5nZXRJdGVtKGNhY2hlS2V5KVxuXG4gICAgICAgIGlmICghY29udGVudCkge1xuICAgICAgICAgIC8vIE1ha2UgdGhlIEFQSSBjYWxsIGFuZCBzdG9yZSB0aGUgdGV4dCBjb25jZW50IGluIHRoZSBjYWNoZVxuICAgICAgICAgIHJldHVybiBmZXRjaGxpa2UocHJlZml4ICsgbGliKVxuICAgICAgICAgICAgLnRoZW4ocmVzcCA9PiByZXNwLnRleHQoKSlcbiAgICAgICAgICAgIC50aGVuKHQgPT4ge1xuICAgICAgICAgICAgICBzdG9yZWxpa2Uuc2V0SXRlbShjYWNoZUtleSwgemlwKHQpKVxuICAgICAgICAgICAgICByZXR1cm4gdFxuICAgICAgICAgICAgfSlcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKHVuemlwKGNvbnRlbnQpKVxuICAgICAgICB9XG4gICAgICB9KVxuICAgICkudGhlbihjb250ZW50cyA9PiB7XG4gICAgICBjb250ZW50cy5mb3JFYWNoKCh0ZXh0LCBpbmRleCkgPT4ge1xuICAgICAgICBjb25zdCBuYW1lID0gXCIvXCIgKyBmaWxlc1tpbmRleF1cbiAgICAgICAgZnNNYXAuc2V0KG5hbWUsIHRleHQpXG4gICAgICB9KVxuICAgIH0pXG4gIH1cblxuICBjb25zdCBmdW5jID0gY2FjaGUgPyBjYWNoZWQgOiB1bmNhY2hlZFxuICByZXR1cm4gZnVuYygpLnRoZW4oKCkgPT4gZnNNYXApXG59XG5cbmZ1bmN0aW9uIG5vdEltcGxlbWVudGVkKG1ldGhvZE5hbWU6IHN0cmluZyk6IGFueSB7XG4gIHRocm93IG5ldyBFcnJvcihgTWV0aG9kICcke21ldGhvZE5hbWV9JyBpcyBub3QgaW1wbGVtZW50ZWQuYClcbn1cblxuZnVuY3Rpb24gYXVkaXQ8QXJnc1QgZXh0ZW5kcyBhbnlbXSwgUmV0dXJuVD4oXG4gIG5hbWU6IHN0cmluZyxcbiAgZm46ICguLi5hcmdzOiBBcmdzVCkgPT4gUmV0dXJuVFxuKTogKC4uLmFyZ3M6IEFyZ3NUKSA9PiBSZXR1cm5UIHtcbiAgcmV0dXJuICguLi5hcmdzKSA9PiB7XG4gICAgY29uc3QgcmVzID0gZm4oLi4uYXJncylcblxuICAgIGNvbnN0IHNtYWxscmVzID0gdHlwZW9mIHJlcyA9PT0gXCJzdHJpbmdcIiA/IHJlcy5zbGljZSgwLCA4MCkgKyBcIi4uLlwiIDogcmVzXG4gICAgZGVidWdMb2coXCI+IFwiICsgbmFtZSwgLi4uYXJncylcbiAgICBkZWJ1Z0xvZyhcIjwgXCIgKyBzbWFsbHJlcylcblxuICAgIHJldHVybiByZXNcbiAgfVxufVxuXG4vKiogVGhlIGRlZmF1bHQgY29tcGlsZXIgb3B0aW9ucyBpZiBUeXBlU2NyaXB0IGNvdWxkIGV2ZXIgY2hhbmdlIHRoZSBjb21waWxlciBvcHRpb25zICovXG5jb25zdCBkZWZhdWx0Q29tcGlsZXJPcHRpb25zID0gKHRzOiB0eXBlb2YgaW1wb3J0KFwidHlwZXNjcmlwdFwiKSk6IENvbXBpbGVyT3B0aW9ucyA9PiB7XG4gIHJldHVybiB7XG4gICAgLi4udHMuZ2V0RGVmYXVsdENvbXBpbGVyT3B0aW9ucygpLFxuICAgIGpzeDogdHMuSnN4RW1pdC5SZWFjdCxcbiAgICBzdHJpY3Q6IHRydWUsXG4gICAgZXNNb2R1bGVJbnRlcm9wOiB0cnVlLFxuICAgIG1vZHVsZTogdHMuTW9kdWxlS2luZC5FU05leHQsXG4gICAgc3VwcHJlc3NPdXRwdXRQYXRoQ2hlY2s6IHRydWUsXG4gICAgc2tpcExpYkNoZWNrOiB0cnVlLFxuICAgIHNraXBEZWZhdWx0TGliQ2hlY2s6IHRydWUsXG4gICAgbW9kdWxlUmVzb2x1dGlvbjogdHMuTW9kdWxlUmVzb2x1dGlvbktpbmQuTm9kZUpzLFxuICB9XG59XG5cbi8vIFwiL0RPTS5kLnRzXCIgPT4gXCIvbGliLmRvbS5kLnRzXCJcbmNvbnN0IGxpYml6ZSA9IChwYXRoOiBzdHJpbmcpID0+IHBhdGgucmVwbGFjZShcIi9cIiwgXCIvbGliLlwiKS50b0xvd2VyQ2FzZSgpXG5cbi8qKlxuICogQ3JlYXRlcyBhbiBpbi1tZW1vcnkgU3lzdGVtIG9iamVjdCB3aGljaCBjYW4gYmUgdXNlZCBpbiBhIFR5cGVTY3JpcHQgcHJvZ3JhbSwgdGhpc1xuICogaXMgd2hhdCBwcm92aWRlcyByZWFkL3dyaXRlIGFzcGVjdHMgb2YgdGhlIHZpcnR1YWwgZnNcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZVN5c3RlbShmaWxlczogTWFwPHN0cmluZywgc3RyaW5nPik6IFN5c3RlbSB7XG4gIHJldHVybiB7XG4gICAgYXJnczogW10sXG4gICAgY3JlYXRlRGlyZWN0b3J5OiAoKSA9PiBub3RJbXBsZW1lbnRlZChcImNyZWF0ZURpcmVjdG9yeVwiKSxcbiAgICAvLyBUT0RPOiBjb3VsZCBtYWtlIGEgcmVhbCBmaWxlIHRyZWVcbiAgICBkaXJlY3RvcnlFeGlzdHM6IGF1ZGl0KFwiZGlyZWN0b3J5RXhpc3RzXCIsIGRpcmVjdG9yeSA9PiB7XG4gICAgICByZXR1cm4gQXJyYXkuZnJvbShmaWxlcy5rZXlzKCkpLnNvbWUocGF0aCA9PiBwYXRoLnN0YXJ0c1dpdGgoZGlyZWN0b3J5KSlcbiAgICB9KSxcbiAgICBleGl0OiAoKSA9PiBub3RJbXBsZW1lbnRlZChcImV4aXRcIiksXG4gICAgZmlsZUV4aXN0czogYXVkaXQoXCJmaWxlRXhpc3RzXCIsIGZpbGVOYW1lID0+IGZpbGVzLmhhcyhmaWxlTmFtZSkgfHwgZmlsZXMuaGFzKGxpYml6ZShmaWxlTmFtZSkpKSxcbiAgICBnZXRDdXJyZW50RGlyZWN0b3J5OiAoKSA9PiBcIi9cIixcbiAgICBnZXREaXJlY3RvcmllczogKCkgPT4gW10sXG4gICAgZ2V0RXhlY3V0aW5nRmlsZVBhdGg6ICgpID0+IG5vdEltcGxlbWVudGVkKFwiZ2V0RXhlY3V0aW5nRmlsZVBhdGhcIiksXG4gICAgcmVhZERpcmVjdG9yeTogYXVkaXQoXCJyZWFkRGlyZWN0b3J5XCIsIGRpcmVjdG9yeSA9PiAoZGlyZWN0b3J5ID09PSBcIi9cIiA/IEFycmF5LmZyb20oZmlsZXMua2V5cygpKSA6IFtdKSksXG4gICAgcmVhZEZpbGU6IGF1ZGl0KFwicmVhZEZpbGVcIiwgZmlsZU5hbWUgPT4gZmlsZXMuZ2V0KGZpbGVOYW1lKSB8fCBmaWxlcy5nZXQobGliaXplKGZpbGVOYW1lKSkpLFxuICAgIHJlc29sdmVQYXRoOiBwYXRoID0+IHBhdGgsXG4gICAgbmV3TGluZTogXCJcXG5cIixcbiAgICB1c2VDYXNlU2Vuc2l0aXZlRmlsZU5hbWVzOiB0cnVlLFxuICAgIHdyaXRlOiAoKSA9PiBub3RJbXBsZW1lbnRlZChcIndyaXRlXCIpLFxuICAgIHdyaXRlRmlsZTogKGZpbGVOYW1lLCBjb250ZW50cykgPT4ge1xuICAgICAgZmlsZXMuc2V0KGZpbGVOYW1lLCBjb250ZW50cylcbiAgICB9LFxuICB9XG59XG5cbi8qKlxuICogQ3JlYXRlcyBhIGZpbGUtc3lzdGVtIGJhY2tlZCBTeXN0ZW0gb2JqZWN0IHdoaWNoIGNhbiBiZSB1c2VkIGluIGEgVHlwZVNjcmlwdCBwcm9ncmFtLCB5b3UgcHJvdmlkZVxuICogYSBzZXQgb2YgdmlydHVhbCBmaWxlcyB3aGljaCBhcmUgcHJpb3JpdGlzZWQgb3ZlciB0aGUgRlMgdmVyc2lvbnMsIHRoZW4gYSBwYXRoIHRvIHRoZSByb290IG9mIHlvdXJcbiAqIHByb2plY3QgKGJhc2ljYWxseSB0aGUgZm9sZGVyIHlvdXIgbm9kZV9tb2R1bGVzIGxpdmVzKVxuICovXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlRlNCYWNrZWRTeXN0ZW0oZmlsZXM6IE1hcDxzdHJpbmcsIHN0cmluZz4sIF9wcm9qZWN0Um9vdDogc3RyaW5nLCB0czogVFMpOiBTeXN0ZW0ge1xuICAvLyBXZSBuZWVkIHRvIG1ha2UgYW4gaXNvbGF0ZWQgZm9sZGVyIGZvciB0aGUgdHNjb25maWcsIGJ1dCBhbHNvIG5lZWQgdG8gYmUgYWJsZSB0byByZXNvbHZlIHRoZVxuICAvLyBleGlzdGluZyBub2RlX21vZHVsZXMgc3RydWN0dXJlcyBnb2luZyBiYWNrIHRocm91Z2ggdGhlIGhpc3RvcnlcbiAgY29uc3Qgcm9vdCA9IF9wcm9qZWN0Um9vdCArIFwiL3Zmc1wiXG4gIGNvbnN0IHBhdGggPSByZXF1aXJlKFwicGF0aFwiKVxuXG4gIC8vIFRoZSBkZWZhdWx0IFN5c3RlbSBpbiBUeXBlU2NyaXB0XG4gIGNvbnN0IG5vZGVTeXMgPSB0cy5zeXNcbiAgY29uc3QgdHNMaWIgPSBwYXRoLmRpcm5hbWUocmVxdWlyZS5yZXNvbHZlKFwidHlwZXNjcmlwdFwiKSlcblxuICByZXR1cm4ge1xuICAgIGFyZ3M6IFtdLFxuICAgIGNyZWF0ZURpcmVjdG9yeTogKCkgPT4gbm90SW1wbGVtZW50ZWQoXCJjcmVhdGVEaXJlY3RvcnlcIiksXG4gICAgLy8gVE9ETzogY291bGQgbWFrZSBhIHJlYWwgZmlsZSB0cmVlXG4gICAgZGlyZWN0b3J5RXhpc3RzOiBhdWRpdChcImRpcmVjdG9yeUV4aXN0c1wiLCBkaXJlY3RvcnkgPT4ge1xuICAgICAgcmV0dXJuIEFycmF5LmZyb20oZmlsZXMua2V5cygpKS5zb21lKHBhdGggPT4gcGF0aC5zdGFydHNXaXRoKGRpcmVjdG9yeSkpIHx8IG5vZGVTeXMuZGlyZWN0b3J5RXhpc3RzKGRpcmVjdG9yeSlcbiAgICB9KSxcbiAgICBleGl0OiBub2RlU3lzLmV4aXQsXG4gICAgZmlsZUV4aXN0czogYXVkaXQoXCJmaWxlRXhpc3RzXCIsIGZpbGVOYW1lID0+IHtcbiAgICAgIGlmIChmaWxlcy5oYXMoZmlsZU5hbWUpKSByZXR1cm4gdHJ1ZVxuICAgICAgLy8gRG9uJ3QgbGV0IG90aGVyIHRzY29uZmlncyBlbmQgdXAgdG91Y2hpbmcgdGhlIHZmc1xuICAgICAgaWYgKGZpbGVOYW1lLmluY2x1ZGVzKFwidHNjb25maWcuanNvblwiKSB8fCBmaWxlTmFtZS5pbmNsdWRlcyhcInRzY29uZmlnLmpzb25cIikpIHJldHVybiBmYWxzZVxuICAgICAgaWYgKGZpbGVOYW1lLnN0YXJ0c1dpdGgoXCIvbGliXCIpKSB7XG4gICAgICAgIGNvbnN0IHRzTGliTmFtZSA9IGAke3RzTGlifS8ke2ZpbGVOYW1lLnJlcGxhY2UoXCIvXCIsIFwiXCIpfWBcbiAgICAgICAgcmV0dXJuIG5vZGVTeXMuZmlsZUV4aXN0cyh0c0xpYk5hbWUpXG4gICAgICB9XG4gICAgICByZXR1cm4gbm9kZVN5cy5maWxlRXhpc3RzKGZpbGVOYW1lKVxuICAgIH0pLFxuICAgIGdldEN1cnJlbnREaXJlY3Rvcnk6ICgpID0+IHJvb3QsXG4gICAgZ2V0RGlyZWN0b3JpZXM6IG5vZGVTeXMuZ2V0RGlyZWN0b3JpZXMsXG4gICAgZ2V0RXhlY3V0aW5nRmlsZVBhdGg6ICgpID0+IG5vdEltcGxlbWVudGVkKFwiZ2V0RXhlY3V0aW5nRmlsZVBhdGhcIiksXG4gICAgcmVhZERpcmVjdG9yeTogYXVkaXQoXCJyZWFkRGlyZWN0b3J5XCIsICguLi5hcmdzKSA9PiB7XG4gICAgICBpZiAoYXJnc1swXSA9PT0gXCIvXCIpIHtcbiAgICAgICAgcmV0dXJuIEFycmF5LmZyb20oZmlsZXMua2V5cygpKVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIG5vZGVTeXMucmVhZERpcmVjdG9yeSguLi5hcmdzKVxuICAgICAgfVxuICAgIH0pLFxuICAgIHJlYWRGaWxlOiBhdWRpdChcInJlYWRGaWxlXCIsIGZpbGVOYW1lID0+IHtcbiAgICAgIGlmIChmaWxlcy5oYXMoZmlsZU5hbWUpKSByZXR1cm4gZmlsZXMuZ2V0KGZpbGVOYW1lKVxuICAgICAgaWYgKGZpbGVOYW1lLnN0YXJ0c1dpdGgoXCIvbGliXCIpKSB7XG4gICAgICAgIGNvbnN0IHRzTGliTmFtZSA9IGAke3RzTGlifS8ke2ZpbGVOYW1lLnJlcGxhY2UoXCIvXCIsIFwiXCIpfWBcbiAgICAgICAgcmV0dXJuIG5vZGVTeXMucmVhZEZpbGUodHNMaWJOYW1lKVxuICAgICAgfVxuICAgICAgcmV0dXJuIG5vZGVTeXMucmVhZEZpbGUoZmlsZU5hbWUpXG4gICAgfSksXG4gICAgcmVzb2x2ZVBhdGg6IHBhdGggPT4ge1xuICAgICAgaWYgKGZpbGVzLmhhcyhwYXRoKSkgcmV0dXJuIHBhdGhcbiAgICAgIHJldHVybiBub2RlU3lzLnJlc29sdmVQYXRoKHBhdGgpXG4gICAgfSxcbiAgICBuZXdMaW5lOiBcIlxcblwiLFxuICAgIHVzZUNhc2VTZW5zaXRpdmVGaWxlTmFtZXM6IHRydWUsXG4gICAgd3JpdGU6ICgpID0+IG5vdEltcGxlbWVudGVkKFwid3JpdGVcIiksXG4gICAgd3JpdGVGaWxlOiAoZmlsZU5hbWUsIGNvbnRlbnRzKSA9PiB7XG4gICAgICBmaWxlcy5zZXQoZmlsZU5hbWUsIGNvbnRlbnRzKVxuICAgIH0sXG4gIH1cbn1cblxuLyoqXG4gKiBDcmVhdGVzIGFuIGluLW1lbW9yeSBDb21waWxlckhvc3QgLXdoaWNoIGlzIGVzc2VudGlhbGx5IGFuIGV4dHJhIHdyYXBwZXIgdG8gU3lzdGVtXG4gKiB3aGljaCB3b3JrcyB3aXRoIFR5cGVTY3JpcHQgb2JqZWN0cyAtIHJldHVybnMgYm90aCBhIGNvbXBpbGVyIGhvc3QsIGFuZCBhIHdheSB0byBhZGQgbmV3IFNvdXJjZUZpbGVcbiAqIGluc3RhbmNlcyB0byB0aGUgaW4tbWVtb3J5IGZpbGUgc3lzdGVtLlxuICovXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlVmlydHVhbENvbXBpbGVySG9zdChzeXM6IFN5c3RlbSwgY29tcGlsZXJPcHRpb25zOiBDb21waWxlck9wdGlvbnMsIHRzOiBUUykge1xuICBjb25zdCBzb3VyY2VGaWxlcyA9IG5ldyBNYXA8c3RyaW5nLCBTb3VyY2VGaWxlPigpXG4gIGNvbnN0IHNhdmUgPSAoc291cmNlRmlsZTogU291cmNlRmlsZSkgPT4ge1xuICAgIHNvdXJjZUZpbGVzLnNldChzb3VyY2VGaWxlLmZpbGVOYW1lLCBzb3VyY2VGaWxlKVxuICAgIHJldHVybiBzb3VyY2VGaWxlXG4gIH1cblxuICB0eXBlIFJldHVybiA9IHtcbiAgICBjb21waWxlckhvc3Q6IENvbXBpbGVySG9zdFxuICAgIHVwZGF0ZUZpbGU6IChzb3VyY2VGaWxlOiBTb3VyY2VGaWxlKSA9PiBib29sZWFuXG4gIH1cblxuICBjb25zdCB2SG9zdDogUmV0dXJuID0ge1xuICAgIGNvbXBpbGVySG9zdDoge1xuICAgICAgLi4uc3lzLFxuICAgICAgZ2V0Q2Fub25pY2FsRmlsZU5hbWU6IGZpbGVOYW1lID0+IGZpbGVOYW1lLFxuICAgICAgZ2V0RGVmYXVsdExpYkZpbGVOYW1lOiAoKSA9PiBcIi9cIiArIHRzLmdldERlZmF1bHRMaWJGaWxlTmFtZShjb21waWxlck9wdGlvbnMpLCAvLyAnL2xpYi5kLnRzJyxcbiAgICAgIC8vIGdldERlZmF1bHRMaWJMb2NhdGlvbjogKCkgPT4gJy8nLFxuICAgICAgZ2V0RGlyZWN0b3JpZXM6ICgpID0+IFtdLFxuICAgICAgZ2V0TmV3TGluZTogKCkgPT4gc3lzLm5ld0xpbmUsXG4gICAgICBnZXRTb3VyY2VGaWxlOiBmaWxlTmFtZSA9PiB7XG4gICAgICAgIHJldHVybiAoXG4gICAgICAgICAgc291cmNlRmlsZXMuZ2V0KGZpbGVOYW1lKSB8fFxuICAgICAgICAgIHNhdmUoXG4gICAgICAgICAgICB0cy5jcmVhdGVTb3VyY2VGaWxlKFxuICAgICAgICAgICAgICBmaWxlTmFtZSxcbiAgICAgICAgICAgICAgc3lzLnJlYWRGaWxlKGZpbGVOYW1lKSEsXG4gICAgICAgICAgICAgIGNvbXBpbGVyT3B0aW9ucy50YXJnZXQgfHwgZGVmYXVsdENvbXBpbGVyT3B0aW9ucyh0cykudGFyZ2V0ISxcbiAgICAgICAgICAgICAgZmFsc2VcbiAgICAgICAgICAgIClcbiAgICAgICAgICApXG4gICAgICAgIClcbiAgICAgIH0sXG4gICAgICB1c2VDYXNlU2Vuc2l0aXZlRmlsZU5hbWVzOiAoKSA9PiBzeXMudXNlQ2FzZVNlbnNpdGl2ZUZpbGVOYW1lcyxcbiAgICB9LFxuICAgIHVwZGF0ZUZpbGU6IHNvdXJjZUZpbGUgPT4ge1xuICAgICAgY29uc3QgYWxyZWFkeUV4aXN0cyA9IHNvdXJjZUZpbGVzLmhhcyhzb3VyY2VGaWxlLmZpbGVOYW1lKVxuICAgICAgc3lzLndyaXRlRmlsZShzb3VyY2VGaWxlLmZpbGVOYW1lLCBzb3VyY2VGaWxlLnRleHQpXG4gICAgICBzb3VyY2VGaWxlcy5zZXQoc291cmNlRmlsZS5maWxlTmFtZSwgc291cmNlRmlsZSlcbiAgICAgIHJldHVybiBhbHJlYWR5RXhpc3RzXG4gICAgfSxcbiAgfVxuICByZXR1cm4gdkhvc3Rcbn1cblxuLyoqXG4gKiBDcmVhdGVzIGFuIG9iamVjdCB3aGljaCBjYW4gaG9zdCBhIGxhbmd1YWdlIHNlcnZpY2UgYWdhaW5zdCB0aGUgdmlydHVhbCBmaWxlLXN5c3RlbVxuICovXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlVmlydHVhbExhbmd1YWdlU2VydmljZUhvc3QoXG4gIHN5czogU3lzdGVtLFxuICByb290RmlsZXM6IHN0cmluZ1tdLFxuICBjb21waWxlck9wdGlvbnM6IENvbXBpbGVyT3B0aW9ucyxcbiAgdHM6IFRTLFxuICBjdXN0b21UcmFuc2Zvcm1lcnM/OiBDdXN0b21UcmFuc2Zvcm1lcnNcbikge1xuICBjb25zdCBmaWxlTmFtZXMgPSBbLi4ucm9vdEZpbGVzXVxuICBjb25zdCB7IGNvbXBpbGVySG9zdCwgdXBkYXRlRmlsZSB9ID0gY3JlYXRlVmlydHVhbENvbXBpbGVySG9zdChzeXMsIGNvbXBpbGVyT3B0aW9ucywgdHMpXG4gIGNvbnN0IGZpbGVWZXJzaW9ucyA9IG5ldyBNYXA8c3RyaW5nLCBzdHJpbmc+KClcbiAgbGV0IHByb2plY3RWZXJzaW9uID0gMFxuICBjb25zdCBsYW5ndWFnZVNlcnZpY2VIb3N0OiBMYW5ndWFnZVNlcnZpY2VIb3N0ID0ge1xuICAgIC4uLmNvbXBpbGVySG9zdCxcbiAgICBnZXRQcm9qZWN0VmVyc2lvbjogKCkgPT4gcHJvamVjdFZlcnNpb24udG9TdHJpbmcoKSxcbiAgICBnZXRDb21waWxhdGlvblNldHRpbmdzOiAoKSA9PiBjb21waWxlck9wdGlvbnMsXG4gICAgZ2V0Q3VzdG9tVHJhbnNmb3JtZXJzOiAoKSA9PiBjdXN0b21UcmFuc2Zvcm1lcnMsXG4gICAgZ2V0U2NyaXB0RmlsZU5hbWVzOiAoKSA9PiBmaWxlTmFtZXMsXG4gICAgZ2V0U2NyaXB0U25hcHNob3Q6IGZpbGVOYW1lID0+IHtcbiAgICAgIGNvbnN0IGNvbnRlbnRzID0gc3lzLnJlYWRGaWxlKGZpbGVOYW1lKVxuICAgICAgaWYgKGNvbnRlbnRzKSB7XG4gICAgICAgIHJldHVybiB0cy5TY3JpcHRTbmFwc2hvdC5mcm9tU3RyaW5nKGNvbnRlbnRzKVxuICAgICAgfVxuICAgICAgcmV0dXJuXG4gICAgfSxcbiAgICBnZXRTY3JpcHRWZXJzaW9uOiBmaWxlTmFtZSA9PiB7XG4gICAgICByZXR1cm4gZmlsZVZlcnNpb25zLmdldChmaWxlTmFtZSkgfHwgXCIwXCJcbiAgICB9LFxuICAgIHdyaXRlRmlsZTogc3lzLndyaXRlRmlsZSxcbiAgfVxuXG4gIHR5cGUgUmV0dXJuID0ge1xuICAgIGxhbmd1YWdlU2VydmljZUhvc3Q6IExhbmd1YWdlU2VydmljZUhvc3RcbiAgICB1cGRhdGVGaWxlOiAoc291cmNlRmlsZTogaW1wb3J0KFwidHlwZXNjcmlwdFwiKS5Tb3VyY2VGaWxlKSA9PiB2b2lkXG4gIH1cblxuICBjb25zdCBsc0hvc3Q6IFJldHVybiA9IHtcbiAgICBsYW5ndWFnZVNlcnZpY2VIb3N0LFxuICAgIHVwZGF0ZUZpbGU6IHNvdXJjZUZpbGUgPT4ge1xuICAgICAgcHJvamVjdFZlcnNpb24rK1xuICAgICAgZmlsZVZlcnNpb25zLnNldChzb3VyY2VGaWxlLmZpbGVOYW1lLCBwcm9qZWN0VmVyc2lvbi50b1N0cmluZygpKVxuICAgICAgaWYgKCFmaWxlTmFtZXMuaW5jbHVkZXMoc291cmNlRmlsZS5maWxlTmFtZSkpIHtcbiAgICAgICAgZmlsZU5hbWVzLnB1c2goc291cmNlRmlsZS5maWxlTmFtZSlcbiAgICAgIH1cbiAgICAgIHVwZGF0ZUZpbGUoc291cmNlRmlsZSlcbiAgICB9LFxuICB9XG4gIHJldHVybiBsc0hvc3Rcbn1cbiJdfQ==